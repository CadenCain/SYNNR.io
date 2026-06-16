import { NextResponse } from "next/server";
import { getSignedInOrg, getNavContext } from "@/lib/marketplace/access";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * Permanently delete the signed-in user's workspace and all of its data.
 * Owner-only, double-confirmed. Cancels any active Stripe subscription so the
 * org isn't billed after deletion, deletes the subscriptions rows (they're
 * SET NULL on workspace delete, so we remove them explicitly), then deletes the
 * workspace — every product table (tallies, usage_events, seats, memberships,
 * invites, …) is ON DELETE CASCADE, so this purges the org in one shot.
 */
export async function POST(req: Request) {
  const org = await getSignedInOrg();
  if (!org) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!org.workspaceId) return NextResponse.json({ ok: false, error: "No workspace to delete." }, { status: 400 });

  const nav = await getNavContext();
  if (nav?.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Only the workspace owner can delete it." }, { status: 403 });
  }

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* */ }
  if ((body.confirm ?? "").trim().toUpperCase() !== "DELETE") {
    return NextResponse.json({ ok: false, error: 'Type DELETE to confirm.' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false, error: "Server not configured for deletion." }, { status: 500 });

  const workspaceId = org.workspaceId;

  // Best-effort: cancel live Stripe subscriptions so deletion stops billing.
  try {
    const stripe = getStripe();
    if (stripe) {
      const { data: subs } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id, status")
        .eq("workspace_id", workspaceId);
      for (const s of subs ?? []) {
        const sid = (s as { stripe_subscription_id?: string }).stripe_subscription_id;
        const status = (s as { status?: string }).status;
        if (sid && status !== "canceled") {
          try { await stripe.subscriptions.cancel(sid); } catch { /* already gone / manual sub */ }
        }
      }
    }
  } catch { /* never block deletion on Stripe */ }

  // Remove subscription rows (FK is SET NULL on workspace delete → delete explicitly).
  await admin.from("subscriptions").delete().eq("workspace_id", workspaceId);

  // Delete the workspace; CASCADE purges tallies, usage_events, seat_assignments,
  // memberships, invites, and everything else org-scoped.
  const { error } = await admin.from("workspaces").delete().eq("id", workspaceId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
