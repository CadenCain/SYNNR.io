import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { isWritable, canPerform, roleBlockedMessage, type Action } from "./entitlements";

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
  npt_day_estimate: number;
  comped: boolean;
  is_demo: boolean;
}

/** Current signed-in user, or null. */
export async function getSaasUser(): Promise<User | null> {
  const sb = await saasServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}

type CompanyRow = { id: string; name: string; subscription_status: string; yard_quantity: number; npt_day_estimate: number; comped: boolean; is_demo: boolean };
type MembershipRow = { role: ActiveCompany["role"]; company: CompanyRow | CompanyRow[] | null };

function toActive(row: MembershipRow): ActiveCompany | null {
  const company = Array.isArray(row.company) ? row.company[0] : row.company;
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    role: row.role,
    subscription_status: company.subscription_status,
    yard_quantity: company.yard_quantity ?? 0,
    npt_day_estimate: company.npt_day_estimate ?? 10000,
    comped: company.comped ?? false,
    is_demo: company.is_demo ?? false,
  };
}

const MEMBERSHIP_SELECT = "role, company:saas_companies(id, name, subscription_status, yard_quantity, npt_day_estimate, comped, is_demo)";

/** Every company this user belongs to — feeds the switcher. */
export async function getUserCompanies(userId: string): Promise<ActiveCompany[]> {
  const sb = await saasServer();
  if (!sb) return [];
  const { data } = await sb
    .from("saas_memberships")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  return ((data ?? []) as unknown as MembershipRow[]).map(toActive).filter(Boolean) as ActiveCompany[];
}

/** The user's active company: the one they picked (cookie), else the first.
 *  The cookie is validated against a real membership — a forged id falls
 *  back instead of granting anything. */
export async function getFirstActiveCompany(userId: string): Promise<ActiveCompany | null> {
  const companies = await getUserCompanies(userId);
  if (companies.length === 0) return null;
  try {
    const { cookies } = await import("next/headers");
    const picked = (await cookies()).get("synnr_co")?.value;
    if (picked) {
      const match = companies.find((c) => c.id === picked);
      if (match) return match;
    }
  } catch { /* outside a request scope — first company wins */ }
  return companies[0];
}

/** Gate helper for /app — returns {user, company} or redirects. */
export async function requireCompany(): Promise<{ user: User; company: ActiveCompany }> {
  const user = await getSaasUser();
  if (!user) redirect("/login");
  const company = await getFirstActiveCompany(user.id);
  if (!company) redirect("/onboarding");
  return { user, company };
}


/**
 * Gate for actions that CREATE billable records (yards, units, assets, certs,
 * crew). The app layout already redirects unsubscribed accounts, but server
 * actions are directly invokable endpoints — without this, a canceled account
 * could keep writing through the API while the UI said no. Read and export
 * stay open in every state: their data is theirs.
 */
export async function requireBillableCompany(): Promise<{ user: User; company: ActiveCompany }> {
  const got = await requireCompany();
  if (!isWritable(got.company.subscription_status, got.company.comped)) redirect("/app/settings/billing?locked=1");
  return got;
}

/** Same gate for actions that return JSON instead of redirecting. */
export async function requireWritableCompany(): Promise<
  { ok: true; user: User; company: ActiveCompany } | { ok: false; error: string }
> {
  const got = await requireCompany();
  if (!isWritable(got.company.subscription_status, got.company.comped)) {
    return { ok: false, error: "Subscription paused — your records are safe and exportable. Update billing to edit again." };
  }
  return { ok: true, ...got };
}

/** Role wall for destructive/management actions — throws the friendly message, which
 *  the app's error boundary shows, instead of silently no-op'ing. */
export function assertCan(company: ActiveCompany, action: Action): void {
  if (!canPerform(company.role, action)) throw new Error(roleBlockedMessage(action));
}
