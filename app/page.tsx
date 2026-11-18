import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "./_site/chrome";
import AccessForm from "./_site/access-form";
import { AccessLink } from "./_site/access-link";
import { AskShot, BrainShot } from "./_site/brain-shots";
import { TryDemo } from "./_site/try-demo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * synnr.io. What SYNNR is, in the order a service company's owner would
 * ask: what is it, why would I want it, how does it work, can I trust what
 * it says, what happens to my documents, who built it, how do I get it.
 * It's in early access, so there are two things to do here: try it on a
 * sample shop, or ask for it. Every document on the page is a sample;
 * nothing here is a made-up customer or result. The page says what runs
 * today, and labels the one part that's still being turned on.
 */

const STEPS: { title: string; body: string; note?: string }[] = [
  {
    title: "Put your documents in",
    body: "Procedures, MSAs, price sheets, job reports: PDF, Word, or plain text. Then the things nobody ever wrote down, typed in the way you'd tell a new hand. We do the first load with you.",
  },
  {
    title: "Ask, or paste the job",
    body: "A hand asks the way he'd ask the office. Or paste a job the way dispatch sent it, and SYNNR pulls what your documents say about that job.",
  },
  {
    title: "Get it from what you know",
    body: "It shows the passages that answer it, word for word, with the document and the section they're from. One tap opens the document at that spot.",
    note: "Being turned on now: the answer written out in plain words from those passages, each part tied to the passage it came from.",
  },
];

const ASKS = [
  "What do we take on a 5-1/2 plug?",
  "What does our MSA say about standby?",
  "How do we rig this up?",
  "What do we charge past twelve hours?",
  "Who pays if a tool is lost in the hole?",
  "What do we do with the BOP when we get back?",
];

const TRUST: { title: string; body: string }[] = [
  {
    title: "Only your documents",
    body: "It answers from what your shop put in, and nothing else. What the internet thinks your job takes doesn't count.",
  },
  {
    title: "It shows the passage",
    body: "Every answer comes with the passage it came from: the document, the section, the page. You can check it in ten seconds.",
  },
  {
    title: "It says when it doesn't know",
    body: "On a job, a guess is worse than no answer. If it isn't in your documents, SYNNR says so and leaves it there.",
  },
];

const YOURS: { title: string; body: string }[] = [
  {
    title: "Only your crew",
    body: "Nobody outside your company can read what you put in, and it's never used to answer another company's question.",
  },
  {
    title: "Managers only, when it should be",
    body: "Mark a price sheet or a customer's terms managers only. A hand's question never searches it and never shows it.",
  },
  {
    title: "Out when you say",
    body: "Take a document out and nothing is answered from it again. Download everything it has read, any time, in one file.",
  },
];

const wrap = "mx-auto w-full max-w-6xl px-5 md:px-10";
const h2 = "text-[30px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink md:text-[48px]";
const lede = "mt-5 max-w-xl text-[16px] leading-[1.6] text-ink-dim md:text-[18px]";

export default function Home() {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <SiteNav />

      <main>
        {/* What it is */}
        <section className="synnr-grid">
          <div className={`${wrap} pb-16 pt-14 md:pb-24 md:pt-24`}>
            <p className="flex items-center gap-2.5 text-[13px] text-ink-dim">
              <span aria-hidden className="h-1.5 w-1.5 rounded-[1px] bg-bone" />
              For oilfield service companies. Early access.
            </p>
            <h1 className="mt-6 text-[clamp(40px,7.2vw,84px)] font-semibold leading-[0.98] tracking-[-0.045em]">
              <span className="block text-ink">The brain</span>
              <span className="block text-[#62666e]">of your shop.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-ink-dim md:text-[20px]">
              Your procedures, your MSAs, your price sheet, and what nobody ever wrote down, in one place the whole
              crew can ask. It answers from your own documents and shows the passage. If it isn&apos;t in there, it
              says so.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <AccessLink className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white">
                Request access
              </AccessLink>
              <TryDemo className="flex h-12 w-full items-center justify-center rounded-lg border border-line-2 bg-coal px-6 text-[15px] text-ink transition-colors hover:bg-elevated sm:w-auto">
                Try it on a sample shop
              </TryDemo>
            </div>

            <div className="mt-14 md:mt-20">
              <AskShot />
              <p className="mt-4 text-[14px] leading-relaxed text-ink-faint">
                A sample shop, and every document in it is made up. Yours answers from your own.
              </p>
            </div>
          </div>
        </section>

        {/* Why */}
        <section className="border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-28`}>
            <h2 className={`${h2} synnr-reveal`}>Somebody in the shop knows. It&apos;s 4 AM.</h2>
            <div className="synnr-reveal max-w-2xl">
              <p className="text-[18px] leading-[1.55] text-ink md:text-[22px]">
                What the MSA says about standby. What you charge past twelve hours. How this shop rigs up on a well
                like this one.
              </p>
              <p className="mt-5 text-[16px] leading-[1.6] text-ink-dim md:text-[18px]">
                It&apos;s all written down somewhere, or it&apos;s in the head of whoever&apos;s been there longest.
                On location, nobody can find the binder and nobody&apos;s answering the phone, so a hand guesses.
                SYNNR puts what your shop knows where anyone on the crew can ask it from a phone.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-14 border-t border-line">
          <div className={`${wrap} py-16 md:py-28`}>
            <h2 className={`${h2} synnr-reveal max-w-3xl`}>Your documents in. Your answers out.</h2>
            <div className="mt-10 grid border-t border-line md:mt-16 md:grid-cols-3">
              {STEPS.map((g, i) => (
                <div key={g.title} className={`synnr-reveal border-b border-line py-8 md:py-10 ${i > 0 ? "md:border-l md:pl-8" : ""} ${i < STEPS.length - 1 ? "md:pr-8" : ""}`}>
                  <div className="font-mono text-[13px] tabular-nums text-bone">{i + 1}</div>
                  <h3 className="mt-4 text-[20px] font-medium tracking-[-0.015em] text-ink">{g.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-dim">{g.body}</p>
                  {g.note ? <p className="mt-3 text-[14px] leading-[1.6] text-ink-faint">{g.note}</p> : null}
                </div>
              ))}
            </div>
            <Link href="/product" className="mt-6 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink underline-offset-4 hover:underline">
              See how it works, step by step
            </Link>
          </div>
        </section>

        {/* What to ask */}
        <section className="border-t border-line">
          <div className={`${wrap} py-16 md:py-28`}>
            <div className="synnr-reveal">
              <h2 className={h2}>Ask it what you&apos;d ask the office.</h2>
              <p className={lede}>
                Anything your shop has written down, or told it. The more you put in, the more it can answer.
              </p>
            </div>
            <ul className="mt-10 grid border-t border-line md:mt-16 md:grid-cols-2 md:gap-x-16">
              {ASKS.map((q) => (
                <li key={q} className="synnr-reveal border-b border-line py-5 text-[19px] leading-snug tracking-[-0.01em] text-ink md:py-6 md:text-[22px]">{q}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Can I trust it */}
        <section className="border-t border-line">
          <div className={`${wrap} grid gap-10 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-28`}>
            <h2 className={`${h2} synnr-reveal`}>It doesn&apos;t guess.</h2>
            <div className="border-t border-line">
              {TRUST.map((t) => (
                <div key={t.title} className="synnr-reveal border-b border-line py-7">
                  <h3 className="text-[19px] font-medium tracking-[-0.01em] text-ink">{t.title}</h3>
                  <p className="mt-2 max-w-xl text-[15px] leading-[1.6] text-ink-dim">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Whose it is */}
        <section id="yours" className="scroll-mt-14 border-t border-line">
          <div className={`${wrap} grid items-start gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-28`}>
            <div>
              <div className="synnr-reveal">
                <h2 className={h2}>You own what you put in.</h2>
                <p className={lede}>
                  How your shop does things is worth something. It stays in your company, it&apos;s only ever used to
                  answer your own crew, and you can have it back any time.
                </p>
              </div>
              <div className="mt-8 border-t border-line">
                {YOURS.map((t) => (
                  <div key={t.title} className="synnr-reveal border-b border-line py-6">
                    <h3 className="text-[18px] font-medium tracking-[-0.01em] text-ink">{t.title}</h3>
                    <p className="mt-2 max-w-xl text-[15px] leading-[1.6] text-ink-dim">{t.body}</p>
                  </div>
                ))}
              </div>
              <Link href="/security" className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink underline-offset-4 hover:underline">
                Exactly what happens to your documents
              </Link>
            </div>
            <div className="synnr-reveal"><BrainShot /></div>
          </div>
        </section>

        {/* On the job */}
        <section className="border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24`}>
            <h2 className="synnr-reveal text-[24px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink md:text-[32px]">It can run the job too.</h2>
            <div className="synnr-reveal max-w-2xl">
              <p className="text-[16px] leading-[1.6] text-ink-dim md:text-[18px]">
                If you want it to, SYNNR turns a job into a list to load by, built from your own job lists, with a
                photo of each piece that stops the job and of the gear put away after. Your manager sees every truck
                from his phone. Use it or don&apos;t: the brain works without it.
              </p>
              <Link href="/product#jobs" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink underline-offset-4 hover:underline">
                How a job runs
              </Link>
            </div>
          </div>
        </section>

        {/* Who's behind it */}
        <section className="border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-28`}>
            <div className="text-[14px] text-ink-faint md:pt-2">Who built it</div>
            <div className="synnr-reveal max-w-2xl">
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
        <section id="access" tabIndex={-1} className="scroll-mt-14 border-t border-line outline-none">
          <div className={`${wrap} grid gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-28`}>
            <div>
              <h2 className={h2}>Request access.</h2>
              <p className="mt-5 max-w-md text-[16px] leading-[1.6] text-ink-dim">
                SYNNR is in early access for oilfield service companies in the Permian. Leave a number and Caden
                will call you, look at what you run, and tell you straight whether it&apos;s ready for your shop. If
                it is, he loads your first documents with you.
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
