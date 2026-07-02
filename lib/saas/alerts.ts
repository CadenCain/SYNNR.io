import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSms, sendEmail } from "./notify";

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

function isoDay(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

interface DueItem { id: string; title: string; kind: string; expiration_date: string; parent_type: string; parent_id: string; yard_id: string | null }
interface Recip { name: string; email: string | null; phone: string | null; channels: string[]; yard_ids: string[] | null }

export async function sweepAlerts(admin: SupabaseClient): Promise<AlertSweepResult> {
  const res: AlertSweepResult = { companies_scanned: 0, items_due: 0, emails_sent: 0, sms_sent: 0, items_logged: 0, errors: [] };

  const { data: companies, error: cErr } = await admin.from("saas_companies").select("id, name");
  if (cErr) { res.errors.push(`companies: ${cErr.message}`); return res; }

  const today = new Date();
  const todayIso = isoDay(today);
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

    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + leadDays);
    const horizonIso = isoDay(horizon);

    const { data: itemsData } = await admin
      .from("saas_compliance_items")
      .select("id, title, kind, expiration_date, parent_type, parent_id")
      .eq("company_id", company.id)
      .not("expiration_date", "is", null)
      .lte("expiration_date", horizonIso);
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
      `${i.title}${i.parent_type === "crew" ? " (crew card)" : ""} — ${i.expiration_date < todayIso ? "EXPIRED" : "expires"} ${i.expiration_date}`;

    const emailedIds = new Set<string>();
    const smsedIds = new Set<string>();
    for (const r of recips) {
      const mine = due.filter((i) => i.yard_id === null || r.yard_ids === null || r.yard_ids.includes(i.yard_id));
      if (mine.length === 0) continue;
      const sorted = [...mine].sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

      if (r.channels.includes("email") && r.email) {
        const ok = await sendEmail(
          [r.email],
          `[SYNNR] ${sorted.length} expiring — ${company.name}`,
          `<pre style="font:14px/1.6 -apple-system,sans-serif;white-space:pre-wrap">${company.name}: ${sorted.length} item${sorted.length === 1 ? "" : "s"} need attention\n\n${sorted.map((i) => `• ${line(i)}`).join("\n")}\n\nOpen SYNNR to renew: ${appUrl}</pre>`,
        );
        if (ok) { res.emails_sent++; sorted.forEach((i) => emailedIds.add(i.id)); }
        else res.errors.push(`email ${company.id} → ${r.name}`);
      }
      if (r.channels.includes("sms") && r.phone) {
        const worst = sorted[0];
        const body = `SYNNR: ${line(worst)}${sorted.length > 1 ? ` +${sorted.length - 1} more` : ""}. ${appUrl} —${company.name}`;
        const ok = await sendSms(r.phone, body);
        if (ok) { res.sms_sent++; sorted.forEach((i) => smsedIds.add(i.id)); }
        else res.errors.push(`sms ${company.id} → ${r.name}`);
      }
    }

    const rows = [
      ...[...emailedIds].map((id) => ({ company_id: company.id, compliance_item_id: id, channel: "email" })),
      ...[...smsedIds].filter((id) => !emailedIds.has(id)).map((id) => ({ company_id: company.id, compliance_item_id: id, channel: "sms" })),
    ];
    if (rows.length > 0) {
      const { error: logErr } = await admin.from("saas_alerts_sent").insert(rows);
      if (logErr) res.errors.push(`log ${company.id}: ${logErr.message}`);
      else res.items_logged += rows.length;
    }
  }

  return res;
}
