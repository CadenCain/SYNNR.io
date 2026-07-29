import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { requireCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";
import { saasDb } from "@/lib/saas/db";
import SubscribeCard from "./subscribe-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribe · RollReady" };

export default async function OnboardingBilling({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { company } = await requireCompany();
  if (company.subscription_status === "active" || company.subscription_status === "past_due") redirect("/app");

  // Returned from Checkout — confirm payment immediately (don't wait on webhook).
  const sp = await searchParams;
  if (sp.session_id) {
    const stripe = getStripe();
    const admin = saasAdmin();
    // NOTE: redirect() throws NEXT_REDIRECT, so it must live OUTSIDE the try —
    // a bare catch would swallow it and re-render the subscribe card to a
    // customer who just paid.
    let confirmed = false;
    if (stripe && admin) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sp.session_id, { expand: ["subscription"] });
        // Ownership check: only a session created FOR this company may activate
        // it — otherwise any authenticated user replaying someone else's paid
        // session id could flip their own company active (and cross-wire the
        // two companies' Stripe customer ids).
        const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
        const owned = session.client_reference_id === company.id || sub?.metadata?.company_id === company.id;
        if (owned && (session.payment_status === "paid" || session.status === "complete")) {
          // Record the yards they actually PAID for. Don't rely on the
          // subscription.created webhook for this: if that event isn't enabled
          // on the endpoint, nothing else writes yard_quantity on a first
          // purchase (syncYardQuantity early-returns when Stripe already
          // matches), so a 3-yard shop would sit at 0 — and partner payouts in
          // /op/referrals are computed from this column.
          const paidQty = sub?.items?.data?.[0]?.quantity ?? null;
          await admin.from("saas_companies").update({
            subscription_status: "active",
            stripe_subscription_id: session.subscription ? (sub ? sub.id : String(session.subscription)) : null,
            stripe_customer_id: session.customer ? String(session.customer) : null,
            ...(paidQty != null ? { yard_quantity: paidQty } : {}),
          }).eq("id", company.id);
          confirmed = true;
        }
      } catch {
        // fall through to the subscribe card (webhook remains source of truth)
      }
    }
    if (confirmed) redirect("/app");
  }

  const db = await saasDb();
  const { count: yardCount } = await db
    .from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Start your subscription</h1>
        <p className="mt-1 text-sm text-ink-dim">One more step — add a card to activate {company.name}.</p>
      </div>
      <SubscribeCard initialYards={Math.max(1, yardCount ?? 1)} />
    </div>
  );
}
