import { getStripe } from "@/lib/stripe";
import { saasAdmin } from "./db";

/**
 * Keep the Stripe subscription quantity in lockstep with the company's active
 * yard count (pricing is per-yard). Called after yard create/delete.
 *
 * Best-effort by design: a Stripe hiccup must never block a shop from adding
 * or removing a yard — we log and move on. Prorations are created so mid-cycle
 * changes bill fairly.
 */
export async function syncYardQuantity(companyId: string): Promise<void> {
  try {
    const stripe = getStripe();
    const admin = saasAdmin();
    if (!stripe || !admin) return;

    const { data } = await admin
      .from("saas_companies")
      .select("stripe_subscription_id, subscription_status")
      .eq("id", companyId)
      .maybeSingle();
    const c = data as { stripe_subscription_id: string | null; subscription_status: string } | null;
    if (!c?.stripe_subscription_id) return; // not subscribed yet — checkout picks up the live count
    if (c.subscription_status !== "active" && c.subscription_status !== "past_due") return;

    const { count } = await admin
      .from("saas_yards")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    const quantity = Math.max(1, count ?? 1);

    const sub = await stripe.subscriptions.retrieve(c.stripe_subscription_id);
    const item = sub.items.data[0];
    if (!item || item.quantity === quantity) return;

    await stripe.subscriptions.update(c.stripe_subscription_id, {
      items: [{ id: item.id, quantity }],
      proration_behavior: "create_prorations",
    });
    await admin.from("saas_companies").update({ yard_quantity: quantity }).eq("id", companyId);
  } catch (e) {
    console.error("[billing] yard quantity sync failed:", e instanceof Error ? e.message : e);
  }
}
