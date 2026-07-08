import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { requireCompany } from "@/lib/saas/auth";

/** Stripe Customer Portal — manage card / plan / cancel. */
export async function POST() {
  const { company } = await requireCompany();
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
    // Most common cause: the Customer Portal isn't enabled in the Stripe
    // dashboard (Billing → Customer portal). Say so instead of a raw 500.
    const msg = e instanceof Error ? e.message : "";
    const hint = /portal|configuration/i.test(msg)
      ? "Billing portal isn't set up yet — enable it in the Stripe dashboard (Billing → Customer portal)."
      : "Couldn't open billing. Try again.";
    return NextResponse.json({ ok: false, error: hint }, { status: 502 });
  }
}
