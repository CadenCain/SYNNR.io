import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "../_site/chrome";
import { SHARE_IMAGE } from "../_site/share";

const title = "Your data · SYNNR";
export const metadata: Metadata = {
  title,
  openGraph: { title, description: "What SYNNR does with your company's data, in plain words.", images: SHARE_IMAGE },
  description: "What SYNNR does with your company's documents, in plain words: who can see them, what goes to an AI and what doesn't, and how to get them back.",
  alternates: { canonical: "/security" },
};

const FACTS: { title: string; body: string }[] = [
  {
    title: "Your company is walled off",
    body: "Every document, question, job, and name belongs to one company, and the database itself refuses to show it to anyone outside that company. It's a rule in the database, not a setting in the app.",
  },
  {
    title: "Your documents are never used for another company",
    body: "What you put in is only ever used to answer your own crew. Nothing you load shows up in another company's answers, and SYNNR doesn't train a model on it.",
  },
  {
    title: "Managers only means managers only",
    body: "Mark a document managers only and the database leaves it out of a hand's search. A hand's question can't be answered from it, and a hand can't open it.",
  },
  {
    title: "What goes to an AI, and what doesn't",
    body: "Today nothing you load goes to an AI: SYNNR finds the passages in your documents itself and shows them to you. When written answers are turned on for your account, the question and the few passages that match it go to our AI provider (Anthropic) to write the answer. Your whole library is never sent, and Anthropic's terms for business customers say it may not train its models on what we send.",
  },
  {
    title: "The files stay private",
    body: "The files you load are kept in private storage. Only someone logged in to your company, who is allowed to see that document, can open one.",
  },
  {
    title: "Questions are kept, and seen by the right people",
    body: "What was asked and what came back is saved. A hand sees their own questions. A manager sees what the crew is asking.",
  },
  {
    title: "Proof photos stay private",
    body: "If your crews run jobs in SYNNR, the photos they take are kept with that job in private storage. Only people logged in to your company can open them, unless your crew sends a customer that job's link, which shows one job's list and photos with first names only. A manager can turn a link off, and it stops working right then.",
  },
  {
    title: "A dispatch photo is read, then thrown away",
    body: "Reading a photo of the dispatch is being turned on now; until it is, your crew types the job. When you send one, it goes to Anthropic to be read, and SYNNR keeps only the job facts. It's told to leave names, phone numbers, and emails out, and the photo itself isn't stored.",
  },
  {
    title: "Everybody has their own login",
    body: "No shared passwords. Hands ask, and load trucks. Managers put documents in, take them out, and decide who's on the crew.",
  },
  {
    title: "It's yours, and you can have it back",
    body: "A manager can download everything SYNNR has read, in one file, and each file as it was loaded. Take a document out and nothing is answered from it again. Ask for all of it to be deleted, and we do it. Email cadencain@synnr.io.",
  },
];

const wrap = "mx-auto w-full max-w-6xl px-5 md:px-10";

/** What happens to a company's data, in the order people worry about it. */
export default function Security() {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <SiteNav />
      <main>
        <section className="synnr-grid">
          <div className={`${wrap} pb-16 pt-14 md:pb-24 md:pt-24`}>
            <p className="text-[13px] text-ink-dim">Your data</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(38px,6.4vw,72px)] font-semibold leading-[1] tracking-[-0.045em] text-ink">
              What your shop knows stays your shop&apos;s.
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-ink-dim md:text-[20px]">
              Your procedures, your prices, and your way of doing things are worth something. Here is exactly what SYNNR does with them, in plain words.
            </p>
          </div>
        </section>

        <section className="border-t border-line">
          <div className={`${wrap} py-6 md:py-10`}>
            <div className="grid md:grid-cols-2 md:gap-x-16">
              {FACTS.map((f) => (
                <div key={f.title} className="synnr-reveal border-b border-line py-8 md:py-10">
                  <h2 className="text-[20px] font-medium tracking-[-0.015em] text-ink">{f.title}</h2>
                  <p className="mt-3 max-w-md text-[15px] leading-[1.65] text-ink-dim">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24`}>
            <div className="text-[14px] text-ink-faint md:pt-1">Where it lives</div>
            <div className="max-w-2xl text-[16px] leading-[1.65] text-ink-dim">
              <p>
                Data is stored in the United States with Supabase. The app runs on Vercel. Payments go through Stripe, so SYNNR never sees a card number.
                Written answers and reading a dispatch use Anthropic&apos;s AI, once they&apos;re turned on for your account. Email goes out through Resend.
              </p>
              <p className="mt-4">
                The full detail is in the <Link href="/legal/privacy" className="text-ink underline underline-offset-4">Privacy Policy</Link> and the{" "}
                <Link href="/legal/terms" className="text-ink underline underline-offset-4">Terms</Link>. If something here isn&apos;t clear, call or text and ask.
              </p>
              <Link href="/#access" className="mt-8 inline-flex h-12 items-center rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white">Request access</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
