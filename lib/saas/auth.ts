import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Auth + tenancy helpers for the self-serve SaaS (saas_* tables).
 *
 * Every /app query runs through the cookie-aware server client (anon key +
 * the user's session) so RLS is the enforced tenant boundary — never the
 * service-role client. The saas_* tables aren't in the generated Database
 * type, so we use a loosely-typed client for them.
 */
async function saasServer(): Promise<SupabaseClient | null> {
  return (await getServerSupabase()) as unknown as SupabaseClient | null;
}

export interface ActiveCompany {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  subscription_status: string;
  yard_quantity: number;
}

/** Current signed-in user, or null. */
export async function getSaasUser(): Promise<User | null> {
  const sb = await saasServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

/** The user's first active company (Phase 2 = single company per user in
 *  practice). Returns null if they belong to none yet. */
export async function getFirstActiveCompany(userId: string): Promise<ActiveCompany | null> {
  const sb = await saasServer();
  if (!sb) return null;
  const { data } = await sb
    .from("saas_memberships")
    .select("role, company:saas_companies(id, name, subscription_status, yard_quantity)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  type CompanyRow = { id: string; name: string; subscription_status: string; yard_quantity: number };
  const row = data as unknown as { role: ActiveCompany["role"]; company: CompanyRow | CompanyRow[] | null };
  const company = Array.isArray(row.company) ? row.company[0] : row.company;
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    role: row.role,
    subscription_status: company.subscription_status,
    yard_quantity: company.yard_quantity,
  };
}

/** Gate helper for /app — returns {user, company} or redirects. */
export async function requireCompany(): Promise<{ user: User; company: ActiveCompany }> {
  const user = await getSaasUser();
  if (!user) redirect("/login");
  const company = await getFirstActiveCompany(user.id);
  if (!company) redirect("/onboarding");
  return { user, company };
}
