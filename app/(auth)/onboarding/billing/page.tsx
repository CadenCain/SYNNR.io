import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { requireCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";
import { saasDb } from "@/lib/saas/db";
import SubscribeCard from "./subscribe-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribe · SYNNR" };

export default async function OnboardingBilling({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { company } = await requireCompany();
  if (company.subscription_status === "active" || company.subscription_status === "past_due") redirect("/app");

  // Returned from Checkout — confirm payment immediately (don't wait on webhook).
  const sp = await searchParams;
  if (sp.session_id) {
    const stripe = getStripe();
    const admin = saasAdmin();
    if (stripe && admin) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sp.session_id);
        if (session.payment_status === "paid" || session.status === "complete") {
          await admin.from("saas_companies").update({
            subscription_status: "active",
            stripe_subscription_id: session.subscription ? String(session.subscription) : null,
            stripe_customer_id: session.customer ? String(session.customer) : null,
          }).eq("id", company.id);
          redirect("/app");
        }
      } catch {
        // fall through to the subscribe card
      }
    }
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
