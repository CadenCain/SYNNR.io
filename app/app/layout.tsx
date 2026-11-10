import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import SynnrNav from "./_synnr/nav";
import { requireCompany, getUserCompanies } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { mustSubscribe } from "@/lib/saas/plan";

// The signed-in app: SYNNR. A company that never finished paying is sent to
// the payment step. One that paid and then lapsed is read-only, never locked
// out: every page renders and its data stays exportable, every change is
// gated (requireBillableCompany in the actions), and this layout says so.
export const metadata: Metadata = {
  title: { default: "SYNNR", template: "%s · SYNNR" },
  robots: { index: false, follow: false },
};

async function switchCompany(formData: FormData) {
  "use server";
  const { user } = await requireCompany();
  const target = String(formData.get("company_id") ?? "");
  // Cookie only ever points at a company this user actually belongs to.
  const companies = await getUserCompanies(user.id);
  if (companies.some((c) => c.id === target)) {
    (await cookies()).set("synnr_co", target, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  redirect("/app");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { company, user } = await requireCompany();
  // Never finished paying: straight to payment, not an empty app. A shop that
  // paid and lapsed stays in, read-only, with its records exportable.
  if (mustSubscribe(company)) redirect("/onboarding/billing");
  const writable = isWritable(company.subscription_status, company.comped);

  const userName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Operator";

  const companies = await getUserCompanies(user.id);
  const bar = "border-b border-line bg-surface px-4 py-2.5 text-[13px] text-ink-dim md:px-8";

  return (
    <div className="saas relative min-h-dvh bg-coal text-ink antialiased md:flex">
      <SynnrNav companyName={company.name} userName={userName}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))} activeCompanyId={company.id}
        switchAction={switchCompany} />
      <div className="relative z-10 flex min-h-dvh min-w-0 flex-1 flex-col">
        {/* Never-subscribed, lapsed, and payment-failed are three different
            situations — telling a brand-new signup their subscription "paused"
            describes something that never happened and points at the wrong
            door. */}
        {company.is_demo ? (
          <div className={bar}>
            <span className="font-medium text-ink">Demo company.</span> Everything in it is made up.{" "}
            {/* Leaves the demo and goes straight to creating a real account. */}
            <a href="/demo/exit?to=signup" className="font-medium text-ink underline underline-offset-4 hover:text-bone">Set up your company</a>
          </div>
        ) : !writable ? (
          <div className={bar}>
            Your subscription has ended, so changes are locked. Everything you put in is safe, and you can still export it.{" "}
            {company.role === "owner" ? (
              <Link href="/onboarding/billing" className="font-medium text-ink underline underline-offset-4 hover:text-bone">Restart your subscription</Link>
            ) : (
              <span className="font-medium">Ask your account owner to restart the subscription.</span>
            )}
          </div>
        ) : company.subscription_status === "past_due" ? (
          <div className={bar}>
            Your payment failed. Everything still works while the card retries.{" "}
            {company.role === "owner" ? (
              <Link href="/app/settings/billing" className="font-medium text-ink underline underline-offset-4 hover:text-bone">Update your card</Link>
            ) : (
              <span className="font-medium">Ask your account owner to update the card</span>
            )}{" "}
            before editing pauses.
          </div>
        ) : null}
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
