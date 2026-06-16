import { getStripe } from "@/lib/stripe";
import { getProduct } from "@/lib/catalog";

/** Stripe billing-meter event name for TallyShot overage sheets. */
export const OVERAGE_METER_EVENT = "tallyshot_overage_sheets";

/** Minimal shape we need from a Supabase client (server or admin). */
type DBClient = {
  from: (table: string) => {
    select: (cols: string, opts?: { count?: "exact"; head?: boolean }) => any;
  };
};

/** First-of-month ISO — the metered billing window (mirrors getOrgUsage). */
function periodStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Report the *marginal* overage to Stripe's billing meter after a sheet is
 * saved. The per-seat free pool is enforced in our own code, so the metered
 * Stripe price is a flat $/sheet with no Stripe-side free tier — we only meter
 * the unit(s) that spill past the pool. Best-effort: never throws, never blocks
 * the save. No-ops cleanly until STRIPE_PRICE_TALLYSHOT_METER is configured.
 */
export async function reportSheetOverage(
  supabase: DBClient,
  workspaceId: string,
  productSlug = "tallyshot"
): Promise<void> {
  try {
    const stripe = getStripe();
    if (!stripe || !process.env.STRIPE_PRICE_TALLYSHOT_METER) return; // metered billing not wired yet

    const product = getProduct(productSlug);
    const perSeat = product?.pricing.includedQuotaPerSeat ?? 0;
    if (!perSeat) return;

    const [{ data: sub }, { data: ws }, { count }] = await Promise.all([
      supabase.from("subscriptions").select("seats").eq("workspace_id", workspaceId).eq("product_slug", productSlug).maybeSingle(),
      supabase.from("workspaces").select("stripe_customer_id").eq("id", workspaceId).maybeSingle(),
      supabase.from("usage_events").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("product_slug", productSlug).gte("ts", periodStartISO()),
    ]);

    const customer = (ws as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    const seats = (sub as { seats?: number } | null)?.seats ?? 0;
    const pool = seats * perSeat;
    const usedAfter = count ?? 0;            // includes the sheet just saved
    const usedBefore = Math.max(0, usedAfter - 1);
    const delta = Math.max(0, usedAfter - pool) - Math.max(0, usedBefore - pool); // 0 or 1
    if (!customer || delta <= 0) return;

    await stripe.billing.meterEvents.create({
      event_name: OVERAGE_METER_EVENT,
      payload: { stripe_customer_id: customer, value: String(delta) },
    });
  } catch (e) {
    // Overage reporting must never break a save — log for observability.
    console.error("[overage] meter report failed", e instanceof Error ? e.message : e);
  }
}
