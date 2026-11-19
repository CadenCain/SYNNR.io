import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "./_site/chrome";
import AccessForm from "./_site/access-form";
import { AccessLink } from "./_site/access-link";
import { AnswerShot, NoAnswerShot } from "./_site/brain-shots";
import { TryDemo } from "./_site/try-demo";
import { Section, Site, body, cta, fine, h2, h3, label, quiet, wrap } from "./_site/ui";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * synnr.io. One idea a screen, in the order an owner would ask: what is it,
 * how does it work, what would I ask it, can I trust it, whose is it, who
 * built it, how do I get it. The first thing on the page after the headline
 * is the product itself: a real question with the clause that answers it.
 * Every document shown is a sample and says so; nothing here is a made-up
 * customer or result. The page describes what runs today, and names the two
 * things that don't yet.
 */

const STEPS: { title: string; body: string; note: string | null }[] = [
  {
    title: "Feed it your shop.",
    body: "Upload SOPs, MSAs, operation notes, pricing, and the way you actually run jobs.",
    note: "PDF, Word, or plain text today. A scan or a spreadsheet can’t be read yet.",
  },
  {
    title: "Ask it anything.",
    body: "Paste a dispatcher text. Ask what the MSA says about standby. Pull the procedure.",
    note: null,
  },
  {
    title: "Get the answer from your documents.",
    body: "It cites the source. If your shop hasn’t given it the information, it says so.",
    note: "Today the answer is the passage itself, word for word. Writing it out in plain words is being turned on.",
  },
];

const EXAMPLES: [string, string][] = [
  ["What do we take on a 5-1/2 plug and cement?", "From your job list and SOP. Exact items. Source cited."],
  ["What does our MSA say about standby time?", "The clause. Nothing added."],
  ["How do we rig this up?", "Your procedure, or it tells you it doesn’t have it."],
];

const TRUST: [string, string][] = [
  ["It builds from your shop.", "What the internet thinks the job takes doesn’t count."],
  ["It shows where it got it.", "Every answer points back to the document and section you uploaded."],
  ["It says when it doesn’t know.", "On a job, a guess is worse than no answer."],
];

export default function Home() {
  return (
    <Site>
      <SiteNav />

      <main>
        {/* What it is, and the product itself */}
        <section>
          <div className={`${wrap} pb-24 pt-14 md:pb-40 md:pt-20 lg:pt-24`}>
            <h1 className="text-[clamp(34px,10.4vw,138px)] font-medium leading-[0.92] tracking-[-0.06em] text-ink">
              The operating brain <span className="sm:block">of your shop.</span>
            </h1>
            <div className="mt-8 max-w-[640px] md:mt-12">
              <p className="text-[18px] leading-[1.45] text-ink-dim md:text-[22px]">
                Your SOPs, MSAs, job knowledge, and pricing. Available to anyone on the crew, anytime.
              </p>
              <p className="mt-3 text-[18px] leading-[1.45] text-ink md:text-[22px]">Grounded in your data. Nothing invented.</p>
              <AccessLink className={`${cta} mt-9 w-full sm:w-auto`}>Request early access</AccessLink>
            </div>

            <div className="mt-16 md:mt-20">
              <AnswerShot />
              <div className="mt-4 flex flex-col gap-x-6 sm:flex-row sm:items-center sm:justify-between">
                <p className={fine}>A sample shop. Every document in it is made up. Yours answers from your own.</p>
                <TryDemo className={`${quiet} shrink-0 cursor-pointer text-[14px]`}>Ask the sample shop yourself</TryDemo>
              </div>
            </div>
          </div>
        </section>

        <Section id="how" name="How it works">
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.title} className={`synnr-reveal grid gap-x-10 gap-y-4 py-9 md:grid-cols-12 md:py-14 ${i > 0 ? "border-t border-line" : "pt-0 md:pt-0"}`}>
                <span className="text-[14px] tabular-nums text-ink-faint md:col-span-1 md:pt-3">{i + 1}</span>
                <h3 className={`${h3} md:col-span-6`}>{s.title}</h3>
                <div className="md:col-span-5">
                  <p className={body}>{s.body}</p>
                  {s.note ? <p className={`${fine} mt-3`}>{s.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          <Link href="/product" className={`${quiet} mt-2`}>See each step</Link>
        </Section>

        <Section name="Examples">
          <ul>
            {EXAMPLES.map(([q, a], i) => (
              <li key={q} className={`synnr-reveal grid gap-x-10 gap-y-3 py-8 md:grid-cols-12 md:items-baseline md:py-12 ${i > 0 ? "border-t border-line" : "pt-0 md:pt-0"}`}>
                <p className={`${h3} md:col-span-7`}>&ldquo;{q}&rdquo;</p>
                <p className={`${body} md:col-span-5`}>{a}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section>
          <div className="grid gap-x-10 gap-y-12 md:grid-cols-12">
            <div className="md:col-span-7">
              <h2 className={`${h2} synnr-reveal`}>It doesn&rsquo;t guess.</h2>
              <div className="synnr-reveal mt-10 max-w-[520px] md:mt-16"><NoAnswerShot /></div>
            </div>
            <ul className="md:col-span-5">
              {TRUST.map(([t, b], i) => (
                <li key={t} className={`synnr-reveal py-7 ${i > 0 ? "border-t border-line" : "pt-0 md:pt-3"}`}>
                  <h3 className="text-[22px] font-medium leading-[1.2] tracking-[-0.025em] text-ink md:text-[26px]">{t}</h3>
                  <p className={`${body} mt-2.5`}>{b}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="yours">
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-12">
            <h2 className={`${h2} synnr-reveal md:col-span-7`}>Your data stays yours.</h2>
            <div className="synnr-reveal md:col-span-5 md:pt-3">
              <p className="text-[20px] leading-[1.4] tracking-[-0.015em] text-ink md:text-[24px]">
                We set it up with you. You own everything that goes in.
              </p>
              <p className="mt-4 text-[20px] leading-[1.4] tracking-[-0.015em] text-ink md:text-[24px]">
                Nothing is used to train models for other companies.
              </p>
              <Link href="/security" className={`${quiet} mt-7`}>Exactly what happens to your documents</Link>
            </div>
          </div>
        </Section>

        <Section name="Who built it">
          <div className="synnr-reveal grid gap-x-10 md:grid-cols-12">
            <div className="md:col-span-9">
              <p className="text-[24px] leading-[1.25] tracking-[-0.025em] text-ink md:text-[38px] md:leading-[1.18] md:tracking-[-0.035em]">
                What a service company knows lives in a price book nobody can find, a binder in the shop, and the head
                of whoever&rsquo;s been there longest. SYNNR puts it where the whole crew can ask.
              </p>
              <p className={`${body} mt-8`}>Built by Caden Cain, who ran wireline in the Permian for five years.</p>
            </div>
          </div>
        </Section>

        <Section id="access">
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-12">
            <div className="md:col-span-6">
              <h2 className={h2}>Request access.</h2>
              <p className={`${body} mt-7 max-w-[440px]`}>
                Early access for oilfield service companies. Leave a number. Caden will call, look at what you run,
                and tell you straight whether it&rsquo;s ready for your shop.
              </p>
            </div>
            <div className="md:col-span-6 md:pt-3">
              <div className={`${label} mb-5 md:hidden`}>Your details</div>
              <AccessForm />
            </div>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </Site>
  );
}
