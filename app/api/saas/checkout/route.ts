import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";

/** Create a per-yard subscription Checkout session. Quantity = the number of
 *  yards the shop says it runs (picked at subscribe time; defaults to the
 *  yards already in SYNNR). Adjustable again on the Stripe page itself, and
 *  it follows active yards after that. */
export async function POST(req: Request) {
  const { company } = await requireCompany();
  const stripe = getStripe();
  const price = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";
  if (!stripe || !price) {
    return NextResponse.json({ ok: false, error: "Billing isn't configured yet." }, { status: 500 });
  }

  const sb = (await getServerSupabase()) as unknown as SupabaseClient;
  const admin = saasAdmin();

  // Requested yard count (from the stepper), else active yards in SYNNR. 1-50.
  let requested = 0;
  try {
    const body = await req.json();
    requested = Math.floor(Number(body?.quantity) || 0);
  } catch { /* no body — fall back to yard count */ }
  const { count: yardCount } = await sb
    .from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id);
  const quantity = Math.min(50, Math.max(1, requested || yardCount || 1));

  // Ensure a Stripe customer.
  const { data: companyRow } = await sb
    .from("saas_companies").select("stripe_customer_id").eq("id", company.id).maybeSingle();
  let customerId = (companyRow as { stripe_customer_id: string | null } | null)?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ name: company.name, metadata: { company_id: company.id } });
    customerId = customer.id;
    if (admin) await admin.from("saas_companies").update({ stripe_customer_id: customerId }).eq("id", company.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity, adjustable_quantity: { enabled: true, minimum: 1, maximum: 50 } }],
    // No trial — card charged immediately, billed monthly.
    subscription_data: { metadata: { company_id: company.id } },
    payment_method_collection: "always",
    success_url: `${origin}/onboarding/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/onboarding/billing`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
