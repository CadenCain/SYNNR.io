import { NextResponse } from "next/server";
import { getStripe, priceFor } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Creates a Stripe hosted Checkout Session for the chosen plan and returns its
 * URL. If Stripe isn't configured (no key / no price), returns configured:false
 * so the checkout page falls back to the demo flow.
 */
export async function POST(req: Request) {
  let plan = "growth";
  try {
    const body = await req.json();
    // legacy plan keys from old links map onto the current tiers
    const aliases: Record<string, string> = { recover: "pro", command: "growth" };
    const requested = typeof body?.plan === "string" ? (aliases[body.plan] ?? body.plan) : "";
    if (requested === "pro" || requested === "growth") plan = requested;
  } catch {
    /* default */
  }

  const stripe = getStripe();
  const price = priceFor(plan);
  if (!stripe || !price) {
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
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/dashboard?subscribed=1`,
      cancel_url: `${origin}/checkout?plan=${plan}`,
      customer_email: email,
      client_reference_id: workspaceId ?? undefined,
      allow_promotion_codes: true,
      metadata: { plan, workspace_id: workspaceId ?? "" },
      subscription_data: { metadata: { plan, workspace_id: workspaceId ?? "" } },
    });
    return NextResponse.json({ ok: true, configured: true, url: session.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "stripe error" }, { status: 502 });
  }
}
