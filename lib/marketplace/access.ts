import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { canUseProduct, type EntitlementContext, type EntitlementCheck } from "@/lib/catalog";

/**
 * Server-side entitlement enforcement for the marketplace. The catalog's
 * canUseProduct() holds the rule; this loads the live state from Supabase
 * (the org's active subscriptions + the user's seat assignments) and runs it.
 *
 * Use requireProduct() at the top of every gated product route — UI gating is
 * not enough.
 */

export type SignedInOrg = {
  userId: string;
  email: string | null;
  workspaceId: string | null;
};

/** Resolve the signed-in user + their active workspace, or null if not signed in. */
export async function getSignedInOrg(): Promise<SignedInOrg | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  return { userId: auth.user.id, email: auth.user.email ?? null, workspaceId: profile?.workspace_id ?? null };
}

export type NavContext = { email: string | null; role: string; canManageTeam: boolean };

/** Lightweight identity + role for the top nav (null when signed out). */
export async function getNavContext(): Promise<NavContext | null> {
  const org = await getSignedInOrg();
  if (!org) return null;
  const supabase = await getServerSupabase();
  let role = "member";
  if (supabase && org.workspaceId) {
    const { data: m } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", org.userId)
      .eq("workspace_id", org.workspaceId)
      .maybeSingle();
    role = m?.role ?? "owner"; // legacy users with no membership row own their workspace
  }
  return { email: org.email, role, canManageTeam: role === "owner" || role === "admin" };
}

/** Load the org's active subs + this user's held seats into an EntitlementContext. */
export async function getEntitlementContext(org: SignedInOrg): Promise<EntitlementContext> {
  const supabase = await getServerSupabase();
  if (!supabase || !org.workspaceId) return { subscriptions: [], userSeatProducts: [] };

  const [{ data: subs }, { data: seats }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("product_slug, status, seats, current_period_end")
      .eq("workspace_id", org.workspaceId),
    supabase
      .from("seat_assignments")
      .select("product_slug")
      .eq("workspace_id", org.workspaceId)
      .eq("user_id", org.userId),
  ]);

  return {
    subscriptions: (subs ?? [])
      .filter((s) => !!s.product_slug)
      .map((s) => ({
        productSlug: s.product_slug as string,
        status: s.status ?? "",
        seats: s.seats ?? 0,
        periodEnd: s.current_period_end,
      })),
    userSeatProducts: (seats ?? []).map((s) => s.product_slug as string),
  };
}

/** Non-redirecting check — for rendering "you don't have a seat" states. */
export async function checkProductAccess(slug: string): Promise<{ org: SignedInOrg | null; check: EntitlementCheck }> {
  const org = await getSignedInOrg();
  if (!org) return { org: null, check: { allowed: false, via: null, reason: "Sign in to use this app." } };
  const ctx = await getEntitlementContext(org);
  return { org, check: canUseProduct(ctx, slug) };
}

/**
 * Hard gate for a product route. Redirects to /login when signed out; returns
 * the access result (with reason) when signed in so the page can show an
 * upgrade/seat prompt for the denied case.
 */
export async function requireProduct(slug: string): Promise<{ org: SignedInOrg; check: EntitlementCheck }> {
  const { org, check } = await checkProductAccess(slug);
  if (!org) redirect(`/login?next=/app/${slug}`);
  return { org, check };
}

/**
 * Gate for API routes — same rule, but returns a status/reason instead of
 * redirecting (so handlers can respond with JSON). 401 signed out, 403 no seat.
 */
export async function requireProductApi(
  slug: string
): Promise<{ ok: true; org: SignedInOrg } | { ok: false; status: number; reason: string }> {
  const { org, check } = await checkProductAccess(slug);
  if (!org) return { ok: false, status: 401, reason: "Sign in to use this app." };
  if (!check.allowed) return { ok: false, status: 403, reason: check.reason };
  return { ok: true, org };
}
