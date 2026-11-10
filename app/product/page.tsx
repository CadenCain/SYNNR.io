import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "../_site/chrome";
import { BoardShot, DispatchShot, JobShot, ListShot, ReadShot } from "../_site/shots";

export const metadata: Metadata = {
  title: "How SYNNR works",
  description: "From the dispatch to a truck that reads READY: your shop's job lists, the dispatch you already get, a checklist the crew taps, and a board the manager can see.",
  alternates: { canonical: "/product" },
};

const wrap = "mx-auto w-full max-w-6xl px-5 md:px-10";

function Step({ n, title, children, visual, flip = false, wide = false }: { n: number; title: string; children: React.ReactNode; visual: React.ReactNode; flip?: boolean; wide?: boolean }) {
  return (
    <section className="border-t border-line">
      <div className={`${wrap} grid items-center gap-10 py-16 md:py-24 ${wide ? "md:gap-12" : "md:grid-cols-2 md:gap-16"}`}>
        <div className={`synnr-reveal ${flip ? "md:order-2" : ""}`}>
          <div className="font-mono text-[13px] tabular-nums text-bone">{n}</div>
          <h2 className="mt-4 text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink md:text-[38px]">{title}</h2>
          <div className="mt-5 flex max-w-md flex-col gap-4 text-[16px] leading-[1.6] text-ink-dim">{children}</div>
        </div>
        <div className={`synnr-reveal ${flip ? "md:order-1" : ""}`}>{visual}</div>
      </div>
    </section>
  );
}

/** The product, one step at a time, in the order a job actually moves. */
export default function Product() {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <SiteNav />
      <main>
        <section className="synnr-grid">
          <div className={`${wrap} pb-16 pt-14 md:pb-24 md:pt-24`}>
            <p className="text-[13px] text-ink-dim">How it works</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(38px,6.4vw,72px)] font-semibold leading-[1] tracking-[-0.045em] text-ink">
              From the dispatch to a truck that reads ready.
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-ink-dim md:text-[20px]">
              SYNNR sits between the dispatch you already get and the truck leaving the yard. Five steps, and the crew only touches two of them.
            </p>
          </div>
        </section>

        <Step n={1} title="It starts with what your shop takes." visual={<ListShot />}>
          <p>For each kind of job you run, SYNNR holds your list: what goes on the truck, and which pieces stop the job if they&apos;re forgotten.</p>
          <p>It&apos;s your list in your words, not ours. We sit down with you and load them, and a manager can change them any time.</p>
        </Step>

        <Step n={2} title="A job comes in." flip visual={<div className="grid gap-4 sm:grid-cols-2"><DispatchShot /><ReadShot /></div>}>
          <p>Send a photo or a screenshot of the dispatch you already get, or just type the job. SYNNR reads what kind of job it is, the truck, the sizes, and the remarks.</p>
          <p>If the dispatch says to bring something, that goes to the top of the list as critical, with the dispatch&apos;s own words next to it.</p>
          <p>It leaves names and phone numbers out, and the photo isn&apos;t kept.</p>
        </Step>

        <Step n={3} title="The crew loads by the list." visual={<JobShot />}>
          <p>Every piece is one big row. Tap it when it&apos;s on the truck. What stops the job is at the top.</p>
          <p>It works on a phone, with one hand, and it shows who put each piece on and when.</p>
        </Step>

        <Step n={4} title="Ready, or not." flip visual={<JobShot ready />}>
          <p>The truck reads NOT READY, and says exactly what&apos;s missing, until every piece is tapped and someone calls it ready.</p>
          <p>Nobody can call it ready early. If a piece comes back off, or one gets added, it goes back to NOT READY.</p>
        </Step>

        <Step n={5} title="The manager sees every truck." wide visual={<BoardShot />}>
          <p>One screen: every job, how much is loaded, and how many critical pieces are still off. No walking the yard, no calling around at 5 AM.</p>
        </Step>

        <section className="border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24`}>
            <div className="text-[14px] text-ink-faint md:pt-2">What&apos;s next</div>
            <div className="synnr-reveal max-w-2xl">
              <p className="text-[22px] leading-[1.35] tracking-[-0.015em] text-ink md:text-[28px]">
                Asking it questions. What you charge, what a contract says, how your shop does a procedure. Same SYNNR, same company, and it only answers from what you&apos;ve given it.
              </p>
              <p className="mt-6 text-[15px] text-ink-dim">That part is being built now, with wireline first.</p>
              <Link href="/#access" className="mt-8 inline-flex h-12 items-center rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white">Request access</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
