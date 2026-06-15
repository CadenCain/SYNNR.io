/**
 * One-shot Stripe setup for TallyShot per-seat checkout.
 *
 * Creates (idempotently, via lookup_key) the TallyShot product + a per-seat
 * VOLUME-tiered recurring price that matches lib/catalog:
 *   1–9 seats $39 · 10–24 $34 · 25–49 $29 · 50+ $25  (whole-quantity volume pricing)
 * The 14-day trial is applied at checkout (trial_period_days), not on the price.
 * Overage ($0.05/sheet) is a separate metered price — add later, not needed to sell.
 *
 * Run it once per mode (test, then live after bank activation):
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs
 *
 * Then set the printed price id as STRIPE_PRICE_TALLYSHOT_SEAT in Vercel.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";
const LOOKUP_KEY = "tallyshot_seat";

const TIERS = [
  { up_to: 9, unit_amount: 3900 },
  { up_to: 24, unit_amount: 3400 },
  { up_to: 49, unit_amount: 2900 },
  { up_to: "inf", unit_amount: 2500 },
];

async function main() {
  console.log(`Stripe ${mode} mode — setting up TallyShot per-seat checkout…`);

  // reuse an existing price by lookup_key if we've run before
  const existing = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`\n✓ Price already exists: ${existing.data[0].id}`);
    printEnv(existing.data[0].id);
    return;
  }

  // find or create the product
  const products = await stripe.products.search({ query: `name:'TallyShot'` });
  const product =
    products.data[0] ??
    (await stripe.products.create({
      name: "TallyShot",
      description: "Photograph a handwritten tally sheet, get clean Excel back — every shaky digit flagged.",
    }));
  console.log(`Product: ${product.id}`);

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    recurring: { interval: "month", usage_type: "licensed" },
    billing_scheme: "tiered",
    tiers_mode: "volume",
    tiers: TIERS,
    lookup_key: LOOKUP_KEY,
    nickname: "TallyShot per-seat (volume)",
  });

  console.log(`\n✓ Created per-seat volume price: ${price.id}`);
  printEnv(price.id);
}

function printEnv(priceId) {
  console.log(`\nSet this in Vercel (${mode} env):`);
  console.log(`  STRIPE_PRICE_TALLYSHOT_SEAT=${priceId}`);
  console.log(`\nAlso needed for live checkout:`);
  console.log(`  STRIPE_SECRET_KEY=<your sk_...>`);
  console.log(`  STRIPE_WEBHOOK_SECRET=<from the webhook endpoint you add for /api/stripe/webhook>`);
}

main().catch((e) => { console.error(e); process.exit(1); });
