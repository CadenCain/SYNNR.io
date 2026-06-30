import type { Metadata } from "next";
import AppNav from "./_components/app-nav";
import { requireCompany } from "@/lib/saas/auth";

// The signed-in SaaS surface. Gated: must be authenticated AND belong to a
// company, else redirect to /login or /onboarding. noindex always.
export const metadata: Metadata = {
  title: "SYNNR",
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireCompany();

  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased md:flex">
      <AppNav companyName={company.name} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
