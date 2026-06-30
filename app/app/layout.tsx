import type { Metadata } from "next";
import AppNav from "./_components/app-nav";

// The signed-in SaaS surface. Phase 1 = shell only (no auth gate yet —
// Phase 2 adds Supabase auth + the subscription gate). noindex always.
export const metadata: Metadata = {
  title: "SYNNR",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="saas min-h-dvh bg-zinc-950 text-zinc-100 antialiased md:flex">
      <AppNav />
      <div className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
