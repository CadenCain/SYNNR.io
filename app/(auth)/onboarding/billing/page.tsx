import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { requireCompany } from "@/lib/saas/auth";
import { saasAdmin } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import BillingActions from "@/app/app/settings/billing/billing-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Subscribe · SYNNR" };

const PER_YARD = 298;

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Start your subscription</h1>
        <p className="mt-1 text-sm text-ink-dim">One more step — add a card to activate {company.name}.</p>
      </div>
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight">${PER_YARD}</span>
          <span className="text-sm text-ink-dim">per yard / month</span>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-ink-dim">
          <li>• Unlimited assets &amp; crew</li>
          <li>• Photo + proof storage</li>
          <li>• Expiration alerts before anything lapses</li>
          <li>• The full renewal loop, every yard</li>
        </ul>
        <BillingActions subscribed={false} />
        <p className="text-xs text-ink-faint">Billed monthly, per active yard. Cancel anytime — your data stays exportable.</p>
      </Card>
    </div>
  );
}
