import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/saas/auth";

/** Stripe Customer Portal — manage card / plan / cancel. */
export async function POST() {
  const { company } = await requireCompany();
  if (company.is_demo) {
    return NextResponse.json({ ok: false, error: "This is the demo yard — there's no billing here. Create your real account at synnr.io/signup." }, { status: 403 });
  }
  const stripe = getStripe();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";
  if (!stripe) return NextResponse.json({ ok: false, error: "Billing not configured." }, { status: 500 });

  const sb = (await getServerSupabase()) as unknown as SupabaseClient;
  const { data } = await sb.from("saas_companies").select("stripe_customer_id").eq("id", company.id).maybeSingle();
  const customerId = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) return NextResponse.json({ ok: false, error: "No subscription yet." }, { status: 400 });

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings/billing`,
    });
    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    // This message is read by a PAYING CUSTOMER, not by us — it must never
    // leak internal setup instructions, and it must leave them a real way to
    // do the thing they came here to do (change a card, get an invoice,
    // cancel). Being unable to cancel is how a subscription earns a
    // chargeback.
    console.error("[portal] session create failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({
      ok: false,
      error: "Can't open the billing page right now. Email cadencain@synnr.io or text 432-250-0715 and we'll sort out your card, invoice, or cancellation the same day.",
    }, { status: 502 });
  }
}
