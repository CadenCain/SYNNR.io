import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppNav from "./_components/app-nav";
import { requireCompany } from "@/lib/saas/auth";

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

  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased md:flex">
      <AppNav companyName={company.name} userName={userName} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
