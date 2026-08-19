import { getStripe } from "@/lib/stripe";
import { saasAdmin } from "./db";
import { desiredYardQuantity, isBillableYard, yardBillingDrift, type BillingRow } from "./billing-rules";

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

    // Billable yards only — the built-in demo yard is free, so loading the
    // sample never bills anyone and clearing it never credits anyone.
    const { data: yardRows } = await admin
      .from("saas_yards").select("name").eq("company_id", companyId);
    const billable = ((yardRows ?? []) as { name: string }[]).filter((y) => isBillableYard(y.name)).length;
    const quantity = desiredYardQuantity(billable);

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
    // Visible, not just console: the shop's feed shows billing drifted from
    // the yard count instead of silently under/over-billing.
    const admin = saasAdmin();
    if (admin) {
      await admin.from("saas_events").insert({
        company_id: companyId, kind: "billing_sync_failed",
        message: "Couldn't update the subscription to match your yard count — billing may not match your yards. It'll retry on the next yard change.",
      });
    }
  }
}


/**
 * Nightly billed-vs-actual reconcile — the billing dead-man's switch. The
 * per-change sync above is best-effort by design (a Stripe hiccup must never
 * block a yard add), which means a failed sync IS possible and silent drift
 * is how a shop ends up watching 30 yards while paying for 9. This reads the
 * truth from both sides once a day and returns the discrepancies; the caller
 * (the watchdog cron) emails the operator.
 */
export async function reconcileYardBilling(): Promise<{ drift: (BillingRow & { expected: number })[]; checked: number; errors: string[] }> {
  const errors: string[] = [];
  const rows: BillingRow[] = [];
  const stripe = getStripe();
  const admin = saasAdmin();
  if (!stripe || !admin) return { drift: [], checked: 0, errors: ["stripe or db not configured"] };

  const { data: companies, error } = await admin
    .from("saas_companies")
    .select("id, name, stripe_subscription_id, subscription_status")
    .not("stripe_subscription_id", "is", null)
    .in("subscription_status", ["active", "past_due"]);
  if (error) return { drift: [], checked: 0, errors: [`companies: ${error.message}`] };

  for (const c of (companies ?? []) as { id: string; name: string; stripe_subscription_id: string }[]) {
    try {
      const [{ data: yardRows }, sub] = await Promise.all([
        admin.from("saas_yards").select("name").eq("company_id", c.id),
        stripe.subscriptions.retrieve(c.stripe_subscription_id),
      ]);
      const billableYards = ((yardRows ?? []) as { name: string }[]).filter((y) => isBillableYard(y.name)).length;
      rows.push({ companyName: c.name, stripeQuantity: sub.items.data[0]?.quantity ?? 0, billableYards });
    } catch (e) {
      // An unreadable company must be LOUD — "couldn't check" is not "in step".
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { drift: yardBillingDrift(rows), checked: rows.length, errors };
}