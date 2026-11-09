import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./notify";
import { escHtml } from "./html";

/**
 * Password reset, sent by the app (not the auth provider's mailer) so it
 * reaches real inboxes, and with a link the server checks itself, so it
 * works on whatever phone or browser opens the email: the one a hand asked
 * from, Safari, or the home-screen app. The link works once.
 *
 * Never says whether an email has a login, and sends at most three an hour
 * to one address, so the form can't be used to flood someone's inbox.
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.synnr.io";
const PER_HOUR = 3;

export const emailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");

/** A path inside the app to go on to, or "" (never another site). */
export const safeNext = (n: unknown) => {
  const s = String(n ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") && s.length < 300 ? s : "";
};

/** The link in the email: /auth/confirm checks the token and signs them in to
 *  set a new password, then on to where they were headed (an invite, a truck). */
export const resetLink = (tokenHash: string, next = "") =>
  `${SITE}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=${encodeURIComponent(safeNext(next) ? `/reset?next=${encodeURIComponent(safeNext(next))}` : "/reset")}`;

export function resetEmailHtml(link: string, name?: string | null): string {
  const hi = name?.trim() ? `Hi ${escHtml(name.trim().split(/\s+/)[0])},` : "Hi,";
  return `<div style="font:16px/1.6 -apple-system,Segoe UI,sans-serif;color:#0f172a;max-width:480px">
<p>${hi}</p>
<p>Someone asked to reset the password for your RollReady login. Tap the button to set a new one.</p>
<p style="margin:24px 0"><a href="${escHtml(link)}" style="display:inline-block;background:#2f5ff0;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">Set a new password</a></p>
<p style="color:#475569;font-size:14px">The link works once and runs out soon. If you didn't ask for this, ignore it and nothing changes.</p>
<p style="color:#64748b;font-size:13px">RollReady by SYNNR</p>
</div>`;
}

/**
 * Send a reset email if `email` has a login and hasn't had three in the last
 * hour. Returns what happened, for the server's own use only: callers show
 * the same message either way.
 */
export async function sendPasswordReset(admin: SupabaseClient, email: string, next = ""): Promise<"sent" | "skipped" | "failed"> {
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || clean.endsWith("@demo.synnr.io")) return "skipped";
  const hash = emailHash(clean);
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { count } = await admin.from("saas_reset_requests").select("id", { count: "exact", head: true })
    .eq("email_hash", hash).gte("created_at", since);
  if ((count ?? 0) >= PER_HOUR) return "skipped";
  await admin.from("saas_reset_requests").insert({ email_hash: hash });

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email: clean });
  const token = data?.properties?.hashed_token;
  if (error || !token) return "skipped"; // no login with that email
  const name = data.user?.user_metadata?.full_name as string | undefined;
  const ok = await sendEmail([clean], "Reset your RollReady password", resetEmailHtml(resetLink(token, next), name));
  return ok ? "sent" : "failed";
}
