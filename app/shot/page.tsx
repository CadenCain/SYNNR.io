import type { Metadata } from "next";
import DashboardView from "@/app/app/_components/dashboard-view";
import { demoDashboardProps } from "./fixtures";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Screenshot harness. Renders the REAL dashboard component with the shared
 * demo dataset (app/shot/fixtures.ts — also feeds /demo) so headless Chrome
 * can photograph the actual product for the marketing site — the pictures
 * can never drift from what ships. noindexed; it's a camera stand. The
 * public, linkable version of this is /demo.
 */
export default function Shot() {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <main className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8 md:px-8">
        <DashboardView {...demoDashboardProps()} />
      </main>
    </div>
  );
}
