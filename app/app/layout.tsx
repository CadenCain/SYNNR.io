import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppNav from "./_components/app-nav";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";

// The signed-in SaaS surface. Gated: authenticated + belongs to a company +
// has an active subscription (no free trial). noindex always.
export const metadata: Metadata = {
  title: "SYNNR",
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { company, user } = await requireCompany();
  if (company.subscription_status !== "active" && company.subscription_status !== "past_due") {
    redirect("/onboarding/billing");
  }

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
      <AppNav companyName={company.name} userName={userName} readiness={readiness} />
      <div className="relative z-10 min-w-0 flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
