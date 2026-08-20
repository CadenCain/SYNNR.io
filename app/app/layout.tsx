import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AppNav from "./_components/app-nav";
import { requireCompany, getUserCompanies } from "@/lib/saas/auth";
import { isWritable } from "@/lib/saas/entitlements";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";

// The signed-in SaaS surface. Authenticated + belongs to a company. A lapsed
// subscription is READ-ONLY, never locked out (spec §3): every page renders,
// export works, writes are gated in the actions, and this layout wears the
// banner. The old behavior — redirecting every route to a paywall — broke
// the "cancel anytime, your data stays exportable" promise on the checkout
// page.
export const metadata: Metadata = {
  title: "RollReady",
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
  const writable = isWritable(company.subscription_status, company.comped);
  const companies = await getUserCompanies(user.id);

  const userName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Operator";

  // Overall readiness pill in the sidebar on every page (spec 2.3) — same
  // engine as the dashboard, never a second opinion.
  const db = await saasDb();
  const { readiness } = await getCompanyReadiness(db, company.id);

  return (
    <div className="saas relative min-h-dvh bg-coal text-ink antialiased md:flex">
      {/* ambient depth */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 80% -10%, rgba(231,221,199,0.05), transparent 60%), radial-gradient(50rem 30rem at -10% 110%, rgba(231,221,199,0.035), transparent 55%)",
        }}
      />
      <AppNav companyName={company.name} userName={userName} readiness={readiness}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))} activeCompanyId={company.id}
        switchAction={switchCompany} />
      <div className="relative z-10 min-w-0 flex-1">
        {/* Never-subscribed, lapsed, and payment-failed are three different
            situations — telling a brand-new signup their subscription "paused"
            describes something that never happened and points at the wrong
            door. */}
        {company.is_demo ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
            <span className="font-semibold">Demo yard</span> — this is fake data, click anything.{" "}
            {/* /demo/exit signs the throwaway session out first — a plain
                /signup link boomerangs signed-in users straight back here. */}
            <a href="/demo/exit" className="font-medium underline underline-offset-2">Get your own yard →</a>
          </div>
        ) : !writable && company.subscription_status === "none" ? (
          <div className="border-b border-line-2 bg-elevated px-4 py-2.5 text-sm text-ink-dim">
            You&apos;re on the free view — look around all you like.{" "}
            {company.role === "owner" ? (
              <Link href="/onboarding/billing" className="font-medium text-ink underline underline-offset-2">Start your subscription</Link>
            ) : (
              <span className="font-medium text-ink">Ask your account owner to subscribe</span>
            )}{" "}
            to start adding your yard.
          </div>
        ) : !writable ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
            Your subscription has ended. Your records are safe and exportable —{" "}
            {company.role === "owner" ? (
              <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">restart billing</Link>
            ) : (
              <span className="font-medium">ask your account owner to restart billing</span>
            )}{" "}
            to edit again.
          </div>
        ) : company.subscription_status === "past_due" ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
            Payment failed — everything still works while the card retries.{" "}
            {company.role === "owner" ? (
              <Link href="/app/settings/billing" className="font-medium underline underline-offset-2">Update your card</Link>
            ) : (
              <span className="font-medium">Ask your account owner to update the card</span>
            )}{" "}
            before editing pauses.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
