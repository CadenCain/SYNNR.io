import { after } from "next/server";
import { sendEmail } from "./notify";
import { escHtml } from "./html";

/**
 * A heads-up to the person running SYNNR (NOTIFY_EMAIL): someone started
 * signing up, or paid. The sale depends on a call back the same day, so it
 * shouldn't wait for anyone to check Stripe. Sent after the response.
 */
export function tellOwner(subject: string, lines: (string | null | undefined)[]): void {
  const to = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
  const body = lines.filter(Boolean).map((l) => `<p style="margin:0 0 6px">${escHtml(String(l))}</p>`).join("");
  const send = async () => { await sendEmail([to], subject, `<div style="font:15px/1.5 -apple-system,sans-serif">${body}</div>`).catch(() => false); };
  try { after(send); } catch { void send(); }
}

/** "$1,500/month" for a yard count. */
export const monthly = (yards: number) => `$${(yards * 500).toLocaleString("en-US")}/month`;
