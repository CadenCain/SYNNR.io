import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "./_site/chrome";
import HeroAsk from "./_site/hero-ask";
import AccessForm from "./_site/access-form";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * synnr.io. One page: what SYNNR is, what a crew asks it, how it learns a
 * company, and how to get in. It's in early access, so the only thing to do
 * here is ask for it. Nothing on this page is a made-up number or customer.
 */

const ASKS: { who: string; lines: string[] }[] = [
  {
    who: "In the truck",
    lines: [
      "What do I need to take on this job?",
      "Make me a checklist for a plug and perf.",
      "Make me a perf run sheet for 3 stages.",
    ],
  },
  {
    who: "In the office",
    lines: [
      "What do we charge for this?",
      "Read this signed ticket and tell me what to bill.",
      "What does the MSA say about standby time?",
    ],
  },
  {
    who: "Running the company",
    lines: [
      "Who got that job?",
      "Which truck is set up for bond logs?",
      "Who has the setting tools out right now?",
    ],
  },
];

const HOW: { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "It learns your company",
    body: "Your price book, MSAs, procedures, job lists, trucks and tools. PDFs, spreadsheets, Word files, or a phone photo of paper. It picks up the words your crew already uses.",
  },
  {
    n: "2",
    title: "Everybody asks the same brain",
    body: "Each person gets their own login and their own chats. What the company knows is shared, so a new hand gets the same answer the owner would give.",
  },
  {
    n: "3",
    title: "It tells you where it got it",
    body: "Answers come from what your company gave it, with the page they came from. If it doesn't know, it says so. It doesn't guess at a price or a procedure.",
  },
];

const wrap = "mx-auto w-full max-w-6xl px-5 md:px-10";
const h2 = "text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink md:text-[40px]";

export default function Home() {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <SiteNav />

      <main>
        {/* What it is */}
        <section className={`${wrap} pb-16 pt-16 md:pb-24 md:pt-28`}>
          <p className="flex items-center gap-2.5 text-[13px] text-ink-dim">
            <span aria-hidden className="h-1.5 w-1.5 rounded-[1px] bg-bone" />
            Early access. Wireline first.
          </p>
          <h1 className="mt-6 max-w-4xl text-[46px] font-semibold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[72px] md:text-[92px]">
            Ask your company anything.
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-ink-dim md:text-[20px]">
            SYNNR is an AI that learns your service company: what you charge, what your contracts say, how your crews
            do the job, what&apos;s on every truck. Then anybody on the payroll can ask it, from the office or the
            truck.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="#access" className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white">
              Request access
            </Link>
            <a href={OWNER_PHONE_TEL} className="flex h-12 items-center justify-center rounded-lg border border-line-2 px-6 text-[15px] text-ink transition-colors hover:bg-elevated">
              Call or text {OWNER_PHONE}
            </a>
          </div>

          <div className="mt-16 md:mt-24">
            <HeroAsk />
            <p className="mt-4 text-[14px] text-ink-faint">That bar is the whole product. No dashboards to learn.</p>
          </div>
        </section>

        {/* What people ask it */}
        <section className="border-t border-line">
          <div className={`${wrap} py-16 md:py-24`}>
            <h2 className={h2}>Everybody asks it something different.</h2>
            <div className="mt-10 border-t border-line md:mt-14">
              {ASKS.map((a) => (
                <div key={a.who} className="grid gap-3 border-b border-line py-7 md:grid-cols-[220px_1fr] md:gap-10 md:py-9">
                  <div className="text-[14px] text-ink-faint md:pt-1">{a.who}</div>
                  <ul className="flex flex-col gap-2.5">
                    {a.lines.map((l) => (
                      <li key={l} className="text-[19px] leading-snug tracking-[-0.01em] text-ink md:text-[24px]">{l}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-line">
          <div className={`${wrap} py-16 md:py-24`}>
            <h2 className={h2}>It knows your company, not the internet.</h2>
            <div className="mt-10 grid border-t border-line md:mt-14 md:grid-cols-3">
              {HOW.map((s, i) => (
                <div key={s.n} className={`border-b border-line py-8 md:py-10 ${i > 0 ? "md:border-l md:pl-8" : ""} ${i < HOW.length - 1 ? "md:pr-8" : ""}`}>
                  <div className="font-mono text-[13px] tabular-nums text-bone">{s.n}</div>
                  <h3 className="mt-4 text-[19px] font-medium tracking-[-0.01em] text-ink">{s.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-dim">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Who's behind it */}
        <section className="border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[220px_1fr] md:gap-10 md:py-24`}>
            <div className="text-[14px] text-ink-faint md:pt-2">Who built it</div>
            <div className="max-w-2xl">
              <p className="text-[22px] leading-[1.35] tracking-[-0.015em] text-ink md:text-[28px]">
                What a service company knows lives in a price book nobody can find, a binder in the shop, and the head
                of whoever&apos;s been there longest. SYNNR puts it where the whole crew can ask.
              </p>
              <p className="mt-6 text-[15px] leading-relaxed text-ink-dim">
                Built by Caden Cain, who ran wireline in the Permian for five years.
              </p>
            </div>
          </div>
        </section>

        {/* Get in */}
        <section id="access" className="scroll-mt-14 border-t border-line">
          <div className={`${wrap} grid gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24`}>
            <div>
              <h2 className={h2}>Request access.</h2>
              <p className="mt-5 max-w-md text-[16px] leading-[1.6] text-ink-dim">
                SYNNR is in early access and built for wireline companies first. Leave a number and Caden will
                call you, look at what you run on, and tell you straight whether it&apos;s ready for your shop.
              </p>
            </div>
            <AccessForm />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
