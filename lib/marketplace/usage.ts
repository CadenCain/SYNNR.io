import { getServerSupabase } from "@/lib/supabase/server";
import { getProduct } from "@/lib/catalog";

/** First day of the current month, ISO — the metered billing window. */
function periodStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Short device label from a user-agent (for soft admin visibility, not a fingerprint). */
export function deviceLabel(ua: string | null): string {
  if (!ua) return "unknown";
  if (/iphone|android.*mobile/i.test(ua)) return "phone";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/macintosh|mac os/i.test(ua)) return "mac";
  if (/windows/i.test(ua)) return "windows";
  return "browser";
}

export type OrgUsage = {
  product: string;
  usedThisPeriod: number;
  seats: number;
  pooledQuota: number;
  overageUnits: number;
  overagePerUnitUsd: number;
  overageCostUsd: number;
  pctUsed: number;
};

/** Org's month-to-date sheet usage vs its pooled quota (seats × included). */
export async function getOrgUsage(workspaceId: string, productSlug = "tallyshot"): Promise<OrgUsage | null> {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const product = getProduct(productSlug);
  const perSeat = product?.pricing.includedQuotaPerSeat ?? 0;
  const overagePerUnitUsd = product?.pricing.overagePerUnitUsd ?? 0;

  const [{ data: sub }, { data: events }] = await Promise.all([
    supabase.from("subscriptions").select("seats, status").eq("workspace_id", workspaceId).eq("product_slug", productSlug).maybeSingle(),
    supabase.from("usage_events").select("qty").eq("workspace_id", workspaceId).eq("product_slug", productSlug).gte("ts", periodStartISO()),
  ]);

  const seats = sub?.seats ?? 0;
  const pooledQuota = seats * perSeat;
  const usedThisPeriod = (events ?? []).reduce((a, e) => a + (e.qty ?? 0), 0);
  const overageUnits = Math.max(0, usedThisPeriod - pooledQuota);
  return {
    product: productSlug,
    usedThisPeriod,
    seats,
    pooledQuota,
    overageUnits,
    overagePerUnitUsd,
    overageCostUsd: Math.round(overageUnits * overagePerUnitUsd * 100) / 100,
    pctUsed: pooledQuota > 0 ? Math.min(100, Math.round((usedThisPeriod / pooledQuota) * 100)) : 0,
  };
}

/** Per-user distinct device counts this week, for soft admin visibility on /team. */
export async function getDeviceActivity(workspaceId: string, productSlug = "tallyshot"): Promise<Record<string, number>> {
  const supabase = await getServerSupabase();
  if (!supabase) return {};
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data } = await supabase
    .from("usage_events")
    .select("user_id, device")
    .eq("workspace_id", workspaceId)
    .eq("product_slug", productSlug)
    .gte("ts", weekAgo);
  const byUser: Record<string, Set<string>> = {};
  for (const e of data ?? []) {
    if (!e.user_id) continue;
    (byUser[e.user_id] ??= new Set()).add(e.device || "unknown");
  }
  return Object.fromEntries(Object.entries(byUser).map(([u, set]) => [u, set.size]));
}
