import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms, sendEmail } from "./notify";
import { localToday, addDaysIso } from "./status";

/**
 * Expiration-alert sweep. For each company: find compliance items (gear AND
 * crew cards — same table) expiring within the lead window that haven't been
 * alerted yet, then route to the recipient list:
 *   saas_alert_recipients — name + email + phone + yards covered + channels —
 *   so the foreman who rolls the truck gets the text, not just the owner.
 * Falls back to legacy notification_settings emails, then company owners.
 * Each item alerts once (any channel); failed sends retry next run.
 */
export interface AlertSweepResult {
  companies_scanned: number;
  items_due: number;
  emails_sent: number;
  sms_sent: number;
  items_logged: number;
  errors: string[];
}

interface DueItem { id: string; title: string; kind: string; expiration_date: string | null; parent_type: string; parent_id: string; yard_id: string | null }
interface Recip { name: string; email: string | null; phone: string | null; channels: string[]; yard_ids: string[] | null }

export async function sweepAlerts(admin: SupabaseClient): Promise<AlertSweepResult> {
  const res: AlertSweepResult = { companies_scanned: 0, items_due: 0, emails_sent: 0, sms_sent: 0, items_logged: 0, errors: [] };

  const { data: companies, error: cErr } = await admin.from("saas_companies").select("id, name");
  if (cErr) { res.errors.push(`companies: ${cErr.message}`); return res; }

  const todayIso = localToday(); // customers' local day (America/Chicago), matching the status view
  const appUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io"}/app`;

  for (const company of (companies ?? []) as { id: string; name: string }[]) {
    res.companies_scanned++;

    const { data: settings } = await admin
      .from("saas_notification_settings")
      .select("email_enabled, lead_days, recipients")
      .eq("company_id", company.id).maybeSingle();
    const s = settings as { email_enabled: boolean; lead_days: number; recipients: string[] } | null;
    if (s && s.email_enabled === false) continue;
    const leadDays = s?.lead_days ?? 30;

    const horizonIso = addDaysIso(todayIso, leadDays);

    // Due = expiring inside the window, already expired, OR no date on file
    // ("Missing" — unverifiable is failing; it alerts too).
    const { data: itemsData } = await admin
      .from("saas_compliance_items")
      .select("id, title, kind, expiration_date, parent_type, parent_id")
      .eq("company_id", company.id)
      .or(`expiration_date.lte.${horizonIso},expiration_date.is.null`);
    let due: DueItem[] = ((itemsData ?? []) as Omit<DueItem, "yard_id">[]).map((i) => ({ ...i, yard_id: null }));
    if (due.length === 0) continue;

    // Already-alerted (any channel) → skip.
    const { data: sentData } = await admin
      .from("saas_alerts_sent").select("compliance_item_id")
      .eq("company_id", company.id).not("compliance_item_id", "is", null);
    const sentIds = new Set(((sentData ?? []) as { compliance_item_id: string }[]).map((r) => r.compliance_item_id));
    due = due.filter((i) => !sentIds.has(i.id));
    if (due.length === 0) continue;
    res.items_due += due.length;

    // Resolve each item's yard for recipient scoping (crew cards → all yards).
    const [{ data: unitsData }, { data: assetsData }] = await Promise.all([
      admin.from("saas_units").select("id, yard_id").eq("company_id", company.id),
      admin.from("saas_assets").select("id, yard_id, unit_id").eq("company_id", company.id),
    ]);
    const unitYard = new Map(((unitsData ?? []) as { id: string; yard_id: string }[]).map((u) => [u.id, u.yard_id]));
    const assetRows = (assetsData ?? []) as { id: string; yard_id: string | null; unit_id: string | null }[];
    const assetYard = new Map(assetRows.map((a) => [a.id, a.yard_id ?? (a.unit_id ? unitYard.get(a.unit_id) ?? null : null)]));
    for (const i of due) {
      i.yard_id = i.parent_type === "unit" ? unitYard.get(i.parent_id) ?? null
        : i.parent_type === "asset" ? assetYard.get(i.parent_id) ?? null
        : null; // crew — company-wide
    }

    // Recipients: new routed table → legacy emails → owners.
    const { data: recipData } = await admin
      .from("saas_alert_recipients")
      .select("name, email, phone, channels, yard_ids")
      .eq("company_id", company.id);
    let recips = (recipData ?? []) as Recip[];
    if (recips.length === 0) {
      let legacy = (s?.recipients ?? []).filter(Boolean);
      if (legacy.length === 0) {
        const { data: owners } = await admin
          .from("saas_memberships").select("user_id").eq("company_id", company.id).eq("role", "owner").eq("status", "active");
        for (const o of (owners ?? []) as { user_id: string }[]) {
          const { data: u } = await admin.auth.admin.getUserById(o.user_id);
          if (u?.user?.email) legacy.push(u.user.email);
        }
      }
      legacy = Array.from(new Set(legacy));
      recips = legacy.map((email) => ({ name: email, email, phone: null, channels: ["email"], yard_ids: null }));
    }
    if (recips.length === 0) continue;

    const line = (i: DueItem) =>
      `${i.title}${i.parent_type === "crew" ? " (crew card)" : ""} — ${
        i.expiration_date === null ? "MISSING (no expiration on file)"
        : i.expiration_date < todayIso ? `EXPIRED ${i.expiration_date}` : `expires ${i.expiration_date}`}`;

    const emailedIds = new Set<string>();
    const smsedIds = new Set<string>();
    const recipientsByItem = new Map<string, Set<string>>();
    const noteRecip = (ids: Iterable<string>, who: string) => {
      for (const id of ids) recipientsByItem.set(id, new Set([...(recipientsByItem.get(id) ?? []), who]));
    };
    for (const r of recips) {
      const mine = due.filter((i) => i.yard_id === null || r.yard_ids === null || r.yard_ids.includes(i.yard_id));
      if (mine.length === 0) continue;
      const sorted = [...mine].sort((a, b) => (a.expiration_date ?? "0000").localeCompare(b.expiration_date ?? "0000"));

      if (r.channels.includes("email") && r.email) {
        const ok = await sendEmail(
          [r.email],
          `[RollReady] ${sorted.length} expiring — ${company.name}`,
          `<pre style="font:14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">${company.name}: ${sorted.length} item${sorted.length === 1 ? "" : "s"} need attention\n\n${sorted.map((i) => `• ${line(i)}`).join("\n")}\n\nOpen RollReady to renew: ${appUrl}</pre>`,
        );
        if (ok) { res.emails_sent++; sorted.forEach((i) => emailedIds.add(i.id)); noteRecip(sorted.map((i) => i.id), r.name); }
        else {
          res.errors.push(`email ${company.id} → ${r.name}`);
          await admin.from("saas_events").insert({ company_id: company.id, kind: "alert_failed", message: `Alert email to ${r.name} FAILED — ${sorted.length} item(s) not delivered. Will retry tomorrow.` });
        }
      }
      if (r.channels.includes("sms") && r.phone) {
        const worst = sorted[0];
        const body = `RollReady: ${line(worst)}${sorted.length > 1 ? ` +${sorted.length - 1} more` : ""}. ${appUrl} —${company.name}`;
        const ok = await sendSms(r.phone, body);
        if (ok) { res.sms_sent++; sorted.forEach((i) => smsedIds.add(i.id)); noteRecip(sorted.map((i) => i.id), r.name); }
        else {
          res.errors.push(`sms ${company.id} → ${r.name}`);
          await admin.from("saas_events").insert({ company_id: company.id, kind: "alert_failed", message: `Alert TEXT to ${r.name} FAILED — check the phone number in Settings → Notifications. Will retry tomorrow.` });
        }
      }
    }

    const who = (id: string) => [...(recipientsByItem.get(id) ?? [])].join(", ") || null;
    const rows = [
      ...[...emailedIds].map((id) => ({ company_id: company.id, compliance_item_id: id, channel: "email", recipient: who(id) })),
      ...[...smsedIds].filter((id) => !emailedIds.has(id)).map((id) => ({ company_id: company.id, compliance_item_id: id, channel: "sms", recipient: who(id) })),
    ];
    if (rows.length > 0) {
      const { error: logErr } = await admin.from("saas_alerts_sent").insert(rows);
      if (logErr) res.errors.push(`log ${company.id}: ${logErr.message}`);
      else res.items_logged += rows.length;
    }
  }

  return res;
}
