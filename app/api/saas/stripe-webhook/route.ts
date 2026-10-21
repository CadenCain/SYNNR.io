import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { saasAdmin } from "@/lib/saas/db";
import { applyStripeEvent, type CompanyFields, type CompanyMatch } from "@/lib/saas/stripe-events";
import { provisionPaidYards } from "@/lib/saas/onboarding";

/**
 * Stripe webhook: the source of truth for whether a shop is paid up. Point
 * Stripe at https://www.synnr.io/api/saas/stripe-webhook (www: the bare
 * domain redirects, and Stripe won't follow a redirect on a POST) and set
 * STRIPE_WEBHOOK_SECRET. Events to send: checkout.session.completed and
 * customer.subscription.created / updated / deleted / paused / resumed.
 * What each one does lives in lib/saas/stripe-events.ts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ ok: false, error: "billing not configured" }, { status: 500 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature") || "", secret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `bad signature: ${e instanceof Error ? e.message : ""}` }, { status: 400 });
  }

  const admin = saasAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  async function update(fields: CompanyFields, match: CompanyMatch): Promise<number> {
    let q = admin!.from("saas_companies").update(fields);
    q = "stripe_customer_id" in match ? q.eq("stripe_customer_id", match.stripe_customer_id) : q.eq("id", match.id);
    if (match.currentSubscription) q = q.or(`stripe_subscription_id.eq.${match.currentSubscription},stripe_subscription_id.is.null`);
    const { data, error } = await q.select("id");
    if (error) throw new Error(`db sync failed: ${error.message}`);
    return (data ?? []).length;
  }

  try {
    await applyStripeEvent(event, {
      update,
      retrieveSubscription: (id) => stripe.subscriptions.retrieve(id),
      provision: async (hint, customerId, paidFor) => {
        const q = admin!.from("saas_companies").select("id");
        const { data } = await (customerId ? q.eq("stripe_customer_id", customerId) : q.eq("id", hint ?? "")).maybeSingle();
        const id = (data as { id: string } | null)?.id ?? hint;
        if (id) await provisionPaidYards(admin!, id, paidFor);
      },
    });
  } catch (e) {
    // 500 so Stripe retries: a database blip must not drop a payment.
    console.error("[stripe-webhook]", event.type, e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
