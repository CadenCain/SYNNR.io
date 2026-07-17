import { saasAdmin } from "./db";

/**
 * Outbound notifications: email (Resend) + SMS (Twilio) behind one interface.
 * SMS copy is short and blunt on purpose — it's read on a phone in a yard:
 *   "SYNNR: hu-179 rolled out NOT ready — BOP missing. —renegade"
 *
 * Twilio is wired via plain REST (no SDK dep). Missing env = SMS silently
 * skipped (email still goes) so nothing blocks before credentials land:
 *   TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM (E.164)
 */

export interface Recipient {
  name: string;
  email: string | null;
  phone: string | null;
  channels: string[];      // email|sms
  yard_ids: string[] | null; // null = all yards
}

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) return false;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) console.error("[notify] twilio", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("[notify] twilio error:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERTS_FROM_EMAIL || "RollReady Alerts <alerts@synnr.io>",
        to,
        subject,
        html,
      }),
    });
    if (!res.ok) console.error("[notify] resend", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.error("[notify] resend error:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Recipients for a company, optionally scoped to a yard. Falls back to the
 *  legacy notification_settings emails, then company owners. */
export async function resolveRecipients(companyId: string, yardId?: string | null): Promise<Recipient[]> {
  const admin = saasAdmin();
  if (!admin) return [];
  const { data } = await admin
    .from("saas_alert_recipients")
    .select("name, email, phone, channels, yard_ids")
    .eq("company_id", companyId);
  let recips = ((data ?? []) as Recipient[]).filter(
    (r) => !yardId || r.yard_ids === null || r.yard_ids.includes(yardId),
  );
  if (recips.length > 0) return recips;

  // Legacy fallback: notification_settings.recipients (emails), then owners.
  const { data: s } = await admin
    .from("saas_notification_settings").select("recipients").eq("company_id", companyId).maybeSingle();
  const legacy = ((s as { recipients: string[] } | null)?.recipients ?? []).filter(Boolean);
  if (legacy.length > 0) {
    return legacy.map((email) => ({ name: email, email, phone: null, channels: ["email"], yard_ids: null }));
  }
  const { data: owners } = await admin
    .from("saas_memberships").select("user_id").eq("company_id", companyId).eq("role", "owner").eq("status", "active");
  recips = [];
  for (const o of (owners ?? []) as { user_id: string }[]) {
    const { data: u } = await admin.auth.admin.getUserById(o.user_id);
    if (u?.user?.email) recips.push({ name: u.user.email, email: u.user.email, phone: null, channels: ["email"], yard_ids: null });
  }
  return recips;
}

/**
 * Fire an event alert NOW (override roll-out, gear not returned) — not the
 * daily digest. Fire-and-forget from server actions: never throws, never
 * blocks the save. Logs every send to saas_alerts_sent (label, channel).
 */
export async function notifyEvent(args: {
  companyId: string;
  companyName: string;
  yardId?: string | null;
  message: string;          // "hu-179 rolled out NOT ready — BOP missing"
}): Promise<void> {
  try {
    const admin = saasAdmin();
    if (!admin) return;
    const recips = await resolveRecipients(args.companyId, args.yardId);
    if (recips.length === 0) return;

    const sms = `RollReady: ${args.message}. —${args.companyName}`;
    const emails = recips.filter((r) => r.channels.includes("email") && r.email).map((r) => r.email as string);
    const phones = recips.filter((r) => r.channels.includes("sms") && r.phone).map((r) => r.phone as string);

    const emailNames = recips.filter((r) => r.channels.includes("email") && r.email).map((r) => r.name);
    const smsRecips = recips.filter((r) => r.channels.includes("sms") && r.phone);
    const sends: { channel: string; recipient: string }[] = [];
    if (emails.length) {
      const ok = await sendEmail(emails, `RollReady alert — ${args.message}`,
        `<p style="font:14px/1.5 -apple-system,sans-serif">${args.message}</p><p style="font:12px/1.5 -apple-system,sans-serif;color:#888">${args.companyName} · <a href="https://www.synnr.io/app">open RollReady</a></p>`);
      if (ok) sends.push({ channel: "email", recipient: emailNames.join(", ") });
      else await admin.from("saas_events").insert({ company_id: args.companyId, kind: "alert_failed", message: `Instant alert email FAILED (${emailNames.join(", ")}): ${args.message}` });
    }
    for (const r of smsRecips) {
      const ok = await sendSms(r.phone as string, sms);
      if (ok) sends.push({ channel: "sms", recipient: r.name });
      else if (smsConfigured()) await admin.from("saas_events").insert({ company_id: args.companyId, kind: "alert_failed", message: `Instant alert TEXT to ${r.name} FAILED — check the phone number. ${args.message}` });
    }
    if (sends.length) {
      await admin.from("saas_alerts_sent").insert(
        sends.map((x) => ({ company_id: args.companyId, compliance_item_id: null, channel: x.channel, label: args.message, recipient: x.recipient })),
      );
    }
  } catch (e) {
    console.error("[notify] event alert failed:", e instanceof Error ? e.message : e);
  }
}

/** Append to the command-center activity stream. Fire-and-forget. */
export async function logEvent(args: {
  companyId: string;
  kind: string;
  message: string;
  unitId?: string | null;
  actor?: string | null;
}): Promise<void> {
  try {
    const admin = saasAdmin();
    if (!admin) return;
    await admin.from("saas_events").insert({
      company_id: args.companyId,
      kind: args.kind,
      message: args.message,
      unit_id: args.unitId ?? null,
      actor: args.actor ?? null,
    });
  } catch (e) {
    console.error("[events] log failed:", e instanceof Error ? e.message : e);
  }
}
