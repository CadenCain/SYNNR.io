import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminSupabase } from "@/lib/supabase/admin";

// Stripe needs the raw body to verify the signature.
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ ok: true, configured: false });

  const sig = req.headers.get("stripe-signature");
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig || "", secret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: "bad signature: " + (e instanceof Error ? e.message : "") }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: true, persisted: false }); // no service role key yet

  const upsert = (row: Record<string, unknown>) =>
    admin.from("subscriptions").upsert(row as never, { onConflict: "stripe_subscription_id" });

  // Keep the org's Stripe customer on the workspace so the billing portal works.
  const linkCustomer = async (workspaceId: string | null, customerId: string | null) => {
    if (!workspaceId || !customerId) return;
    await admin.from("workspaces").update({ stripe_customer_id: customerId } as never).eq("id", workspaceId);
  };

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.subscription) {
        const workspaceId = s.client_reference_id || s.metadata?.workspace_id || null;
        const customerId = typeof s.customer === "string" ? s.customer : null;
        await upsert({
          workspace_id: workspaceId,
          email: s.customer_details?.email || s.customer_email || null,
          plan: s.metadata?.plan || null,
          product_slug: s.metadata?.product_slug || null,
          seats: Number(s.metadata?.seats) || 1,
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: typeof s.subscription === "string" ? s.subscription : null,
          updated_at: new Date().toISOString(),
        });
        await linkCustomer(workspaceId, customerId);

        // Give the buyer an owner membership + their own seat immediately, so a
        // solo operator can use what they just bought without an admin step.
        const buyerId = s.metadata?.user_id;
        const slug = s.metadata?.product_slug;
        if (workspaceId && buyerId && slug) {
          await admin.from("memberships").upsert(
            { user_id: buyerId, workspace_id: workspaceId, role: "owner" } as never,
            { onConflict: "user_id,workspace_id" }
          );
          await admin.from("seat_assignments").upsert(
            { workspace_id: workspaceId, product_slug: slug, user_id: buyerId } as never,
            { onConflict: "workspace_id,product_slug,user_id" }
          );
        }
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as Stripe.Subscription;
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
      const workspaceId = sub.metadata?.workspace_id || null;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const seats = sub.items?.data?.[0]?.quantity ?? (Number(sub.metadata?.seats) || 1);
      // a deleted subscription comes through here with status "canceled"
      await upsert({
        workspace_id: workspaceId,
        plan: sub.metadata?.plan || null,
        product_slug: sub.metadata?.product_slug || null,
        seats,
        status: sub.status,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      });
      await linkCustomer(workspaceId, customerId);
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "handler error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, received: event.type });
}
