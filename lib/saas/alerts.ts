import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Expiration-alert sweep (Phase 8). For each company: find compliance items
 * expiring within its lead window that haven't been alerted yet, email a digest
 * to the recipients (or the company owners), and log alerts_sent so each item
 * only fires once. Email goes via Resend (works today — independent of the
 * Supabase Auth SMTP wiring).
 */
const FROM = "SYNNR <noreply@synnr.io>";

export interface AlertSweepResult {
  companies_scanned: number;
  items_due: number;
  emails_sent: number;
  items_logged: number;
  errors: string[];
}

function isoDay(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export async function sweepAlerts(admin: SupabaseClient): Promise<AlertSweepResult> {
  const res: AlertSweepResult = { companies_scanned: 0, items_due: 0, emails_sent: 0, items_logged: 0, errors: [] };

  const { data: companies, error: cErr } = await admin
    .from("saas_companies").select("id, name");
  if (cErr) { res.errors.push(`companies: ${cErr.message}`); return res; }

  const resendKey = process.env.RESEND_API_KEY;
  const today = new Date();
  const todayIso = isoDay(today);

  for (const company of (companies ?? []) as { id: string; name: string }[]) {
    res.companies_scanned++;

    // Settings (or defaults)
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

    // Items expiring within the window (includes already-expired, recent).
    const { data: itemsData } = await admin
      .from("saas_compliance_items")
      .select("id, title, kind, expiration_date")
      .eq("company_id", company.id)
      .not("expiration_date", "is", null)
      .lte("expiration_date", horizonIso);
    const items = (itemsData ?? []) as { id: string; title: string; kind: string; expiration_date: string }[];
    if (items.length === 0) continue;

    // Drop items already alerted by email.
    const { data: sentData } = await admin
      .from("saas_alerts_sent").select("compliance_item_id")
      .eq("company_id", company.id).eq("channel", "email");
    const sentIds = new Set(((sentData ?? []) as { compliance_item_id: string }[]).map((r) => r.compliance_item_id));
    const due = items.filter((i) => !sentIds.has(i.id));
    if (due.length === 0) continue;
    res.items_due += due.length;

    // Recipients: explicit, else company owners' emails.
    let recipients = (s?.recipients ?? []).filter(Boolean);
    if (recipients.length === 0) {
      const { data: owners } = await admin
        .from("saas_memberships").select("user_id").eq("company_id", company.id).eq("role", "owner").eq("status", "active");
      const ids = ((owners ?? []) as { user_id: string }[]).map((o) => o.user_id);
      for (const id of ids) {
        const { data: u } = await admin.auth.admin.getUserById(id);
        if (u?.user?.email) recipients.push(u.user.email);
      }
    }
    recipients = Array.from(new Set(recipients));
    if (recipients.length === 0) continue;

    // Send digest via Resend.
    let emailed = false;
    if (resendKey) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);
        const lines = due
          .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))
          .map((i) => {
            const overdue = i.expiration_date < todayIso;
            return `• ${i.title} — ${overdue ? "EXPIRED" : "expires"} ${i.expiration_date}`;
          });
        const text = [
          `${company.name}: ${due.length} item${due.length === 1 ? "" : "s"} need attention`,
          ``,
          ...lines,
          ``,
          `Open SYNNR to renew: ${process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io"}/app`,
        ].join("\n");
        const { error } = await resend.emails.send({
          from: FROM, to: recipients, subject: `[SYNNR] ${due.length} expiring — ${company.name}`, text,
        });
        emailed = !error;
        if (error) res.errors.push(`email ${company.id}: ${JSON.stringify(error)}`);
      } catch (e) {
        res.errors.push(`resend ${company.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    if (emailed) res.emails_sent++;

    // Log alerts_sent regardless of email success? Only on success, so a
    // failed send retries next run.
    if (emailed) {
      const rows = due.map((i) => ({ company_id: company.id, compliance_item_id: i.id, channel: "email" }));
      const { error: logErr } = await admin.from("saas_alerts_sent").insert(rows);
      if (logErr) res.errors.push(`log ${company.id}: ${logErr.message}`);
      else res.items_logged += rows.length;
    }
  }

  return res;
}
