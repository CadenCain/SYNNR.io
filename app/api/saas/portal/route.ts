import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { requireCompany } from "@/lib/saas/auth";
import { canPerform } from "@/lib/saas/entitlements";
import { saasAdmin } from "@/lib/saas/db";
import { portalConfigurationId } from "@/lib/saas/stripe-setup";

/**
 * Stripe's billing page for the owner: card, invoices, billing details, and
 * cancel. Yard count changes happen in the app (lib/saas/stripe-setup.ts
 * explains why), so this portal can't change the quantity.
 */
export async function POST(req: Request) {
  const { company } = await requireCompany();
  const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
  if (company.is_demo) return no("This is the demo yard, so there's no billing here. Call or text 432-250-0715 to set up your real yard.", 403);
  if (!canPerform(company.role, "billing")) return no("Only the account owner can open billing.", 403);
  const stripe = getStripe();
  const admin = saasAdmin();
  if (!stripe || !admin) return no("Billing isn't set up yet.", 500);

  const { data } = await admin.from("saas_companies").select("stripe_customer_id").eq("id", company.id).maybeSingle();
  const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) return no("No subscription yet.", 400);

  try {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: await portalConfigurationId(stripe),
      return_url: `${origin}/app/settings/billing`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    // Read by a paying customer: no setup details, and a real way to get
    // their card, invoice, or cancellation handled.
    console.error("[portal] session create failed:", e instanceof Error ? e.message : e);
    return no("Can't open the billing page right now. Email cadencain@synnr.io or text 432-250-0715 and we'll sort out your card, invoice, or cancellation the same day.", 502);
  }
}
