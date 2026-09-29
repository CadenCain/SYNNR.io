import type { User } from "@supabase/supabase-js";
import { getSaasUser, getFirstActiveCompany, type ActiveCompany } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";

/** JSON-friendly auth for the cert endpoints: no redirects, just a reason. */
export async function certCaller(): Promise<
  { ok: true; user: User; company: ActiveCompany; name: string | null } | { ok: false; status: number; error: string }
> {
  const user = await getSaasUser();
  if (!user) return { ok: false, status: 401, error: "You're signed out. Sign in and try again." };
  const company = await getFirstActiveCompany(user.id);
  if (!company) return { ok: false, status: 403, error: "You're not in a yard yet." };
  if (!isWritable(company.subscription_status, company.comped)) {
    return { ok: false, status: 402, error: "The subscription is paused. Records are safe, but nothing can change until billing is fixed." };
  }
  const name = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
  return { ok: true, user, company, name };
}
