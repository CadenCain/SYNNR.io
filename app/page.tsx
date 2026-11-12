import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "./_site/chrome";
import Console from "./_site/console";
import Toolstring from "./_site/toolstring";
import AccessForm from "./_site/access-form";
import { AccessLink } from "./_site/access-link";
import { AfterShot, BoardShot } from "./_site/shots";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * synnr.io. What SYNNR does, in the order a wireline manager would ask: what
 * is it, what do I get, can I trust it, who built it, how do I get it. It's
 * in early access, so the only thing to do here is ask for it. The job shown
 * is a sample; nothing here is a made-up customer or result.
 */

const GET: { title: string; body: string }[] = [
  {
    title: "What to take",
    body: "What your shop takes on that kind of job, with the pieces that stop the job at the top of the list.",
  },
  {
    title: "A checklist to load by",
    body: "Tap each piece as it goes on. A critical piece only goes on with a photo of it. Anyone in the company can see what's loaded and what's still missing.",
  },
  {
    title: "Ready, or not",
    body: "When everything's on, the truck reads READY with who loaded it, when, and the photos. One link sends that to the customer. Until then it says exactly what's missing.",
  },
];

const ASKS = [
  "What do I need to set a packer in 5-1/2 casing?",
  "What goes out on a pipe recovery job?",
  "Which cable head goes with this string?",
  "What do we charge for a bond log to 8,000 ft?",
  "What does the MSA say about standby time?",
  "Who has the setting tools out right now?",
];

const TRUST: { title: string; body: string }[] = [
  {
    title: "It builds from your shop",
    body: "Your job lists, in your words. What the internet thinks a wireline job takes doesn't count.",
  },
  {
    title: "It shows where it got it",
    body: "Every line on a checklist comes from your shop's list, or from someone on your crew who added it. Nothing is made up.",
  },
  {
    title: "It says when it doesn't know",
    body: "On explosives and pressure control, a guess is worse than no answer. If your shop hasn't given it a list for a job, SYNNR says so and leaves the list empty instead of making one up.",
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
              Operations AI for wireline. Early access.
            </p>
            <h1 className="mt-6 text-[clamp(40px,7.2vw,84px)] font-semibold leading-[0.98] tracking-[-0.045em]">
              <span className="block text-ink">Tell it the job.</span>
              <span className="block text-[#62666e]">It tells you what to take.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-ink-dim md:text-[20px]">
              Say what you&apos;re running. SYNNR gives your crew what the job takes with the critical pieces
              first, a checklist to load by with a photo of what matters, and a plain READY or NOT READY before
              the truck rolls.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <AccessLink className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white">
                Request access
              </AccessLink>
              <a href={OWNER_PHONE_TEL} className="flex h-12 items-center justify-center rounded-lg border border-line-2 bg-coal px-6 text-[15px] text-ink transition-colors hover:bg-elevated">
                Call or text {OWNER_PHONE}
              </a>
            </div>

            <div className="mt-14 md:mt-20">
              <Console />
              <p className="mt-4 text-[14px] leading-relaxed text-ink-faint">
                A sample job. Yours runs on your trucks, your gear, and the way your shop does it.
              </p>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section id="what" className="scroll-mt-14 border-t border-line">
          <div className={`${wrap} py-16 md:py-28`}>
            <h2 className={`${h2} synnr-reveal max-w-3xl`}>One job in. Everything it takes, out.</h2>
            <div className="mt-10 grid border-t border-line md:mt-16 md:grid-cols-3">
              {GET.map((g, i) => (
                <div key={g.title} className={`synnr-reveal border-b border-line py-8 md:py-10 ${i > 0 ? "md:border-l md:pl-8" : ""} ${i < GET.length - 1 ? "md:pr-8" : ""}`}>
                  <div className="font-mono text-[13px] tabular-nums text-bone">{i + 1}</div>
                  <h3 className="mt-4 text-[20px] font-medium tracking-[-0.015em] text-ink">{g.title}</h3>
                  <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-dim">{g.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The manager's view */}
        <section className="border-t border-line">
          <div className={`${wrap} py-16 md:py-28`}>
            <div className="synnr-reveal">
              <h2 className={h2}>Every truck, before it rolls.</h2>
              <p className={lede}>
                One screen for the manager: every job the yard is loading for, how much is on, and how many critical
                pieces are still off. No walking the yard and no calling around at 5 AM.
              </p>
            </div>
            <div className="synnr-reveal mt-10 md:mt-14"><BoardShot /></div>
            <Link href="/product" className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink underline-offset-4 hover:underline">
              See how it works, step by step
            </Link>
          </div>
        </section>

        {/* After the job */}
        <section className="border-t border-line">
          <div className={`${wrap} grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-28`}>
            <div className="synnr-reveal">
              <h2 className={h2}>And after the job.</h2>
              <p className={lede}>
                Getting back in is where steps get skipped. When the job&apos;s done, the crew proves the gear was put
                away right: rams closed for travel, the package washed. A photo of each, with who took it and when.
              </p>
              <p className="mt-4 max-w-xl text-[16px] leading-[1.6] text-ink-dim md:text-[18px]">
                The manager sees it from his phone. A truck still missing a photo the next morning is in his email.
              </p>
            </div>
            <div className="synnr-reveal"><AfterShot /></div>
          </div>
        </section>

        {/* Ask it */}
        <section className="border-t border-line">
          <div className={`${wrap} py-16 md:py-28`}>
            <div className="synnr-reveal">
              <p className="text-[13px] text-ink-faint">Being built now</p>
              <h2 className={`${h2} mt-3`}>Then ask it anything.</h2>
              <p className={lede}>
                The same SYNNR that preps the job will answer for the rest of the company. Everybody gets their own
                login, and everybody asks the same brain.
              </p>
            </div>
            <ul className="mt-10 grid border-t border-line md:mt-16 md:grid-cols-2 md:gap-x-16">
              {ASKS.map((q) => (
                <li key={q} className="synnr-reveal border-b border-line py-5 text-[19px] leading-snug tracking-[-0.01em] text-ink md:py-6 md:text-[22px]">{q}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Wireline */}
        <section id="wireline" className="scroll-mt-14 border-t border-line">
          <div className={`${wrap} py-16 md:py-28`}>
            <div className="synnr-reveal">
              <h2 className={h2}>Wireline first.</h2>
              <p className={lede}>
                SYNNR starts with the work we know, down to the cable head and the setting tool. Then it learns the
                sizes, the vendors, and the names your shop uses for all of it.
              </p>
            </div>
            <div className="synnr-reveal mt-12 rounded-2xl border border-line bg-[#0b0c0e] px-5 py-9 md:mt-16 md:px-10 md:py-12">
              <Toolstring />
            </div>
            <p className="mt-4 text-[14px] text-ink-faint">A plug setting string, from the truck end down.<span className="md:hidden"> Swipe to follow it.</span></p>
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
                SYNNR is in early access and built for wireline companies first. Leave a number and Caden will
                call you, look at what you run, and tell you straight whether it&apos;s ready for your shop.
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
