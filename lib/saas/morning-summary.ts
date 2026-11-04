import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRecipients, sendEmail } from "./notify";
import { escHtml } from "./html";
import { isWritable } from "./entitlements";
import { lateLine, type LoadoutPlan } from "./plans";
import { daysOut, DEFAULT_OUT_ALERT_DAYS } from "./whereabouts";
import { YARD_TZ } from "./format";

/**
 * The manager's morning email: what happened in the last day, and where the
 * app wasn't used. One email per company per day, and only when there's
 * something in it: a quiet yard gets no email.
 */
export interface DaySummary {
  company: string;
  loadouts: number;
  ready: number;
  blocked: string[];      // "CT-03: Out of test: Quad BOP stack #3 QB-4471"
  overrides: string[];    // "CT-07 by Kevin Odom: \"Swivel recert booked Thursday\""
  checkins: number;
  unscanned: string[];    // event messages: came back without being cleared
  late: string[];         // "CT-01: Was planned to leave 5:00 AM. Nobody has scanned it out."
  outTooLong: string[];   // "CT-08: 5 pieces, out 9 days"
  idle: string[];         // crew with nothing in RollReady in 7 days
  noPaper: number;        // tests with a date but no cert attached
}

export function summaryText(s: DaySummary): { subject: string; body: string } | null {
  const problems = s.blocked.length + s.overrides.length + s.unscanned.length + s.late.length + s.outTooLong.length;
  if (s.loadouts + s.checkins + problems === 0) return null;
  const out: string[] = [];
  out.push(`${s.company}, the last 24 hours:`);
  out.push(`${s.loadouts} ${s.loadouts === 1 ? "load-out" : "load-outs"} (${s.ready} READY${s.blocked.length ? `, ${s.blocked.length} blocked` : ""}), ${s.checkins} ${s.checkins === 1 ? "check-in" : "check-ins"}.`);
  const section = (title: string, rows: string[]) => { if (rows.length) out.push("", title, ...rows.map((r) => `  ${r}`)); };
  section("Not scanned out (the app wasn't used):", [...s.late, ...s.unscanned]);
  section("Blocked at load-out:", s.blocked);
  section("Rolled on a manager's override:", s.overrides);
  section("Out too long, not checked back in:", s.outTooLong);
  section("On the crew, nothing in RollReady this week:", s.idle);
  if (s.noPaper) out.push("", `${s.noPaper} ${s.noPaper === 1 ? "test has" : "tests have"} a date but no cert attached, so that iron can't go out.`);
  out.push("", "Open RollReady: https://www.synnr.io/app");
  const flag = s.late.length + s.unscanned.length;
  const subject = flag
    ? `RollReady: ${flag} ${flag === 1 ? "truck" : "trucks"} not scanned out at ${s.company}`
    : `RollReady: yesterday at ${s.company}`;
  return { subject, body: out.join("\n") };
}

const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: YARD_TZ, weekday: "short", hour: "numeric", minute: "2-digit" });

/** Build and send every paying company's morning email. */
export async function sendMorningSummaries(admin: SupabaseClient): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const res = { sent: 0, skipped: 0, errors: [] as string[] };
  const { data: cos } = await admin.from("saas_companies").select("id, name, subscription_status, comped, is_demo").eq("is_demo", false);
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600e3).toISOString();
  const now = Date.now();
  for (const c of (cos ?? []) as { id: string; name: string; subscription_status: string; comped: boolean }[]) {
    if (!isWritable(c.subscription_status, c.comped)) continue;
    try {
      const [{ data: lo }, { data: ov }, { count: checkins }, { data: ev }, { data: plans }, { data: units }, { data: outRows }, { data: rules }, { data: members }, { data: weekEv }, { count: noPaper }] = await Promise.all([
        admin.from("saas_loadout_scans").select("id, unit_id, unit_name, verdict, reasons, finished_at").eq("company_id", c.id).gte("finished_at", since),
        admin.from("saas_loadout_overrides").select("loadout_id, by_name, reason").eq("company_id", c.id).gte("created_at", since),
        admin.from("saas_returns").select("id", { count: "exact", head: true }).eq("company_id", c.id).gte("finished_at", since),
        admin.from("saas_events").select("message").eq("company_id", c.id).eq("kind", "unscanned_trip").gte("created_at", since),
        admin.from("saas_loadout_plans").select("unit_id, created_at, leaves_at").eq("company_id", c.id).is("used_at", null).not("leaves_at", "is", null),
        admin.from("saas_units").select("id, name").eq("company_id", c.id),
        admin.from("saas_assets").select("unit_id, out_since").eq("company_id", c.id).not("out_since", "is", null).not("status", "in", "(retired,missing)"),
        admin.from("saas_enforcement_settings").select("out_alert_days").eq("company_id", c.id).maybeSingle(),
        admin.from("saas_memberships").select("user_id").eq("company_id", c.id).eq("status", "active"),
        admin.from("saas_events").select("actor").eq("company_id", c.id).gte("created_at", weekAgo).not("actor", "is", null).limit(3000),
        admin.from("saas_compliance_items_with_status").select("id", { count: "exact", head: true }).eq("company_id", c.id).neq("parent_type", "crew").eq("status", "no_paper"),
      ]);
      const unitName = new Map(((units ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]));
      const loads = (lo ?? []) as { id: string; unit_id: string | null; unit_name: string; verdict: string | null; reasons: string[] | null; finished_at: string }[];
      const ovs = (ov ?? []) as { loadout_id: string; by_name: string; reason: string }[];
      const ovIds = new Set(ovs.map((o) => o.loadout_id));

      // Late: planned to leave, nothing that rolled since the plan was made.
      const late: string[] = [];
      for (const p of (plans ?? []) as { unit_id: string; created_at: string; leaves_at: string }[]) {
        const { data: last } = await admin.from("saas_loadout_scans").select("id, finished_at, verdict").eq("company_id", c.id).eq("unit_id", p.unit_id)
          .order("finished_at", { ascending: false }).limit(1).maybeSingle();
        const l = last as { id: string; finished_at: string; verdict: string | null } | null;
        let rolled = l?.verdict === "ready";
        if (l && !rolled) rolled = Boolean((await admin.from("saas_loadout_overrides").select("loadout_id").eq("loadout_id", l.id).maybeSingle()).data);
        const line = lateLine({ at: p.created_at, leavesAt: p.leaves_at } as Pick<LoadoutPlan, "at" | "leavesAt">, l ? { finished_at: l.finished_at, rolled } : null, now, timeText);
        if (line) late.push(`${unitName.get(p.unit_id) ?? "A truck"}: ${line}`);
      }

      const limit = (rules as { out_alert_days: number | null } | null)?.out_alert_days ?? DEFAULT_OUT_ALERT_DAYS;
      const outByTruck = new Map<string, number[]>();
      for (const r of (outRows ?? []) as { unit_id: string | null; out_since: string }[]) {
        const d = daysOut(r.out_since, now);
        if (d >= limit) outByTruck.set(r.unit_id ?? "", [...(outByTruck.get(r.unit_id ?? "") ?? []), d]);
      }
      const outTooLong = [...outByTruck].map(([u, ds]) => `${unitName.get(u) ?? "In the yard"}: ${ds.length} ${ds.length === 1 ? "piece" : "pieces"}, out ${Math.max(...ds)} days`);

      // Who's on the crew but hasn't done anything in a week.
      const active = new Set(((weekEv ?? []) as { actor: string }[]).map((e) => e.actor));
      const idle: string[] = [];
      for (const m of ((members ?? []) as { user_id: string }[]).slice(0, 60)) {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        const n = (data?.user?.user_metadata?.full_name as string | undefined)?.trim() || data?.user?.email?.split("@")[0];
        if (n && !active.has(n)) idle.push(n);
      }

      const s: DaySummary = {
        company: c.name,
        loadouts: loads.length,
        ready: loads.filter((l) => l.verdict === "ready").length,
        blocked: loads.filter((l) => l.verdict !== "ready" && !ovIds.has(l.id)).map((l) => `${l.unit_name}: ${(l.reasons ?? [])[0] ?? "NOT READY"}`),
        overrides: ovs.map((o) => `${loads.find((l) => l.id === o.loadout_id)?.unit_name ?? "A truck"} by ${o.by_name}: "${o.reason}"`),
        checkins: checkins ?? 0,
        unscanned: ((ev ?? []) as { message: string }[]).map((e) => e.message),
        late, outTooLong, idle,
        noPaper: noPaper ?? 0,
      };
      const msg = summaryText(s);
      if (!msg) { res.skipped++; continue; }
      const to = (await resolveRecipients(c.id)).filter((r) => r.channels.includes("email") && r.email).map((r) => r.email as string);
      if (!to.length) { res.errors.push(`${c.name}: no one to email the morning summary to`); continue; }
      const ok = await sendEmail(to, msg.subject, `<pre style="font:14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">${escHtml(msg.body)}</pre>`);
      if (ok) res.sent++; else res.errors.push(`${c.name}: morning summary email failed`);
    } catch (e) {
      res.errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
