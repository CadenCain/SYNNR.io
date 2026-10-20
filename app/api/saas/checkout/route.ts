import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireCompany } from "@/lib/saas/auth";
import { canPerform } from "@/lib/saas/entitlements";
import { saasAdmin } from "@/lib/saas/db";
import { clampYards } from "@/lib/saas/plan";
import { yardPriceId } from "@/lib/saas/stripe-setup";

/**
 * Start a subscription: Stripe Checkout for "RollReady Yard" at $500 a yard
 * a month, quantity = the yards the shop said it runs at onboarding. The
 * owner only; the demo yard never; never a second subscription on top of a
 * live one. The success page and the webhook both mark the shop paid.
 */
export async function POST(req: Request) {
  const { user, company } = await requireCompany();
  const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
  if (company.is_demo) return no("This is the demo yard, so nothing here can be billed. Call or text 432-250-0715 to set up your real yard.", 403);
  if (!canPerform(company.role, "billing")) return no("Only the account owner can start the subscription.", 403);
  // Already paying: a second Checkout would make a second subscription.
  if (company.subscription_status === "active" || company.subscription_status === "past_due") {
    return no("You're already subscribed. Add or remove yards under Settings, Billing.", 409);
  }
  const stripe = getStripe();
  const admin = saasAdmin();
  if (!stripe || !admin) return no("Billing isn't set up yet. Call or text 432-250-0715.", 500);

  let requested: unknown = null;
  try { requested = (await req.json())?.quantity; } catch { /* no body */ }
  const { data: row } = await admin.from("saas_companies")
    .select("stripe_customer_id, requested_yards, contact_name, contact_email, contact_phone").eq("id", company.id).maybeSingle();
  const c = row as { stripe_customer_id: string | null; requested_yards: number | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null } | null;
  const quantity = clampYards(requested ?? c?.requested_yards ?? 1);

  let price: string;
  try {
    price = await yardPriceId(stripe);
  } catch (e) {
    console.error("[checkout] price:", e instanceof Error ? e.message : e);
    return no("Billing is down for a minute on our end. Call or text 432-250-0715 and we'll get you set up today.", 500);
  }

  // One Stripe customer per company, with the contact from onboarding.
  let customerId = c?.stripe_customer_id ?? null;
  if (customerId) {
    // A customer from the other Stripe mode (test vs live) or a deleted one: make a fresh one.
    const ok = await stripe.customers.retrieve(customerId).then((x) => !("deleted" in x && x.deleted)).catch(() => false);
    if (!ok) customerId = null;
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.name,
      email: c?.contact_email || user.email || undefined,
      phone: c?.contact_phone || undefined,
      metadata: { company_id: company.id, contact_name: c?.contact_name ?? "" },
    });
    customerId = customer.id;
    await admin.from("saas_companies").update({ stripe_customer_id: customerId }).eq("id", company.id);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: company.id,
    line_items: [{ price, quantity }],
    subscription_data: { metadata: { company_id: company.id } },
    metadata: { company_id: company.id },
    customer_update: { name: "auto", address: "auto" },
    payment_method_collection: "always",
    allow_promotion_codes: false,
    success_url: `${origin}/onboarding/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/onboarding/billing?canceled=1`,
  });
  return NextResponse.json({ ok: true, url: session.url, quantity, amount_total: session.amount_total });
}
