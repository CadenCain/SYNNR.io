import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Smartphone } from "lucide-react";
import DashboardView from "@/app/app/_components/dashboard-view";
import { demoDashboardProps } from "@/app/shot/fixtures";

/**
 * PUBLIC live demo — the link that gets posted where oilfield people hang
 * out. No signup, no code to redeem, nothing to install: the real dashboard
 * component rendered with a fictional two-yard shop, plus a REAL readiness
 * proof link (the artifact a customer hands a company man). The dashboard
 * exhibit is pointer-inert so its internal links don't dead-end at the
 * login wall; the proof link is fully live.
 */

export const dynamic = "force-dynamic"; // the 14-day window must be TODAY's, not the deploy day's

export const metadata: Metadata = {
  title: "SYNNR — live demo",
  description: "The actual yard-readiness board, live with demo data. No signup. This is what a shop leaves open all day.",
};

const DEMO_PROOF = "/proof/111bed6bb1722b779dbc701a0e32a557abe3";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ busy?: string; err?: string }> }) {
  const { busy, err } = await searchParams;
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10 md:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">SYNNR · live demo</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Drive the actual product.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-dim">
              One tap gets you a private copy of a working coil tubing yard — 20 units,
              45 hands, real red tiles. Run the readiness check, fix a dead cert, watch
              it go green. No signup, no card, and nothing you click touches anyone else.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <form action="/demo/start" method="post">
              <button type="submit" className="flex min-h-12 cursor-pointer items-center gap-1.5 rounded-lg bg-bone px-5 text-sm font-semibold text-coal hover:bg-bone-soft">
                Open the demo yard <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <Link href="/signup" className="flex min-h-12 items-center rounded-lg border border-line-2 px-4 text-sm text-ink hover:bg-elevated">
              Start your own
            </Link>
          </div>
        </div>
        {busy ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            The demo yard&apos;s getting a lot of traffic right now — give it a few minutes and tap again.
          </p>
        ) : err ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            Couldn&apos;t spin up your demo yard just now — try once more, and if it sticks, the tour below shows everything anyway.
          </p>
        ) : null}

        {/* Exhibit 1: the command center, live-rendered */}
        <div className="mt-8 rounded-2xl border border-line bg-surface/40 p-2 sm:p-4">
          <div className="flex items-center justify-between px-2 pb-3 pt-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-faint">The board a shop leaves open all day</span>
            <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400">demo data — look, don&apos;t worry</span>
          </div>
          {/* pointer-inert: this is an exhibit of the live component, not the
              app — its internal links would just hit the login wall. */}
          <div className="pointer-events-none select-none" aria-hidden>
            <DashboardView {...demoDashboardProps()} />
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-ink-faint">
          Rig 4 is red because a BOP is flagged missing and the DOT lapsed — and it stays red until somebody fixes the record. That red tile is the product.
        </p>

        {/* Exhibit 2: the real proof link */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><ShieldCheck className="h-5 w-5 text-emerald-400" /></span>
            <h2 className="text-lg font-semibold">Open a real readiness proof</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              This one&apos;s fully live — the shareable link a shop hands a company man
              instead of assembling a binder. Every cert, every date, every gap, current
              as of the second you open it.
            </p>
            <a href={DEMO_PROOF} target="_blank" rel="noreferrer"
              className="mt-1 flex min-h-11 w-fit items-center gap-1.5 rounded-lg bg-bone px-4 text-sm font-semibold text-coal hover:bg-bone-soft">
              Open the proof <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><Smartphone className="h-5 w-5 text-ink-dim" /></span>
            <h2 className="text-lg font-semibold">And on a phone in the yard</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              The verdict, glare-readable, with one button to fix it. Certs renew from the
              cab: shoot the new card, confirm the date it read off the photo, done.
            </p>
            <Image src="/screens/mobile-verdict.png" alt="SYNNR on a phone: NOT READY — Rig 4 can't roll, with one button to fix it"
              width={250} height={512} className="mx-auto mt-2 w-44 rounded-2xl border border-line" />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="text-xl font-semibold">Your yard could look like this by Friday.</h2>
          <p className="max-w-md text-sm text-ink-dim">
            Bring your binder — import it or photograph it in. $500 a yard, monthly, no contract.
            First miss it catches pays for the year.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link href="/signup" className="flex min-h-12 items-center gap-1.5 rounded-lg bg-bone px-5 font-semibold text-coal hover:bg-bone-soft">
              Start your yard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/" className="flex min-h-12 items-center rounded-lg border border-line-2 px-5 text-sm text-ink hover:bg-elevated">
              Back to the site
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
