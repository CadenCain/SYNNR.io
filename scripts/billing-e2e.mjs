/**
 * RollReady billing, end to end, against Stripe TEST mode. Refuses a live key.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/billing-e2e.mjs
 *
 * Optional, to also prove the app's webhook writes the company row:
 *   WEBHOOK_URL=http://localhost:3000/api/saas/stripe-webhook
 *   STRIPE_WEBHOOK_SECRET=<the same secret the app runs with>
 *   COMPANY_ID=<a test company's id>   (its status/yards are then checked by you or by SQL)
 *
 * What it checks:
 *   1. The "RollReady Yard" price exists (or is made) and is $500 USD a month per yard.
 *   2. A Checkout session for 3 yards totals $1,500.
 *   3. A 2-yard subscription on a test card goes active and its first invoice is $1,000.
 *   4. Raising it to 3 yards prorates (an invoice item for the extra yard), quantity 3.
 *   5. The billing portal opens with RollReady's configuration (no quantity changes there).
 *   6. (optional) Signed webhook events reach the app and are accepted.
 *   7. Canceling ends it. The test customer is deleted at the end.
 */
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test_") && !key.startsWith("rk_test_")) {
  console.error("Needs a TEST key (sk_test_...). This script never runs against live Stripe.");
  process.exit(1);
}
const stripe = new Stripe(key);
const LOOKUP = "rollready_yard_monthly";
let failures = 0;
const check = (ok, label, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`); if (!ok) failures++; };

async function yardPrice() {
  const found = (await stripe.prices.list({ lookup_keys: [LOOKUP], active: true, limit: 1 })).data[0];
  if (found) return found;
  const product = await stripe.products.create({ name: "RollReady Yard", metadata: { app: "rollready" } });
  return stripe.prices.create({ product: product.id, currency: "usd", unit_amount: 50000, recurring: { interval: "month" }, lookup_key: LOOKUP, nickname: "$500 per yard per month" });
}

const price = await yardPrice();
check(price.unit_amount === 50000 && price.currency === "usd" && price.recurring?.interval === "month", "price is $500 USD per yard per month", price.id);

const customer = await stripe.customers.create({ name: "RollReady billing test", email: "billing-test@example.com", metadata: { company_id: process.env.COMPANY_ID ?? "test" } });
try {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", customer: customer.id, line_items: [{ price: price.id, quantity: 3 }],
    success_url: "https://www.synnr.io/onboarding/billing?session_id={CHECKOUT_SESSION_ID}", cancel_url: "https://www.synnr.io/onboarding/billing?canceled=1",
    subscription_data: { metadata: { company_id: process.env.COMPANY_ID ?? "test" } }, allow_promotion_codes: false,
  });
  check(Boolean(session.url) && session.amount_total === 150000, "checkout for 3 yards totals $1,500", `${session.amount_total / 100} USD`);

  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
  let sub = await stripe.subscriptions.create({
    customer: customer.id, items: [{ price: price.id, quantity: 2 }],
    metadata: { company_id: process.env.COMPANY_ID ?? "test" }, expand: ["latest_invoice"],
  });
  check(sub.status === "active", "2-yard subscription is active on a test card", sub.status);
  check(sub.latest_invoice?.amount_paid === 100000, "first invoice is $1,000", `${(sub.latest_invoice?.amount_paid ?? 0) / 100} USD`);

  sub = await stripe.subscriptions.update(sub.id, { items: [{ id: sub.items.data[0].id, quantity: 3 }], proration_behavior: "create_prorations" });
  check(sub.items.data[0].quantity === 3, "raised to 3 yards");
  const pending = await stripe.invoiceItems.list({ customer: customer.id, pending: true, limit: 10 });
  check(pending.data.some((i) => i.amount > 0), "the extra yard is prorated onto the next bill", `${pending.data.map((i) => i.amount / 100).join(", ")} USD`);

  const confs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  let conf = confs.data.find((c) => c.metadata?.app === "rollready");
  if (!conf) console.log("note  no RollReady portal configuration yet; the app makes it on the first Manage billing click");
  const portal = await stripe.billingPortal.sessions.create({ customer: customer.id, ...(conf ? { configuration: conf.id } : {}), return_url: "https://www.synnr.io/app/settings/billing" });
  check(Boolean(portal.url), "billing portal opens");
  if (conf) check(conf.features.subscription_update.enabled === false, "portal can't change yard count (the app does that)");

  if (process.env.WEBHOOK_URL && process.env.STRIPE_WEBHOOK_SECRET) {
    for (const type of ["customer.subscription.updated"]) {
      const payload = JSON.stringify({ id: `evt_test_${Date.now()}`, object: "event", type, data: { object: sub } });
      const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
      const r = await fetch(process.env.WEBHOOK_URL, { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
      check(r.status === 200, `webhook accepts ${type}`, `${r.status} ${await r.text()}`);
    }
    const bad = await fetch(process.env.WEBHOOK_URL, { method: "POST", headers: { "stripe-signature": "t=1,v1=nope" }, body: "{}" });
    check(bad.status === 400, "webhook refuses an unsigned event", String(bad.status));
  } else {
    console.log("skip  webhook (set WEBHOOK_URL and STRIPE_WEBHOOK_SECRET to test it)");
  }

  const canceled = await stripe.subscriptions.cancel(sub.id);
  check(canceled.status === "canceled", "cancel ends it");
} finally {
  await stripe.customers.del(customer.id).catch(() => {});
}
console.log(failures ? `\n${failures} check(s) failed.` : "\nAll billing checks passed.");
process.exit(failures ? 1 : 0);
