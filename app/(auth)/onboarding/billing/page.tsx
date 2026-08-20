import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { requireCompany , getUserCompanies } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";
import { saasDb } from "@/lib/saas/db";
import SubscribeCard from "./subscribe-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribe · RollReady" };

async function switchCompanyFromWall(formData: FormData) {
  "use server";
  const { user } = await requireCompany();
  const target = String(formData.get("company_id") ?? "");
  const companies = await getUserCompanies(user.id);
  if (companies.some((c) => c.id === target)) {
    (await cookies()).set("synnr_co", target, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  redirect("/app");
}

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
          // purchase (the allowance is explicit now; Stripe already
          // matches), so a 3-yard shop would sit at 0 — and partner payouts in
          // /op/referrals are computed from this column.
          const paidQty = sub?.items?.data?.[0]?.quantity ?? null;
          await admin.from("saas_companies").update({
            subscription_status: "active",
            // Spread only what's present: writing null here would wipe a
            // working id, breaking the billing portal and every future webhook
            // match for that customer.
            ...(session.subscription ? { stripe_subscription_id: sub ? sub.id : String(session.subscription) } : {}),
            ...(session.customer ? { stripe_customer_id: String(session.customer) } : {}),
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
        <a href="/" className="mb-2 inline-block text-sm text-ink-dim hover:text-ink">← Back</a>
        {/* An unpaid company must never trap the login (spec §4): if this user
            belongs to other companies, offer the door right on the wall. */}
        <CompanySwitcherWall />
        <h1 className="text-xl font-semibold tracking-tight">Start your subscription</h1>
        <p className="mt-1 text-sm text-ink-dim">One more step — add a card to activate {company.name}.</p>
      </div>
      <SubscribeCard initialYards={Math.max(1, yardCount ?? 1)} />
    </div>
  );
}


async function CompanySwitcherWall() {
  const { user } = await requireCompany();
  const companies = await getUserCompanies(user.id);
  if (companies.length < 2) return null;
  return (
    <div className="mb-4 rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-faint">You belong to other companies — switch instead:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {companies.map((c) => (
          <form key={c.id} action={switchCompanyFromWall}>
            <input type="hidden" name="company_id" value={c.id} />
            <button type="submit" className="rounded-lg border border-line-2 px-3 py-1.5 text-sm text-ink hover:bg-elevated">
              {c.name}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
