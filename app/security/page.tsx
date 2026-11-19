import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "../_site/chrome";
import { AccessLink } from "../_site/access-link";
import { SHARE_IMAGE } from "../_site/share";
import { Section, Site, body, cta, h1, wrap } from "../_site/ui";

const title = "Your data · SYNNR";
export const metadata: Metadata = {
  title,
  openGraph: { title, description: "What SYNNR does with your company’s data, in plain words.", images: SHARE_IMAGE },
  description: "What SYNNR does with your company’s documents, in plain words: who can see them, what goes to an AI and what doesn’t, and how to get them back.",
  alternates: { canonical: "/security" },
};

const FACTS: { title: string; body: string }[] = [
  {
    title: "Your company is walled off",
    body: "Every document, question, job, and name belongs to one company, and the database itself refuses to show it to anyone outside that company. It’s a rule in the database, not a setting in the app.",
  },
  {
    title: "Your documents are never used for another company",
    body: "What you put in is only ever used to answer your own crew. Nothing you load shows up in another company’s answers, and SYNNR doesn’t train a model on it.",
  },
  {
    title: "Managers only means managers only",
    body: "Mark a document managers only and the database leaves it out of a hand’s search. A hand’s question can’t be answered from it, and a hand can’t open it.",
  },
  {
    title: "What goes to an AI, and what doesn’t",
    body: "Today nothing you load goes to an AI: SYNNR finds the passages in your documents itself and shows them to you. When written answers are turned on for your account, the question and the few passages that match it go to our AI provider (Anthropic) to write the answer. Your whole library is never sent, and Anthropic’s terms for business customers say it may not train its models on what we send.",
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
    body: "If your crews run jobs in SYNNR, the photos they take are kept with that job in private storage. Only people logged in to your company can open them, unless your crew sends a customer that job’s link, which shows one job’s list and photos with first names only. A manager can turn a link off, and it stops working right then.",
  },
  {
    title: "A dispatch photo is read, then thrown away",
    body: "Reading a photo of the dispatch is being turned on now; until it is, your crew types the job. When you send one, it goes to Anthropic to be read, and SYNNR keeps only the job facts. It’s told to leave names, phone numbers, and emails out, and the photo itself isn’t stored.",
  },
  {
    title: "Everybody has their own login",
    body: "No shared passwords. Hands ask, and load trucks. Managers put documents in, take them out, and decide who’s on the crew.",
  },
  {
    title: "It’s yours, and you can have it back",
    body: "A manager can download everything SYNNR has read, in one file, and each file as it was loaded. Take a document out and nothing is answered from it again. Ask for all of it to be deleted, and we do it. Email cadencain@synnr.io.",
  },
];

/** What happens to a company's data, in the order people worry about it. */
export default function Security() {
  return (
    <Site>
      <SiteNav />
      <main>
        <section>
          <div className={`${wrap} pb-20 pt-16 md:pb-32 md:pt-28`}>
            <h1 className={`${h1} max-w-[1000px]`}>What your shop knows stays your shop&rsquo;s.</h1>
            <p className="mt-8 max-w-[640px] text-[18px] leading-[1.45] text-ink-dim md:mt-12 md:text-[22px]">
              Your procedures, your prices, and your way of doing things are worth something. Here is exactly what SYNNR does with them, in plain words.
            </p>
          </div>
        </section>

        <Section>
          <div className="grid md:grid-cols-2 md:gap-x-16 lg:gap-x-24">
            {FACTS.map((f, i) => (
              <div key={f.title} className={`synnr-reveal border-line py-8 md:py-10 ${i > 0 ? "border-t" : ""} ${i === 1 ? "md:border-t-0" : ""}`}>
                <h2 className="text-[22px] font-medium leading-[1.2] tracking-[-0.025em] text-ink">{f.title}</h2>
                <p className="mt-3 max-w-[480px] text-[16px] leading-[1.65] text-ink-dim">{f.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section name="Where it lives">
          <div className="grid gap-x-10 md:grid-cols-12">
            <div className={`${body} max-w-[680px] md:col-span-9`}>
              <p>
                Data is stored in the United States with Supabase. The app runs on Vercel. Payments go through Stripe, so SYNNR never sees a card number.
                Written answers and reading a dispatch use Anthropic&rsquo;s AI, once they&rsquo;re turned on for your account. Email goes out through Resend.
              </p>
              <p className="mt-4">
                The full detail is in the <Link href="/legal/privacy" className="text-ink underline decoration-line-2 underline-offset-[6px] hover:decoration-ink">Privacy Policy</Link> and the{" "}
                <Link href="/legal/terms" className="text-ink underline decoration-line-2 underline-offset-[6px] hover:decoration-ink">Terms</Link>. If something here isn&rsquo;t clear, call or text and ask.
              </p>
              <AccessLink className={`${cta} mt-10 w-full sm:w-auto`}>Request early access</AccessLink>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </Site>
  );
}
