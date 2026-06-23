import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Opens the Stripe Customer Portal for the signed-in user's org so they can
 * change seats, update payment, see invoices, or cancel — all self-serve.
 * Returns configured:false when Stripe isn't wired yet.
 */
export async function POST(req: Request) {
  // PARKED: managed-service model — no self-serve billing portal. Disabled so it
  // can't touch Stripe. Re-enable with ENABLE_CHECKOUT=1 (reversible).
  if (process.env.ENABLE_CHECKOUT !== "1") {
    return NextResponse.json({ ok: false, error: "Billing portal is disabled." }, { status: 410 });
  }
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ ok: true, configured: false });

  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });

  // Find the org's Stripe customer (from the workspace, or any subscription row).
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
  const workspaceId = profile?.workspace_id ?? null;

  let customerId: string | null = null;
  if (workspaceId) {
    const { data: ws } = await supabase.from("workspaces").select("stripe_customer_id").eq("id", workspaceId).maybeSingle();
    customerId = ws?.stripe_customer_id ?? null;
    if (!customerId) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("workspace_id", workspaceId)
        .not("stripe_customer_id", "is", null)
        .limit(1)
        .maybeSingle();
      customerId = sub?.stripe_customer_id ?? null;
    }
  }

  if (!customerId) {
    return NextResponse.json({ ok: false, error: "no billing account yet — subscribe to an app first" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });
    return NextResponse.json({ ok: true, configured: true, url: portal.url });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "stripe error" }, { status: 502 });
  }
}
