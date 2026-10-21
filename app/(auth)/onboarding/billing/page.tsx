import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { requireCompany, getUserCompanies } from "@/lib/saas/auth";
import { canPerform } from "@/lib/saas/entitlements";
import { saasAdmin } from "@/lib/saas/db";
import { hasFullAccess } from "@/lib/saas/plan";
import { subscriptionFields } from "@/lib/saas/stripe-events";
import { billableYardCount } from "@/lib/saas/billing";
import { provisionPaidYards } from "@/lib/saas/onboarding";
import SubscribeCard from "./subscribe-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment · RollReady" };

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

/**
 * Getting started, step 3: pay. Back from Stripe, the session is checked
 * right here (made for THIS company, and paid) so the shop lands in the app
 * the moment the card goes through, without waiting on the webhook. The
 * webhook records the same thing again, which is harmless.
 */
export default async function OnboardingBilling({ searchParams }: { searchParams: Promise<{ session_id?: string; canceled?: string; err?: string }> }) {
  const { company } = await requireCompany();
  if (hasFullAccess(company)) redirect("/app");
  const sp = await searchParams;
  const admin = saasAdmin();

  let pending = false;
  if (sp.session_id) {
    const stripe = getStripe();
    let paid = false;
    // redirect() throws, so it lives outside the try.
    if (stripe && admin) {
      try {
        const session = await stripe.checkout.sessions.retrieve(sp.session_id, { expand: ["subscription"] });
        const sub = session.subscription && typeof session.subscription !== "string" ? session.subscription : null;
        // Only a session made FOR this company counts, or anyone could replay
        // someone else's paid session id and turn their own company on.
        const mine = session.client_reference_id === company.id || sub?.metadata?.company_id === company.id;
        if (mine && sub && (sub.status === "active" || sub.status === "trialing")) {
          const fields = subscriptionFields(sub);
          await admin.from("saas_companies").update({
            ...fields,
            ...(session.customer ? { stripe_customer_id: String(session.customer) } : {}),
            subscribed_at: new Date().toISOString(),
          }).eq("id", company.id);
          // Their yards, made now, so they land in a set-up account.
          await provisionPaidYards(admin, company.id, fields.yard_quantity ?? 1).catch((e) => console.error("[onboarding] yards:", e));
          paid = true;
        } else if (mine) {
          pending = true; // e.g. a bank still confirming the card
        }
      } catch {
        // The webhook still records it; show the page.
      }
    }
    if (paid) redirect("/app?welcome=1");
  }

  const [{ data }, inUse] = await Promise.all([
    admin ? admin.from("saas_companies").select("requested_yards, contact_name").eq("id", company.id).maybeSingle() : Promise.resolve({ data: null }),
    billableYardCount(company.id),
  ]);
  const c = data as { requested_yards: number | null; contact_name: string | null } | null;
  // Restarting after a lapse starts at the yards they already run.
  const startYards = Math.max(c?.requested_yards ?? 1, company.yard_quantity, inUse, 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <CompanySwitcherWall />
        <p className="text-sm text-ink-faint">Step 3 of 3</p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Start {company.name} on RollReady</h1>
        <p className="mt-1 text-sm text-ink-dim">Pay by card on Stripe&apos;s secure page, and you&apos;re in.</p>
      </div>
      {pending ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Stripe is still confirming your card. This page will let you in as soon as it does. Refresh in a minute.
        </p>
      ) : null}
      {sp.err ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Stripe&apos;s page didn&apos;t open. Try the button below. If it keeps happening, call or text 432-250-0715.
        </p>
      ) : null}
      {sp.canceled ? (
        <p className="rounded-lg border border-line-2 bg-elevated px-4 py-3 text-sm text-ink-dim">No charge was made. Pick up where you left off whenever you&apos;re ready.</p>
      ) : null}
      <SubscribeCard initialYards={startYards} canPay={canPerform(company.role, "billing")} />
      {company.subscription_status === "none" ? (
        <p className="text-center text-sm"><Link href="/onboarding" className="text-ink-dim underline underline-offset-2">Change the company name, phone, or yards</Link></p>
      ) : null}
      <p className="text-center text-sm text-ink-dim">
        Questions first? Call or text Caden at 432-250-0715. <Link href="/demo" className="underline underline-offset-2">Or try the demo.</Link>
      </p>
      <p className="text-center text-xs text-ink-faint"><a href="/logout" className="underline underline-offset-2">Sign out</a></p>
    </div>
  );
}

async function CompanySwitcherWall() {
  const { user } = await requireCompany();
  const companies = await getUserCompanies(user.id);
  if (companies.length < 2) return null;
  return (
    <div className="mb-4 rounded-lg border border-line bg-surface p-3">
      <p className="text-xs text-ink-faint">You belong to other companies. Switch to one instead:</p>
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
