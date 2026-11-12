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
    const msg = e instanceof Error ? e.message : "handler failed";
    console.error("[stripe-webhook]", event.type, msg);
    // A live subscription that matches no company (one billed by hand from
    // Stripe's dashboard, say). Retrying can't fix that, and days of failed
    // retries get the whole endpoint switched off. Tell the operator once,
    // with what to do, and take the event.
    if (/^no company matched/.test(msg)) {
      const { sendEmail } = await import("@/lib/saas/notify");
      const { escHtml } = await import("@/lib/saas/html");
      await sendEmail([process.env.NOTIFY_EMAIL || "cadencain@synnr.io"], "[SYNNR ops] Stripe subscription with no company to put it on", `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${escHtml(
        `Stripe sent ${event.type} (${event.id}), and ${msg}.\n\n` +
        "Nothing in SYNNR changed. To link it: put the Stripe customer id on the company (saas_companies.stripe_customer_id), " +
        "then open the event in Stripe's dashboard and press Resend.")}</pre>`).catch(() => false);
      return NextResponse.json({ received: true, matched: false });
    }
    // Anything else: 500 so Stripe retries. A database blip must not drop a payment.
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
