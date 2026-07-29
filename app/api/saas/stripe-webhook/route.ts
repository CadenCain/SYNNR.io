import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { saasAdmin } from "@/lib/saas/db";

/**
 * Stripe webhook → source of truth for subscription state. Configure the
 * endpoint URL ({site}/api/saas/stripe-webhook) in the Stripe dashboard and
 * set STRIPE_WEBHOOK_SECRET. Handles checkout completion + subscription
 * lifecycle, syncing saas_companies.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ ok: false }, { status: 500 });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `bad signature: ${e instanceof Error ? e.message : ""}` }, { status: 400 });
  }

  const admin = saasAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

  // Every handler is a "set these fields to this value" write — re-running an
  // event produces the same row, so Stripe's at-least-once retries are safe
  // without an idempotency table. (Add one before wiring any NON-idempotent
  // side effect here — welcome emails, dunning, provisioning.)
  /**
   * Sync by Stripe customer id, falling back to the company_id we stamp into
   * subscription metadata at checkout.
   *
   * The fallback matters: if two checkout sessions race (double-tap on a slow
   * yard connection), Stripe ends up with two customers for one company and we
   * only stored the last one. If the OTHER one is what gets paid, matching on
   * customer id alone finds nothing — and the deliberate throw below would then
   * fail this event forever, disabling the endpoint for every customer. The
   * metadata is the identity we control, so we trust it and repair the stored
   * customer id on the way through.
   */
  async function syncByCustomer(customerId: string, fields: Record<string, unknown>, companyIdHint?: string | null) {
    const { data, error } = await admin!
      .from("saas_companies").update(fields).eq("stripe_customer_id", customerId).select("id");
    if (error) throw new Error(`db sync failed for ${customerId}: ${error.message}`);
    if (data && data.length > 0) return;

    if (companyIdHint) {
      const { data: byId, error: e2 } = await admin!
        .from("saas_companies")
        .update({ ...fields, stripe_customer_id: customerId }) // repair the drift
        .eq("id", companyIdHint).select("id");
      if (e2) throw new Error(`db sync failed for company ${companyIdHint}: ${e2.message}`);
      if (byId && byId.length > 0) return;
    }
    // Genuinely unknown customer. Returning 200 would tell Stripe "handled" and
    // the paying shop stays locked out FOREVER with no trace. Throw → 500 →
    // Stripe retries and eventually emails the account owner.
    throw new Error(`no company matched stripe customer ${customerId}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.customer && s.subscription) {
          await syncByCustomer(String(s.customer), {
            stripe_subscription_id: String(s.subscription),
            subscription_status: "active",
          }, s.client_reference_id ?? s.metadata?.company_id ?? null);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const qty = sub.items?.data?.[0]?.quantity ?? null;
        await syncByCustomer(String(sub.customer), {
          subscription_status: sub.status,
          stripe_subscription_id: sub.id,
          ...(qty != null ? { yard_quantity: qty } : {}),
        }, sub.metadata?.company_id ?? null);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncByCustomer(String(sub.customer), { subscription_status: "canceled" }, sub.metadata?.company_id ?? null);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.customer) await syncByCustomer(String(inv.customer), { subscription_status: "past_due" });
        break;
      }
    }
  } catch (e) {
    // Return 500 so Stripe RETRIES — a transient DB blip must not silently
    // drop a subscription state change. Stripe backs off and re-delivers.
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
