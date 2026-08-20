import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, ShieldCheck, Smartphone, Truck } from "lucide-react";

/**
 * PUBLIC live demo landing — the link that gets posted where oilfield people
 * hang out. One tap seeds a PRIVATE copy of the Caprock demo yard and signs
 * the visitor into the real app (see /demo/start). This page deliberately
 * renders NO live dashboard exhibit: the one it used to have drifted from
 * the seeded yard and told a second story. One yard, one cast, everywhere —
 * the only preview here is the showcase proof, generated from the SAME seed
 * the visitor is about to drive.
 *
 * Every signup CTA goes through /demo/exit (signs out a demo session first)
 * because /signup bounces signed-in users back to /app — a plain link
 * silently boomerangs.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SYNNR — live demo",
  description: "Drive the actual yard-readiness board — your own private demo yard, no signup, no card. This is what a shop leaves open all day.",
};

const DEMO_PROOF = "/proof/c7aae8c1e1a64d5eab617b46990f43932d78";

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ busy?: string; err?: string }> }) {
  const { busy, err } = await searchParams;
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-10 md:px-8">
        {/* Header */}
        <div className="flex flex-col gap-5">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">SYNNR · live demo</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Drive the actual product.<br /><span className="text-ink-dim">Your own private yard, one tap.</span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-dim sm:text-base">
            You get a fresh copy of <span className="text-ink">Caprock Coil &amp; Pressure Control</span> —
            a fictional Odessa coil tubing outfit with 20 units, 45 hands, and this morning&apos;s
            problems already on the board: a dead BOP test, a lapsed DOT, an operator whose H2S
            expired yesterday. Run the readiness check, open the red tiles, fix a cert and watch
            it go green. It&apos;s your copy alone — nothing you click touches anyone else&apos;s, and it
            shreds itself after 24 hours.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action="/demo/start" method="post">
              <button type="submit" className="flex min-h-13 cursor-pointer items-center gap-2 rounded-lg bg-bone px-6 text-base font-semibold text-coal hover:bg-bone-soft">
                <Truck className="h-5 w-5" /> Open the demo yard <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <a href="/demo/exit" className="flex min-h-13 items-center rounded-lg border border-line-2 px-5 text-sm text-ink hover:bg-elevated">
              Start your own instead
            </a>
          </div>
          <p className="text-xs text-ink-faint">No signup. No card. Fake data, real product.</p>
          {busy ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              The demo yard&apos;s getting a lot of traffic right now — give it a few minutes and tap again.
            </p>
          ) : err ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Couldn&apos;t spin up your demo yard just now — try once more. If it keeps up, the proof link below still shows the goods.
            </p>
          ) : null}
        </div>

        {/* The two artifacts — both generated from the SAME seed the visitor drives */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><ShieldCheck className="h-5 w-5 text-emerald-400" /></span>
            <h2 className="text-lg font-semibold">Peek before you drive</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              The readiness proof — the live link a shop hands a company man instead of
              assembling a binder. This one&apos;s generated from the same Caprock yard you&apos;re
              about to get a copy of: same trucks, same hands, same dead BOP test on CT-03.
            </p>
            <a href={DEMO_PROOF} target="_blank" rel="noreferrer"
              className="mt-1 flex min-h-11 w-fit items-center gap-1.5 rounded-lg bg-bone px-4 text-sm font-semibold text-coal hover:bg-bone-soft">
              Open the proof <ArrowRight className="h-4 w-4" />
            </a>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><Smartphone className="h-5 w-5 text-ink-dim" /></span>
            <h2 className="text-lg font-semibold">It fits in a cab</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              The same yard on a phone: the verdict in sunlight-readable red, one button to fix
              it, and certs that renew from a photo of the new card. Try it — the demo works on
              your phone too.
            </p>
            <Image src="/screens/mobile-verdict.png" alt="SYNNR on a phone: NOT READY — CT-03 can't roll, with one button to fix it"
              width={250} height={512} className="mx-auto mt-2 w-40 rounded-2xl border border-line" />
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
            <a href="/demo/exit" className="flex min-h-12 items-center gap-1.5 rounded-lg bg-bone px-5 font-semibold text-coal hover:bg-bone-soft">
              Start your yard <ArrowRight className="h-4 w-4" />
            </a>
            <a href="/" className="flex min-h-12 items-center rounded-lg border border-line-2 px-5 text-sm text-ink hover:bg-elevated">
              Back to the site
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
