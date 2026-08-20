import { getStripe } from "@/lib/stripe";
import { saasAdmin } from "./db";
import { isBillableYard } from "./billing-rules";

/**
 * OWNER'S MODEL CHANGE (spec 2026-08-19): the checkout quantity is a HARD
 * CAP — a paid allowance yards must fit under — not a number that follows
 * the yard count. No yard action ever silently moves the bill; allowance
 * changes happen only through setYardAllowance below, and the webhook mirrors
 * Stripe's quantity into the yard_quantity column as the cached truth.
 */

/**
 * Explicit allowance change — the ONLY thing that moves the bill. Raising
 * prorates from today; lowering below yards-in-use is refused by the caller
 * (canLowerAllowance) before this runs. Returns the new allowance or an error
 * string a human can read. If Stripe fails, nothing changes anywhere.
 */
export async function setYardAllowance(companyId: string, newAllowance: number): Promise<{ ok: true; allowance: number } | { ok: false; error: string }> {
  const stripe = getStripe();
  const admin = saasAdmin();
  if (!stripe || !admin) return { ok: false, error: "Billing isn't configured." };
  if (newAllowance < 1) return { ok: false, error: "The minimum plan is one yard." };

  const { data } = await admin
    .from("saas_companies")
    .select("stripe_subscription_id, subscription_status, comped")
    .eq("id", companyId).maybeSingle();
  const c = data as { stripe_subscription_id: string | null; subscription_status: string; comped: boolean } | null;
  if (!c) return { ok: false, error: "Company not found." };
  if (c.comped) return { ok: false, error: "This account is comped — there's no subscription to change." };
  if (!c.stripe_subscription_id) return { ok: false, error: "No subscription yet — subscribe first." };

  try {
    const sub = await stripe.subscriptions.retrieve(c.stripe_subscription_id);
    const item = sub.items.data[0];
    if (!item) return { ok: false, error: "Subscription has no line item — contact support." };
    if (item.quantity !== newAllowance) {
      await stripe.subscriptions.update(c.stripe_subscription_id, {
        items: [{ id: item.id, quantity: newAllowance }],
        proration_behavior: "create_prorations",
      });
    }
    await admin.from("saas_companies").update({ yard_quantity: newAllowance }).eq("id", companyId);
    return { ok: true, allowance: newAllowance };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Stripe update failed." };
  }
}

/** Billable yards in use — the number the cap compares against. */
export async function billableYardCount(companyId: string): Promise<number> {
  const admin = saasAdmin();
  if (!admin) return 0;
  const { data } = await admin.from("saas_yards").select("name").eq("company_id", companyId);
  return ((data ?? []) as { name: string }[]).filter((y) => isBillableYard(y.name)).length;
}
/**
 * Nightly reconcile under the hard cap. Two disagreements matter:
 *   1. Stripe's quantity vs the yard_quantity column — a sync bug.
 *   2. Billable yards in use vs the allowance — a CAP VIOLATION: someone is
 *      running more yards than they pay for.
 * Comped companies are skipped. The watchdog cron emails whatever comes back.
 */
export async function reconcileYardBilling(): Promise<{ issues: string[]; checked: number; errors: string[] }> {
  const issues: string[] = [];
  const errors: string[] = [];
  const stripe = getStripe();
  const admin = saasAdmin();
  if (!stripe || !admin) return { issues, checked: 0, errors: ["stripe or db not configured"] };

  const { data: companies, error } = await admin
    .from("saas_companies")
    .select("id, name, stripe_subscription_id, yard_quantity, comped")
    .not("stripe_subscription_id", "is", null)
    .eq("comped", false)
    .in("subscription_status", ["active", "past_due"]);
  if (error) return { issues, checked: 0, errors: [`companies: ${error.message}`] };

  let checked = 0;
  for (const c of (companies ?? []) as { id: string; name: string; stripe_subscription_id: string; yard_quantity: number }[]) {
    try {
      const [{ data: yardRows }, sub] = await Promise.all([
        admin.from("saas_yards").select("name").eq("company_id", c.id),
        stripe.subscriptions.retrieve(c.stripe_subscription_id),
      ]);
      checked++;
      const inUse = ((yardRows ?? []) as { name: string }[]).filter((y) => isBillableYard(y.name)).length;
      const stripeQty = sub.items.data[0]?.quantity ?? 0;
      if (stripeQty !== c.yard_quantity) {
        issues.push(`${c.name}: Stripe bills ${stripeQty} but the app thinks the plan is ${c.yard_quantity} (column drift)`);
      }
      if (inUse > stripeQty) {
        issues.push(`${c.name}: running ${inUse} billable yard(s) on a ${stripeQty}-yard plan (CAP VIOLATION — free yards)`);
      }
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { issues, checked, errors };
}
