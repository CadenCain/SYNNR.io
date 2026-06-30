import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";

/** Create a per-yard subscription Checkout session (quantity = active yards). */
export async function POST() {
  const { company } = await requireCompany();
  const stripe = getStripe();
  const price = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";
  if (!stripe || !price) {
    return NextResponse.json({ ok: false, error: "Billing isn't configured yet." }, { status: 500 });
  }

  const sb = (await getServerSupabase()) as unknown as SupabaseClient;
  const admin = saasAdmin();

  // Active yard count = subscription quantity (min 1).
  const { count: yardCount } = await sb
    .from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id);
  const quantity = Math.max(1, yardCount ?? 1);

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
    line_items: [{ price, quantity }],
    subscription_data: { metadata: { company_id: company.id } },
    success_url: `${origin}/app/settings/billing?ok=1`,
    cancel_url: `${origin}/app/settings/billing`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
