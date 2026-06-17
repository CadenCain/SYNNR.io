/**
 * One-shot Stripe setup for TallyShot OVERAGE metering.
 *
 * Creates (idempotently):
 *   1. a Billing Meter — event_name `tallyshot_overage_sheets`, Sum aggregation,
 *      value read from payload key `value`, mapped to a customer by Stripe id.
 *   2. a $1.00 / unit METERED recurring price on the TallyShot product, tied to
 *      that meter (flat per-unit — the per-seat free pool is enforced in our own
 *      code, so we only ever report the units that spill past it).
 *
 * The app reports overage with stripe.billing.meterEvents.create({ event_name,
 * payload: { stripe_customer_id, value } }) — see lib/marketplace/billing.ts.
 *
 * Run once per mode (matching whichever key your Vercel env uses — live, here):
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-meter.mjs
 *
 * Then set the printed price id as STRIPE_PRICE_TALLYSHOT_METER in Vercel and
 * redeploy. New checkouts then carry the metered item automatically.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first:  STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-meter.mjs");
  process.exit(1);
}
const stripe = new Stripe(key);
const mode = key.startsWith("sk_live") ? "LIVE" : "TEST";

const EVENT_NAME = "tallyshot_overage_sheets"; // must match OVERAGE_METER_EVENT in lib/marketplace/billing.ts
const PRICE_LOOKUP_KEY = "tallyshot_overage";
const UNIT_AMOUNT = 100; // $1.00 / sheet, in cents

async function findMeter() {
  // Meters can't be filtered by event_name server-side; page through actives.
  for await (const m of stripe.billing.meters.list({ status: "active", limit: 100 })) {
    if (m.event_name === EVENT_NAME) return m;
  }
  return null;
}

async function main() {
  console.log(`Stripe ${mode} mode — setting up TallyShot overage metering…`);

  // 1) Meter (reuse if it already exists for this event name)
  let meter = await findMeter();
  if (meter) {
    console.log(`✓ Meter already exists: ${meter.id} (${meter.event_name})`);
  } else {
    meter = await stripe.billing.meters.create({
      display_name: "TallyShot overage sheets",
      event_name: EVENT_NAME,
      default_aggregation: { formula: "sum" },
      value_settings: { event_payload_key: "value" },
      customer_mapping: { type: "by_id", event_payload_key: "stripe_customer_id" },
    });
    console.log(`✓ Created meter: ${meter.id} (${meter.event_name})`);
  }

  // 2) Metered price (reuse by lookup_key)
  const existing = await stripe.prices.list({ lookup_keys: [PRICE_LOOKUP_KEY], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`✓ Overage price already exists: ${existing.data[0].id}`);
    return printEnv(existing.data[0].id);
  }

  const products = await stripe.products.search({ query: `name:'TallyShot'` });
  const product = products.data[0];
  if (!product) {
    console.error("No TallyShot product found — run `npm run stripe:setup` first.");
    process.exit(1);
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: UNIT_AMOUNT,
    billing_scheme: "per_unit",
    recurring: { interval: "month", usage_type: "metered", meter: meter.id },
    lookup_key: PRICE_LOOKUP_KEY,
    nickname: "TallyShot overage ($1/sheet)",
  });

  console.log(`✓ Created metered overage price: ${price.id}`);
  printEnv(price.id);
}

function printEnv(priceId) {
  console.log(`\nSet this in Vercel (${mode} env) + redeploy:`);
  console.log(`  STRIPE_PRICE_TALLYSHOT_METER=${priceId}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
