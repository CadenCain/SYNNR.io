import { after } from "next/server";
import { saasAdmin } from "./db";

/**
 * Run work after the response is sent: the phone isn't kept waiting, and the
 * platform keeps the function alive until it's done (a bare floating promise
 * can be cut off). Outside a request (tests, scripts) it just runs.
 */
function later(work: () => Promise<void>): Promise<void> {
  try { after(work); return Promise.resolve(); } catch { return work(); }
}

/** Send an email through Resend. No key set means nothing is sent and it says so (false). */
export async function sendEmail(to: string[], subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.ALERTS_FROM_EMAIL || "SYNNR <alerts@synnr.io>",
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

/** Append to the activity feed, after the response (see later). */
export function logEvent(args: {
  companyId: string;
  kind: string;
  message: string;
  unitId?: string | null;
  actor?: string | null;
}): Promise<void> {
  return later(() => writeEvent(args));
}

/** Append to the feed and wait for it, for when the next page should already have it. */
export function logEventNow(args: {
  companyId: string;
  kind: string;
  message: string;
  unitId?: string | null;
  actor?: string | null;
}): Promise<void> {
  return writeEvent(args);
}

async function writeEvent(args: { companyId: string; kind: string; message: string; unitId?: string | null; actor?: string | null }): Promise<void> {
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
