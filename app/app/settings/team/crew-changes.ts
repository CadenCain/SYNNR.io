import type { SupabaseClient } from "@supabase/supabase-js";
import { isWritable } from "@/lib/saas/entitlements";
import { isAllowedOperatorEmail } from "@/lib/op/auth";

/**
 * What has to happen around taking someone off the crew, and fixing a
 * hand's login email. Kept out of the page so it can be tested. The page's
 * server actions do the role checks and call these with the company's own id.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How many days a crew link is good for. */
export const CREW_LINK_DAYS = 30;

/**
 * Off the crew: the crew link they had turns over, so they can't make a new
 * login and walk back on with it. The old link stops working and a fresh one
 * takes its place (only while the account can add people). Anyone who
 * already joined stays on. "new": turned over to a fresh link; "off": the
 * old one is off and there's no new one; null: there was no link.
 */
export async function turnOverCrewLink(
  db: SupabaseClient,
  company: { id: string; subscription_status: string; comped: boolean },
): Promise<"new" | "off" | null> {
  const { data } = await db.from("saas_invitations").select("id")
    .eq("company_id", company.id).eq("multi_use", true).eq("status", "pending");
  if (!((data ?? []) as unknown[]).length) return null;
  await db.from("saas_invitations").update({ status: "revoked" })
    .eq("company_id", company.id).eq("multi_use", true).eq("status", "pending");
  if (!isWritable(company.subscription_status, company.comped)) return "off";
  const expires_at = new Date(Date.now() + CREW_LINK_DAYS * 86400e3).toISOString();
  const { error } = await db.from("saas_invitations").insert({ company_id: company.id, role: "member", multi_use: true, expires_at });
  return error ? "off" : "new";
}

/**
 * Off the crew means off the alert emails too: the list is typed emails, not
 * logins, so their address would keep getting every yard's morning email.
 * Returns how many lines came off.
 */
export async function dropAlertRecipient(admin: SupabaseClient, companyId: string, email: string | null): Promise<number> {
  const want = email?.trim().toLowerCase();
  if (!want) return 0;
  const { data } = await admin.from("saas_alert_recipients").select("id, email").eq("company_id", companyId);
  const ids = ((data ?? []) as { id: string; email: string | null }[])
    .filter((r) => r.email?.trim().toLowerCase() === want).map((r) => r.id);
  if (!ids.length) return 0;
  await admin.from("saas_alert_recipients").delete().eq("company_id", companyId).in("id", ids);
  return ids.length;
}

/** Proof links this person made that still work, so the manager can decide to shut them off. */
export async function liveProofLinksBy(admin: SupabaseClient, companyId: string, userId: string): Promise<number> {
  const { count } = await admin.from("saas_readiness_proofs").select("id", { count: "exact", head: true })
    .eq("company_id", companyId).eq("created_by", userId).is("revoked_at", null);
  return count ?? 0;
}

/**
 * A manager fixes a typo in someone's login email (a hand, or for the owner,
 * a manager too). Only for someone whose login is on this crew alone: a login
 * on another company's crew too isn't this company's to change.
 */
export async function changeLoginEmail(
  admin: SupabaseClient, companyId: string, userId: string, raw: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const email = raw.trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) return { ok: false, error: "That email doesn't look right." };
  if (isAllowedOperatorEmail(email)) return { ok: false, error: "That email can't be used for a crew login." };
  const { data: mem } = await admin.from("saas_memberships").select("company_id")
    .eq("user_id", userId).eq("status", "active");
  const crews = ((mem ?? []) as { company_id: string }[]).map((m) => m.company_id);
  if (!crews.includes(companyId)) return { ok: false, error: "They aren't on the crew anymore." };
  if (crews.some((c) => c !== companyId)) {
    return { ok: false, error: "Their login is on another company's crew too, so only they can change it. Ask Caden at cadencain@synnr.io." };
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) {
    return { ok: false, error: /already|exists|registered/i.test(error.message) ? "That email already has a login." : "Couldn't change the email. Try again." };
  }
  return { ok: true, email };
}

/** The line shown after someone comes off the crew, in plain words. */
export function offCrewNotice(n: { link: "new" | "off" | null; alerts: number; links: number }): string {
  const parts = ["Taken off the crew."];
  if (n.link === "new") parts.push("The crew link turned over: the old one stopped working. Send the new one below to anyone who hasn't joined yet.");
  if (n.link === "off") parts.push("The crew link they had stopped working.");
  return parts.join(" ");
}
