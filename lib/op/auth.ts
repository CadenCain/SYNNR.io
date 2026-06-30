import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Single-operator auth gate. The operator console at /op is for ONE person —
 * Caden. There's no roles/teams system; access is "is this session's email in
 * the allowlist." Allowlist is the OPERATOR_EMAILS env var (comma-separated,
 * lower-cased), with a sane fallback for local dev.
 *
 * Usage in a Server Component:
 *   const { email } = await requireOperator();
 *
 * Usage in a Route Handler:
 *   const operator = await getOperator();
 *   if (!operator) return new Response("Unauthorized", { status: 401 });
 */

function allowedEmails(): Set<string> {
  const raw = process.env.OPERATOR_EMAILS || "cadencain@darkstarops.com";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export interface Operator {
  userId: string;
  email: string;
}

/** Returns the current operator if signed in & allowlisted, otherwise null. */
export async function getOperator(): Promise<Operator | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user?.email) return null;
  const email = user.email.toLowerCase();
  if (!allowedEmails().has(email)) return null;
  return { userId: user.id, email };
}

/** Returns the operator or redirects to /op/login. Use at the top of every
 *  protected Server Component in /op/*. */
export async function requireOperator(): Promise<Operator> {
  const op = await getOperator();
  if (!op) redirect("/op/login");
  return op;
}

/** True if the email is on the allowlist — used by the login page so we don't
 *  trigger a magic-link email for randos. */
export function isAllowedOperatorEmail(email: string): boolean {
  return allowedEmails().has(email.trim().toLowerCase());
}
