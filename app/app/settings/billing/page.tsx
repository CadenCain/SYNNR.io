import Link from "next/link";
import { fmtDay } from "@/lib/saas/format";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import BillingActions from "./billing-actions";
import { STATUS_LABEL } from "@/lib/saas/plan";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

/**
 * Where the subscription stands and the one door to change it: Stripe's
 * portal for the card, invoices, receipts, or canceling. The owner runs it;
 * everyone else just sees it's handled.
 */
export default async function BillingSettings({ searchParams }: { searchParams: Promise<{ err?: string; locked?: string; changed?: string }> }) {
  const { company } = await requireCompany();
  const { err, locked } = await searchParams;
  const db = await saasDb();
  const { data: comp } = await db.from("saas_companies").select("subscription_status, stripe_customer_id, cancel_at").eq("id", company.id).maybeSingle();
  const c = comp as { subscription_status: string; stripe_customer_id: string | null; cancel_at: string | null } | null;
  const status = c?.subscription_status ?? "none";
  const subscribed = status === "active" || status === "past_due" || status === "trialing";
  const owner = company.role === "owner";
  const ends = c?.cancel_at && subscribed ? fmtDay(c.cancel_at) : null;

  return (
    <>
      <PageHeader back={{ href: "/app/settings", label: "Settings" }} title="Billing" description="Your subscription and how you pay." />

      {locked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          That needs an active subscription. Everything you put in is safe, and you can still read it.
        </p>
      ) : null}
      {err ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      <div className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <div className="text-[13px] text-ink-faint">Subscription</div>
            <div className="mt-1 flex items-center gap-2 text-[15px] font-medium text-ink">
              <span aria-hidden className={company.comped || status === "active" || status === "trialing" ? "h-1.5 w-1.5 rounded-full bg-emerald-400" : status === "past_due" ? "h-1.5 w-1.5 rounded-full bg-amber-400" : "h-1.5 w-1.5 rounded-full bg-ink-faint"} />
              {company.comped ? "Comped" : STATUS_LABEL[status] ?? status}{ends ? `, ends ${ends}` : ""}
            </div>
          </div>
          {company.comped ? null : owner ? (
            // Anyone who ever paid can reach the portal: card, invoices and receipts, or cancel.
            c?.stripe_customer_id && status !== "none"
              ? <div className="flex flex-col items-end gap-2"><BillingActions mode="portal" />{subscribed ? null : <Link href="/onboarding/billing" className={buttonClass("default")}>Restart the subscription</Link>}</div>
              : <Link href="/onboarding/billing" className={buttonClass("default")}>{status === "none" ? "Start the subscription" : "Restart the subscription"}</Link>
          ) : <span className="text-[13px] text-ink-faint">The account owner handles billing.</span>}
        </div>
        <div className="border-t border-line px-5 py-4 text-[13px] leading-relaxed text-ink-dim">
          {company.comped
            ? "Nothing is billed on this account."
            : ends
              ? "Canceled. Changed your mind? Turn it back on under Card, invoices, or cancel."
              : "One price for the whole company. Everyone you bring in gets their own login, never billed per seat."}
        </div>
      </div>
    </>
  );
}
