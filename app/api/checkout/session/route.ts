import { NextResponse } from "next/server";
import { getStripe, priceFor, priceForProduct, normalizePlan } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProduct, isSelfServe } from "@/lib/catalog";

/**
 * Creates a Stripe hosted Checkout Session for the chosen plan and returns its
 * URL. If Stripe isn't configured (no key / no price), returns configured:false
 * so the checkout page falls back to the demo flow.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }

  // Marketplace per-seat path: { product, seats }. Legacy per-company: { plan }.
  const productSlug = typeof body.product === "string" ? body.product : "";
  const product = productSlug ? getProduct(productSlug) : undefined;

  const stripe = getStripe();

  let price: string | undefined;
  let quantity = 1;
  let plan = "pro";
  let trialDays = 0;
  let cancelUrl: string;

  if (product) {
    // clamp seats to a sane self-serve range; 50+ routes to sales, not checkout
    const requestedSeats = Math.max(1, Math.floor(Number(body.seats) || 1));
    if (!isSelfServe(product, requestedSeats)) {
      return NextResponse.json({ ok: false, error: "seat count requires sales — contact us", contactSales: true }, { status: 422 });
    }
    quantity = requestedSeats;
    price = priceForProduct(product.slug);
    plan = product.slug;
    trialDays = product.pricing.trialDays ?? 0;
    cancelUrl = `/apps/${product.slug}#pricing`;
  } else {
    const requested = typeof body.plan === "string" ? normalizePlan(body.plan) : "";
    if (requested === "starter" || requested === "pro" || requested === "fleet") plan = requested;
    price = priceFor(plan);
    cancelUrl = `/checkout?plan=${plan}`;
  }

  if (!stripe || !price) {
    // Not wired yet (no key / no price env) → checkout page falls back to demo.
    return NextResponse.json({ ok: true, configured: false });
  }

  // Attach the session to the workspace/user when signed in.
  let workspaceId: string | null = null;
  let email: string | undefined;
  const supabase = await getServerSupabase();
  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      email = auth.user.email ?? undefined;
      const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
      workspaceId = profile?.workspace_id ?? null;
    }
  }

  const origin = new URL(req.url).origin;
  const meta = { plan, product_slug: product?.slug ?? "", seats: String(quantity), workspace_id: workspaceId ?? "" };
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity }],
      success_url: `${origin}/dashboard?subscribed=1`,
      cancel_url: `${origin}${cancelUrl}`,
      customer_email: email,
      client_reference_id: workspaceId ?? undefined,
      allow_promotion_codes: true,
      metadata: meta,
      subscription_data: {
        metadata: meta,
        ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
      },
    });
    return NextResponse.json({ ok: true, configured: true, url: session.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "stripe error" }, { status: 502 });
  }
}
