import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "./read-all";
import { defaultRecipients, resolveRecipients, sendEmail, type Recipient } from "./notify";
import { escHtml } from "./html";
import { isWritable } from "./entitlements";
import { lateLine, PLAN_AHEAD_MS, type LoadoutPlan } from "./plans";
import { daysOut, DEFAULT_OUT_ALERT_DAYS } from "./whereabouts";
import { YARD_TZ } from "./format";
import { getToolStocks, isLow, lowLine, lateOutLines } from "./tool-stock";
import { getCompanyReadiness } from "./readiness";

/**
 * The manager's morning email: what happened in the last day, where the app
 * wasn't used, and what can't roll right now. One email per company per day
 * (plus one per yard-only person, with just their yards), and only when
 * there's something in it: a quiet yard gets no email.
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
  /** Planned, scanned, and blocked: the crew used the app, the truck just can't go. "CT-01: Was planned to leave 5:00 AM. Still NOT READY." */
  stillBlocked?: string[];
  outTooLong: string[];   // "CT-08: 5 pieces, out 9 days" or "With Dale Wooten: Silver Fox #2, out 9 days"
  damaged: string[];      // "Quad BOP #11 QB-4471: rams bent. Went out on CT-03 Nov 2, loaded by Dale. Checked in by Freddy."
  /** Trucks that can't roll right now on their own paper or iron, whatever happened yesterday: "P-02: Annual DOT inspection: expired 23d ago" */
  cantRoll?: string[];
  redressWaiting?: number; // tools back from a run, not redressed yet
  /** The first few of them by name. */
  redressNames?: string[];
  /** Setting tool shelves at or under the manager's warning number: "Odessa Yard, Silver Fox setting tools: 1 ready, 5 used waiting on pickup. Call Silver Fox." */
  toolsLow?: string[];
  /** Cert uploads waiting on a manager's OK. */
  uploadsWaiting?: number;
  /** Monday: crew who haven't used it all week count as news, so a yard that stopped using it still hears. */
  weekly?: boolean;
  idle: string[];         // crew with nothing in RollReady in 7 days
  crew?: number;          // everyone active on the crew (so "nobody used it" means nobody)
  noPaper: number;        // tests with a date but no cert attached
  /** The first few of them by name: "CT-03: Annual DOT inspection". */
  noPaperNames?: string[];
}

const CANT_ROLL_SHOWN = 10;

export function summaryText(s: DaySummary): { subject: string; body: string } | null {
  const stillBlocked = s.stillBlocked ?? [];
  const cantRoll = s.cantRoll ?? [];
  const problems = s.blocked.length + s.overrides.length + s.unscanned.length + s.late.length + stillBlocked.length + s.outTooLong.length + s.damaged.length
    + (s.toolsLow?.length ?? 0) + cantRoll.length + (s.uploadsWaiting ?? 0) + (s.weekly ? s.idle.length : 0);
  if (s.loadouts + s.checkins + problems === 0) return null;
  const out: string[] = [];
  out.push(`${s.company}, the last 24 hours:`);
  out.push(`${s.loadouts} ${s.loadouts === 1 ? "load-out" : "load-outs"} (${s.ready} READY${s.blocked.length ? `, ${s.blocked.length} blocked` : ""}), ${s.checkins} ${s.checkins === 1 ? "check-in" : "check-ins"}.`);
  const section = (title: string, rows: string[]) => { if (rows.length) out.push("", title, ...rows.map((r) => `  ${r}`)); };
  const more = (n: number) => (n > 0 ? [`and ${n} more`] : []);
  section("Not scanned out (the app wasn't used):", [...s.late, ...s.unscanned]);
  section("Planned to leave, still blocked:", stillBlocked);
  section("Came back damaged:", s.damaged);
  section("Blocked at load-out:", s.blocked);
  section("Rolled on a manager's override:", s.overrides);
  section("Can't roll right now:", [...cantRoll.slice(0, CANT_ROLL_SHOWN), ...more(cantRoll.length - CANT_ROLL_SHOWN)]);
  section("Setting tools running low:", s.toolsLow ?? []);
  section("Out too long, not checked back in:", s.outTooLong);
  section("On the crew, nothing in RollReady this week:", s.idle);
  if (s.uploadsWaiting) out.push("", `Waiting on you: ${s.uploadsWaiting} ${s.uploadsWaiting === 1 ? "upload needs" : "uploads need"} a manager's OK. Open Review uploads.`);
  const names = (rows: string[] | undefined, total: number) => {
    const shown = rows ?? [];
    if (shown.length) out.push(...shown.map((r) => `  ${r}`), ...more(total - shown.length).map((r) => `  ${r}`));
  };
  if (s.redressWaiting) {
    out.push("", `${s.redressWaiting} ${s.redressWaiting === 1 ? "tool is" : "tools are"} back from a run and waiting on redress. They can't go out until someone redresses them.`);
    names(s.redressNames, s.redressWaiting);
  }
  if (s.noPaper) {
    out.push("", `${s.noPaper} ${s.noPaper === 1 ? "test or truck paper has" : "tests or truck papers have"} a date but no cert attached, so that can't go out.`);
    names(s.noPaperNames, s.noPaper);
  }
  out.push("", "Open RollReady: https://www.synnr.io/app");
  const flag = s.late.length + s.unscanned.length;
  const trucks = (n: number) => `${n} ${n === 1 ? "truck" : "trucks"}`;
  const subject = flag
    ? `RollReady: ${trucks(flag)} not scanned out at ${s.company}`
    : stillBlocked.length ? `RollReady: ${stillBlocked.length} planned ${stillBlocked.length === 1 ? "truck" : "trucks"} still blocked at ${s.company}`
    : s.damaged.length ? `RollReady: ${s.damaged.length} ${s.damaged.length === 1 ? "piece" : "pieces"} came back damaged at ${s.company}`
    : s.weekly && s.idle.length && (s.crew ? s.idle.length >= s.crew : s.loadouts + s.checkins === 0) ? `RollReady: nobody at ${s.company} used it this week`
    : s.weekly && s.idle.length ? `RollReady: ${s.idle.length} ${s.idle.length === 1 ? "person hasn't" : "people haven't"} used it this week at ${s.company}`
    : cantRoll.length ? `RollReady: ${trucks(cantRoll.length)} can't roll at ${s.company}`
    : s.toolsLow?.length ? `RollReady: setting tools running low at ${s.company}`
    : `RollReady: yesterday at ${s.company}`;
  return { subject, body: out.join("\n") };
}

/** The reason a blocked truck's line leads with: bad paper or iron before a short line, plus how many more. */
export function blockedWhy(reasons: string[] | null): string {
  const rs = reasons ?? [];
  if (!rs.length) return "NOT READY";
  const worst = rs.find((r) => /^(Out of test|Truck paper|Red-tagged|No test|No paper|Needs redress)/.test(r)) ?? rs[0];
  return `${worst}${rs.length > 1 ? ` (and ${rs.length - 1} more)` : ""}`;
}

/** A piece as a check-in record keeps it (the parts the morning email reads). */
interface ReturnedPiece { name: string; serial: string | null; red_tag: string | null; from_unit?: string | null; went_out?: { truck?: string; by?: string | null; with?: string; at?: string | null } | null }

const dayText = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

/** "Quad BOP #11 QB-4471: rams bent. Went out on CT-03 Nov 2, loaded by Dale. Checked in by Freddy." */
export function damagedLine(p: ReturnedPiece, checkedInBy: string): string {
  const w = p.went_out;
  // Moved to a truck piece by piece (no load-out of its own): name the truck it came back on.
  const where = w?.with ? ` Signed out to ${w.with}${w.at ? ` ${dayText(w.at)}` : ""}.`
    : w?.truck ? ` Went out on ${w.truck}${w.at ? ` ${dayText(w.at)}` : ""}${w.by ? `, loaded by ${w.by}` : ""}.`
    : p.from_unit ? ` Came back on ${p.from_unit}.` : "";
  return `${p.name}${p.serial ? ` ${p.serial}` : ""}: ${p.red_tag}.${where} Checked in by ${checkedInBy}.`;
}

const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: YARD_TZ, weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * Was the planned truck scanned for this plan? lateLine's own rule (plans.ts):
 * a load-out after the plan was made, and inside the window before it leaves.
 * Scanned and blocked is "still blocked", not "the app wasn't used".
 */
export function planScanned(plan: { created_at: string; leaves_at: string }, last: { finished_at: string } | null): boolean {
  if (!last) return false;
  const leaves = Date.parse(plan.leaves_at);
  const made = Date.parse(plan.created_at);
  const from = Number.isFinite(made) ? Math.max(made, leaves - PLAN_AHEAD_MS) : leaves - PLAN_AHEAD_MS;
  return Date.parse(last.finished_at) > from;
}

/** A line in the email and the yard it's about (null: no yard known, so only the whole-company email shows it). */
type Line = { yard: string | null; text: string; /** Already names a yard or a person: no yard in front. */ named?: boolean };

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
      const [{ data: lo }, { data: ov }, { data: ev }, { data: plans }, { data: units }, { data: outRows }, { data: rules }, { data: members }, { data: weekEv }, paper, { data: yardRows }, { count: uploadsWaiting }] = await Promise.all([
        admin.from("saas_loadout_scans").select("id, unit_id, unit_name, yard_id, verdict, reasons, finished_at").eq("company_id", c.id).gte("finished_at", since),
        admin.from("saas_loadout_overrides").select("loadout_id, by_name, reason").eq("company_id", c.id).gte("created_at", since),
        admin.from("saas_events").select("message, unit_id").eq("company_id", c.id).eq("kind", "unscanned_trip").gte("created_at", since),
        admin.from("saas_loadout_plans").select("unit_id, created_at, leaves_at").eq("company_id", c.id).is("used_at", null).not("leaves_at", "is", null),
        admin.from("saas_units").select("id, name, yard_id").eq("company_id", c.id),
        admin.from("saas_assets").select("unit_id, yard_id, out_since, out_with_name, name, identifier").eq("company_id", c.id).not("out_since", "is", null).not("status", "in", "(retired,missing)"),
        admin.from("saas_enforcement_settings").select("out_alert_days").eq("company_id", c.id).maybeSingle(),
        admin.from("saas_memberships").select("user_id, role").eq("company_id", c.id).eq("status", "active"),
        // The week's activity, every row: a piece-by-piece move from a load-out
        // is already counted by the load-out, so those are left out.
        readAll<{ actor: string }>((a, b) => admin.from("saas_events").select("actor", { count: "exact" }).eq("company_id", c.id).gte("created_at", weekAgo)
          .not("actor", "is", null).neq("kind", "asset_moved").order("id").range(a, b)).then((data) => ({ data })),
        // Paper with a date but no cert, on iron that's still in use (retired iron is kept for the record, not counted).
        admin.from("saas_compliance_items_with_status").select("title, parent_type, parent_id").eq("company_id", c.id).neq("parent_type", "crew").eq("status", "no_paper").limit(1000)
          .then(async ({ data }) => {
            const rows = (data ?? []) as { title: string; parent_type: string; parent_id: string }[];
            const assetIds = [...new Set(rows.filter((r) => r.parent_type === "asset").map((r) => r.parent_id))];
            const { data: pieces } = assetIds.length
              ? await admin.from("saas_assets").select("id, name, identifier, status, yard_id, unit_id").eq("company_id", c.id).in("id", assetIds.slice(0, 500))
              : { data: [] };
            return { rows, pieces: (pieces ?? []) as { id: string; name: string; identifier: string | null; status: string; yard_id: string | null; unit_id: string | null }[] };
          }),
        admin.from("saas_yards").select("id, name").eq("company_id", c.id),
        admin.from("saas_cert_uploads").select("id", { count: "exact", head: true }).eq("company_id", c.id).eq("status", "waiting"),
      ]);
      const unitRows = (units ?? []) as { id: string; name: string; yard_id: string | null }[];
      const unitName = new Map(unitRows.map((u) => [u.id, u.name]));
      const unitYard = new Map(unitRows.map((u) => [u.id, u.yard_id ?? null]));
      const yardOf = (unitId: string | null | undefined) => (unitId ? unitYard.get(unitId) ?? null : null);
      const yardName = new Map(((yardRows ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));

      const loads = ((lo ?? []) as { id: string; unit_id: string | null; unit_name: string; yard_id: string | null; verdict: string | null; reasons: string[] | null; finished_at: string }[])
        .map((l) => ({ ...l, yard: l.yard_id ?? yardOf(l.unit_id) }));
      const ovs = (ov ?? []) as { loadout_id: string; by_name: string; reason: string }[];
      const ovIds = new Set(ovs.map((o) => o.loadout_id));
      // An override made today can be for a load-out from days ago: name its truck from the load-out itself.
      const ovTruck = new Map(loads.map((l) => [l.id, { name: l.unit_name, yard: l.yard }]));
      const ovMissing = ovs.map((o) => o.loadout_id).filter((id) => !ovTruck.has(id));
      if (ovMissing.length) {
        const { data: olds } = await admin.from("saas_loadout_scans").select("id, unit_name, unit_id, yard_id").eq("company_id", c.id).in("id", ovMissing);
        for (const o of (olds ?? []) as { id: string; unit_name: string; unit_id: string | null; yard_id: string | null }[]) ovTruck.set(o.id, { name: o.unit_name, yard: o.yard_id ?? yardOf(o.unit_id) });
      }

      // Late: planned to leave, nothing that rolled since the plan was made.
      // Scanned since the plan and blocked is its own line: the crew used the app.
      const late: Line[] = [];
      const stillBlocked: Line[] = [];
      for (const p of (plans ?? []) as { unit_id: string; created_at: string; leaves_at: string }[]) {
        const { data: last } = await admin.from("saas_loadout_scans").select("id, finished_at, verdict").eq("company_id", c.id).eq("unit_id", p.unit_id)
          .order("finished_at", { ascending: false }).limit(1).maybeSingle();
        const l = last as { id: string; finished_at: string; verdict: string | null } | null;
        let rolled = l?.verdict === "ready";
        if (l && !rolled) rolled = Boolean((await admin.from("saas_loadout_overrides").select("loadout_id").eq("loadout_id", l.id).maybeSingle()).data);
        const line = lateLine({ at: p.created_at, leavesAt: p.leaves_at } as Pick<LoadoutPlan, "at" | "leavesAt">, l ? { finished_at: l.finished_at, rolled } : null, now, timeText);
        if (line) (planScanned(p, l) ? stillBlocked : late).push({ yard: yardOf(p.unit_id), text: `${unitName.get(p.unit_id) ?? "A truck"}: ${line}` });
      }

      const limit = (rules as { out_alert_days: number | null } | null)?.out_alert_days ?? DEFAULT_OUT_ALERT_DAYS;
      // By truck; pieces out on no truck, by the yard they belong to.
      const outByTruck = new Map<string, { yard: string | null; days: number[] }>();
      const withPeople: Line[] = [];
      const out = (outRows ?? []) as { unit_id: string | null; yard_id: string | null; out_since: string; out_with_name: string | null; name: string; identifier: string | null }[];
      for (const r of out) {
        const d = daysOut(r.out_since, now);
        if (d < limit) continue;
        const yard = r.yard_id ?? yardOf(r.unit_id);
        // Signed out to a person: name the person and the tool.
        if (r.out_with_name) { withPeople.push({ yard, named: true, text: `With ${r.out_with_name}: ${r.name}${r.identifier ? ` ${r.identifier}` : ""}, out ${d} days` }); continue; }
        const key = r.unit_id ?? `@${r.yard_id ?? ""}`;
        const g = outByTruck.get(key) ?? { yard: r.unit_id ? yardOf(r.unit_id) : r.yard_id, days: [] };
        g.days.push(d);
        outByTruck.set(key, g);
      }
      // Setting tools by count: the shelves running low, and who's had some out too long.
      const stocks = await getToolStocks(admin, c.id).catch(() => []);
      const toolsLow: Line[] = stocks.filter(isLow).map((s) => ({ yard: s.yardId, named: true, text: lowLine(s) }));
      const outTooLong: Line[] = [
        ...[...outByTruck].map(([k, g]) => ({ yard: g.yard, text: `${(k.startsWith("@") ? null : unitName.get(k)) ?? "In the yard"}: ${g.days.length} ${g.days.length === 1 ? "piece" : "pieces"}, out ${Math.max(...g.days)} days` })),
        ...withPeople,
        ...stocks.flatMap((s) => lateOutLines([s], limit, now).map((text) => ({ yard: s.yardId, named: true, text }))),
      ];

      // Came back damaged: red-tagged at check-in, with whose job it came back from.
      const [{ data: rets }, { data: redressRows }] = await Promise.all([
        admin.from("saas_returns").select("returned_by, pieces, yard_id, unit_id").eq("company_id", c.id).gte("finished_at", since),
        // The same tools Tools out lists: red-tagged or missing ones aren't waiting on a redress.
        admin.from("saas_assets").select("name, identifier, yard_id, unit_id").eq("company_id", c.id).not("needs_redress_since", "is", null).not("status", "in", "(retired,out_of_service,missing)").limit(1000),
      ]);
      const backs = ((rets ?? []) as { returned_by: string; pieces: ReturnedPiece[] | null; yard_id: string | null; unit_id: string | null }[])
        .map((r) => ({ ...r, yard: r.yard_id ?? yardOf(r.unit_id) }));
      const damaged: Line[] = backs.flatMap((r) => (r.pieces ?? []).filter((p) => p.red_tag).map((p) => ({ yard: r.yard, text: damagedLine(p, r.returned_by) })));
      const redress: Line[] = ((redressRows ?? []) as { name: string; identifier: string | null; yard_id: string | null; unit_id: string | null }[])
        .map((a) => ({ yard: a.yard_id ?? yardOf(a.unit_id), text: `${a.name}${a.identifier ? ` ${a.identifier}` : ""}` }));
      const pieceOf = new Map(paper.pieces.map((a) => [a.id, a]));
      const noPaper: Line[] = paper.rows.flatMap((r) => {
        if (r.parent_type !== "asset") return [{ yard: yardOf(r.parent_id), text: `${unitName.get(r.parent_id) ?? "A truck"}: ${r.title}` }];
        const a = pieceOf.get(r.parent_id);
        if (a?.status === "retired") return [];
        return [{ yard: a ? a.yard_id ?? yardOf(a.unit_id) : null, text: `${a ? `${a.name}${a.identifier ? ` ${a.identifier}` : ""}` : "A piece"}: ${r.title}` }];
      });

      // Trucks that can't roll right now on their own paper or iron, the
      // same red the board shows: a lapsed DOT keeps showing up here, every
      // morning, until it's fixed.
      const rd = await getCompanyReadiness(admin, c.id).catch((e) => {
        res.errors.push(`${c.name}: couldn't read which trucks can roll for the morning email (${e instanceof Error ? e.message : String(e)})`);
        return null;
      });
      const cantRoll: Line[] = (rd?.units ?? []).filter((u) => u.state === "not_ready").map((u) => ({ yard: u.yardId ?? null, text: `${u.name}: ${u.why}` }));

      // Hands on the crew who haven't done anything in a week. (An owner or
      // office manager who only reads the board isn't idle.) Load-outs and
      // check-ins count even if the feed line didn't land.
      const [{ data: weekLoads }, { data: weekBacks }, { data: weekMoves }] = await Promise.all([
        admin.from("saas_loadout_scans").select("scanned_by").eq("company_id", c.id).gte("finished_at", weekAgo).not("scanned_by", "is", null).limit(1000),
        admin.from("saas_returns").select("returned_by").eq("company_id", c.id).gte("finished_at", weekAgo).not("returned_by", "is", null).limit(1000),
        // Moving iron counts as using it too.
        admin.from("saas_events").select("actor").eq("company_id", c.id).eq("kind", "asset_moved").gte("created_at", weekAgo).not("actor", "is", null).order("created_at", { ascending: false }).limit(1000),
      ]);
      const active = new Set([...((weekEv ?? []) as { actor: string }[]).map((e) => e.actor),
        ...((weekLoads ?? []) as { scanned_by: string }[]).map((r) => r.scanned_by),
        ...((weekBacks ?? []) as { returned_by: string }[]).map((r) => r.returned_by),
        ...((weekMoves ?? []) as { actor: string }[]).map((r) => r.actor)]);
      // A hand who loaded out a truck that's still out on a job is on
      // location with nothing to scan, not skipping the app.
      const outTrucks = [...new Set(out.filter((r) => r.unit_id && !r.out_with_name).map((r) => r.unit_id as string))];
      if (outTrucks.length) {
        const { data: lastLoads } = await admin.from("saas_loadout_scans").select("unit_id, scanned_by, finished_at").eq("company_id", c.id)
          .in("unit_id", outTrucks.slice(0, 300)).not("scanned_by", "is", null).order("finished_at", { ascending: false }).limit(1000);
        const seen = new Set<string>();
        for (const l of (lastLoads ?? []) as { unit_id: string; scanned_by: string }[]) {
          if (seen.has(l.unit_id)) continue;
          seen.add(l.unit_id);
          active.add(l.scanned_by);
        }
      }
      const hands = ((members ?? []) as { user_id: string; role: string }[]).filter((m) => m.role === "member");
      const idle: string[] = [];
      for (const m of hands.slice(0, 60)) {
        const { data } = await admin.auth.admin.getUserById(m.user_id);
        const n = (data?.user?.user_metadata?.full_name as string | undefined)?.trim() || data?.user?.email?.split("@")[0];
        if (n && !active.has(n)) idle.push(n);
      }

      const blocked: Line[] = loads.filter((l) => l.verdict !== "ready" && !ovIds.has(l.id)).map((l) => ({ yard: l.yard, text: `${l.unit_name}: ${blockedWhy(l.reasons)}` }));
      const overrides: Line[] = ovs.map((o) => ({ yard: ovTruck.get(o.loadout_id)?.yard ?? null, text: `${ovTruck.get(o.loadout_id)?.name ?? "A truck"} by ${o.by_name}: "${o.reason}"` }));
      const unscanned: Line[] = ((ev ?? []) as { message: string; unit_id: string | null }[]).map((e) => ({ yard: yardOf(e.unit_id), text: e.message }));
      const weekly = new Date().toLocaleDateString("en-US", { timeZone: YARD_TZ, weekday: "short" }) === "Mon";
      const allYards = [...yardName.keys()];

      /** The email for these yards (null: the whole company). With more than one yard in it, each truck line says which yard. */
      const pick = (yards: string[] | null): DaySummary => {
        const keep = (t: { yard: string | null }) => yards === null || (t.yard !== null && yards.includes(t.yard));
        const multi = (yards ?? allYards).length > 1;
        const show = (ts: Line[]) => ts.filter(keep).map((t) => (multi && !t.named && t.yard && yardName.has(t.yard) ? `${yardName.get(t.yard)}, ${t.text}` : t.text));
        const myLoads = loads.filter(keep);
        return {
          company: yards === null ? c.name : `${yards.map((y) => yardName.get(y) ?? "A yard").join(", ")} (${c.name})`,
          loadouts: myLoads.length,
          ready: myLoads.filter((l) => l.verdict === "ready").length,
          blocked: show(blocked),
          overrides: show(overrides),
          checkins: backs.filter(keep).length,
          unscanned: show(unscanned),
          late: show(late), stillBlocked: show(stillBlocked), outTooLong: show(outTooLong), damaged: show(damaged),
          toolsLow: show(toolsLow), cantRoll: show(cantRoll),
          redressWaiting: redress.filter(keep).length, redressNames: show(redress).slice(0, 5),
          noPaper: noPaper.filter(keep).length, noPaperNames: show(noPaper).slice(0, 5),
          // Whose crew is idle and what uploads wait on a manager are company-wide: the whole-company email only.
          uploadsWaiting: yards === null ? uploadsWaiting ?? 0 : 0,
          idle: yards === null ? idle : [], crew: yards === null ? hands.length : undefined,
          weekly,
        };
      };
      const send = async (to: string[], msg: { subject: string; body: string }, who: string) => {
        const ok = await sendEmail(to, msg.subject, `<pre style="font:14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">${escHtml(msg.body)}</pre>`);
        if (ok) res.sent++; else res.errors.push(`${c.name}: morning summary email${who} failed`);
      };

      const msg = summaryText(pick(null));
      if (!msg) { res.skipped++; continue; }
      // The whole company goes to the people on All yards (or the owners when nobody there takes email).
      const emails = (rs: Recipient[]) => rs.filter((r) => r.channels.includes("email") && r.email).map((r) => r.email as string);
      let to = emails(await resolveRecipients(c.id));
      if (!to.length) to = emails(await defaultRecipients(c.id));
      if (!to.length) res.errors.push(`${c.name}: no one to email the morning summary to`);
      else await send(to, msg, "");

      // Someone set to only some yards gets just those yards.
      const { data: yardOnly } = await admin.from("saas_alert_recipients").select("email, channels, yard_ids").eq("company_id", c.id).not("yard_ids", "is", null);
      const got = new Set(to.map((e) => e.toLowerCase()));
      const yardsOf = new Map<string, { email: string; yards: Set<string> }>();
      for (const r of (yardOnly ?? []) as { email: string | null; channels: string[]; yard_ids: string[] | null }[]) {
        if (!r.email || !r.channels.includes("email") || !r.yard_ids?.length || got.has(r.email.toLowerCase())) continue;
        const k = r.email.toLowerCase();
        const e = yardsOf.get(k) ?? { email: r.email, yards: new Set<string>() };
        for (const y of r.yard_ids) if (yardName.has(y)) e.yards.add(y);
        yardsOf.set(k, e);
      }
      const groups = new Map<string, { yards: string[]; to: string[] }>();
      for (const e of yardsOf.values()) {
        if (!e.yards.size) continue;
        const yards = [...e.yards].sort((a, b) => (yardName.get(a) ?? "").localeCompare(yardName.get(b) ?? ""));
        const g = groups.get(yards.join(",")) ?? { yards, to: [] };
        g.to.push(e.email);
        groups.set(yards.join(","), g);
      }
      for (const g of groups.values()) {
        const part = summaryText(pick(g.yards));
        if (part) await send(g.to, part, ` for ${g.yards.map((y) => yardName.get(y)).join(", ")}`);
      }
    } catch (e) {
      res.errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
