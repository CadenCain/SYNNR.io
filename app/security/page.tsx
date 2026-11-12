import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "../_site/chrome";

const title = "Your data · SYNNR";
export const metadata: Metadata = {
  title,
  openGraph: { title, description: "What SYNNR does with your company's data, in plain words." },
  description: "What SYNNR does with your company's data, in plain words: who can see it, where the photos are kept, what gets read from a dispatch, and how to get it back.",
  alternates: { canonical: "/security" },
};

const FACTS: { title: string; body: string }[] = [
  {
    title: "Your company is walled off",
    body: "Every job, list, and name belongs to one company, and the database itself refuses to show it to anyone outside that company. It's a rule in the database, not a setting in the app.",
  },
  {
    title: "Your data is never used for another company",
    body: "Your job lists and jobs are only ever used to build your checklists. Nothing you load shows up in another company's lists or answers.",
  },
  {
    title: "Proof photos stay private",
    body: "The photos your crew takes of critical pieces, and of gear put away after a job, are kept with that job in private storage. Only people logged in to your company can open them, unless your crew sends a customer the link below. They aren't used for anything else.",
  },
  {
    title: "A customer link shows one job, and you can turn it off",
    body: "If your crew makes a link to send a customer, anyone holding that link can see that one job's list and the photos of what went on the truck, with first names only. What your crew proves after the job isn't on it, and nothing else in your company is behind it. A manager can turn the link off, and it stops working right then.",
  },
  {
    title: "A dispatch photo is read, then thrown away",
    body: "Reading a photo of the dispatch is being turned on now; until it is, your crew types the job. When you send one, it goes to our AI provider (Anthropic) to be read, and SYNNR keeps only the job facts: the kind of job, the truck, the customer and the well, the start time, the sizes, the pressure control, and the remarks. The photo itself isn't stored.",
  },
  {
    title: "Names and phone numbers stay out",
    body: "A dispatch has people on it. SYNNR is told to leave names, phone numbers, and emails out of what it reads. Remarks are kept as written, so a name somebody put in the remarks stays in them.",
  },
  {
    title: "Everybody has their own login",
    body: "No shared passwords. Hands load trucks. Managers change the job lists and who's on the crew. Every piece that goes on a truck carries the name of who tapped it and when.",
  },
  {
    title: "It's yours, and you can have it back",
    body: "Ask for a copy of what your company loaded, or for all of it to be deleted, and we do it. Email cadencain@synnr.io.",
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
              Your job lists and your way of doing things are worth something. Here is exactly what SYNNR does with them, in plain words.
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
                Reading a dispatch uses Anthropic&apos;s AI. Email goes out through Resend.
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
