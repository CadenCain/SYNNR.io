import type { Metadata } from "next";
import DashboardView from "@/app/app/_components/dashboard-view";
import AppNav from "@/app/app/_components/app-nav";
import { demoDashboardProps } from "./fixtures";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Screenshot harness. Renders the REAL dashboard and the REAL nav with the
 * shared demo dataset (app/shot/fixtures.ts, which also feeds /demo) so
 * headless Chrome can photograph the actual product for the marketing site:
 * the pictures can never drift from what ships. noindexed; it's a camera
 * stand. The public, linkable version of this is /demo.
 */
export default function Shot() {
  const props = demoDashboardProps();
  return (
    <div className="saas relative min-h-dvh bg-coal text-ink antialiased md:flex">
      <AppNav companyName={props.companyName} userName="Demo manager" readiness={props.readiness} reviewCount={1} />
      <div className="relative z-10 min-w-0 flex-1">
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          <DashboardView {...props} />
        </main>
      </div>
    </div>
  );
}
