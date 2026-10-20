import type Stripe from "stripe";
import { PER_YARD_CENTS, YARD_PRICE_LOOKUP_KEY, YARD_PRODUCT_NAME, isYardPrice } from "./plan";

/**
 * The two things Stripe has to have set up for RollReady, made by the app
 * itself so nobody has to paste a price id into Vercel and get it wrong:
 *
 *   The price: "RollReady Yard", $500 USD per yard per month, found by its
 *   lookup key. If it doesn't exist (a fresh Stripe account, or test mode),
 *   it's made. If something under that key isn't $500 a month, checkout
 *   refuses rather than sell at the wrong price.
 *
 *   The billing portal: card, invoices, billing details, and cancel. Yard
 *   count changes stay in the app (Settings, Billing and the Yards page),
 *   where the yard limit and "you can't drop below the yards you use" are
 *   enforced, so the portal can't change quantity behind them.
 *
 * Both are cached per server instance and per Stripe key (test vs live).
 */

const priceCache = new Map<string, string>();
const portalCache = new Map<string, string>();
const keyOf = () => (process.env.STRIPE_SECRET_KEY ?? "").slice(0, 12);

export async function yardPriceId(stripe: Stripe): Promise<string> {
  const k = keyOf();
  const hit = priceCache.get(k);
  if (hit) return hit;
  const find = async () => (await stripe.prices.list({ lookup_keys: [YARD_PRICE_LOOKUP_KEY], active: true, limit: 1 })).data[0] ?? null;
  let price = await find();
  if (!price) {
    const product = await stripe.products.create({
      name: YARD_PRODUCT_NAME,
      description: "RollReady load-out readiness for one yard: whole crew, every truck, never per-seat.",
      metadata: { app: "rollready" },
    });
    try {
      price = await stripe.prices.create({
        product: product.id,
        currency: "usd",
        unit_amount: PER_YARD_CENTS,
        recurring: { interval: "month", usage_type: "licensed" },
        lookup_key: YARD_PRICE_LOOKUP_KEY,
        nickname: "$500 per yard per month",
        metadata: { app: "rollready" },
      });
    } catch {
      // Two first checkouts at once: the other one made it. Use theirs.
      await stripe.products.update(product.id, { active: false }).catch(() => {});
      price = await find();
    }
  }
  if (!price || !isYardPrice(price)) {
    throw new Error(`The Stripe price "${YARD_PRICE_LOOKUP_KEY}" isn't $500 a month per yard. Fix it in Stripe before taking payments.`);
  }
  priceCache.set(k, price.id);
  return price.id;
}

export async function portalConfigurationId(stripe: Stripe): Promise<string> {
  const k = keyOf();
  const hit = portalCache.get(k);
  if (hit) return hit;
  const list = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  let conf = list.data.find((c) => c.metadata?.app === "rollready" && c.metadata?.version === "1") ?? null;
  if (!conf) {
    conf = await stripe.billingPortal.configurations.create({
      name: "RollReady: card, invoices, cancel (yards change in the app)",
      business_profile: {
        headline: "RollReady billing. Add or remove yards in RollReady, under Settings, Billing.",
        privacy_policy_url: "https://www.synnr.io/legal/privacy",
        terms_of_service_url: "https://www.synnr.io/legal/terms",
      },
      features: {
        customer_update: { enabled: true, allowed_updates: ["name", "email", "address", "phone"] },
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: {
          enabled: true,
          mode: "at_period_end",
          cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "switched_service", "unused", "other"] },
        },
        subscription_update: { enabled: false },
      },
      metadata: { app: "rollready", version: "1" },
    });
  }
  portalCache.set(k, conf.id);
  return conf.id;
}
