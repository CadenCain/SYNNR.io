import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, Smartphone, Truck } from "lucide-react";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";
import DemoLeadForm from "./lead-form";

/**
 * Public demo landing. One tap seeds a private copy of the Caprock demo yard
 * and signs the visitor into the real app (see /demo/start), where it opens
 * on the quick check: the board of trucks, Check it, the truck's list. This
 * page says what to try there. Lead capture posts to /api/demo-lead: name,
 * company, cell. No card, no account.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RollReady live demo",
  description: "Check a truck in RollReady with a demo yard. Tap what's on it and tap Ready, in under a minute. Your own private copy, no signup, no card.",
};

const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-ink">{children}</b>;

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3 text-base leading-relaxed text-ink-dim">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-2 text-sm font-semibold text-ink">{n}</span>
    <span>{children}</span>
  </li>
);

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ busy?: string; err?: string }> }) {
  const { busy, err } = await searchParams;
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
        <Link href="/" className="inline-block text-sm font-semibold text-ink hover:text-bone">RollReady <span className="font-normal text-ink-faint">by SYNNR</span></Link>

        <div className="mt-8 flex flex-col gap-5">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Try RollReady with a demo yard</h1>
          <p className="text-base leading-relaxed text-ink-dim">
            Tap the button and you get your own copy of a made-up Odessa coil tubing yard, with every truck&apos;s list
            already set. It opens on the board: every truck, and whether it&apos;s ready. Here&apos;s what to try:
          </p>
          <ol className="flex flex-col gap-3">
            <Step n={1}>
              Tap <B>Check it</B> on CT&#8209;04. Tap <B>On truck</B> on each line, then tap <B>Ready</B>. You&apos;ll see READY
              and the proof link the operator gets. The photo is optional in the demo.
            </Step>
            <Step n={2}>Now check another truck and skip a line. It reads NOT READY and says exactly what&apos;s missing.</Step>
            <Step n={3}>
              Open <B>Tools out</B>{" "}to see the setting tools by count: how many are ready, out with someone, and used and
              waiting on the vendor&apos;s pickup.
            </Step>
          </ol>
          <p className="text-base leading-relaxed text-ink-dim">
            Nobody else sees your copy, and it deletes itself after 24 hours.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action="/demo/start" method="post">
              <button type="submit" className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-bone px-6 text-base font-semibold text-coal hover:bg-bone-soft sm:w-auto">
                <Truck className="h-5 w-5" /> Open the demo yard
              </button>
            </form>
            <Link href="/signup" className="flex min-h-13 items-center justify-center gap-2 rounded-lg border-2 border-bone px-5 text-base font-semibold text-bone hover:bg-bone/10">
              Get started with your yard
            </Link>
          </div>
          <p className="text-sm text-ink-faint">
            The demo needs no signup and no card. Getting started sets up your real account: your company, your yards, $500 a yard a month.
            {" "}Questions? Call or text <a href={OWNER_PHONE_TEL} className="underline underline-offset-2">{OWNER_PHONE}</a>.
          </p>
          {busy ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              A lot of people are opening demo yards right now. Give it a few minutes and tap again.
            </p>
          ) : err ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              The demo yard didn&apos;t load. Try once more. If it keeps happening, call or text me at {OWNER_PHONE}.
            </p>
          ) : null}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><ShieldCheck className="h-5 w-5 text-emerald-400" /></span>
            <h2 className="text-lg font-semibold">A record nobody can edit</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              Every check saves who cleared the truck, what they said was on it, the photo, and the time. The operator
              gets a link that shows the same. When something&apos;s missing, there&apos;s no digging through group chats.
            </p>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><Smartphone className="h-5 w-5 text-ink-dim" /></span>
            <h2 className="text-lg font-semibold">Made for a phone</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              Big buttons for a gloved hand, plain words, and your taps stay on the phone if you lose signal.
              Open the demo on your phone and check a truck. It takes under a minute.
            </p>
          </div>
        </div>

        <div id="your-yard" className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold">Want this set up with your trucks?</h2>
          <p className="max-w-md text-sm leading-relaxed text-ink-dim">
            Set up your truck lists yourself for free, or I&apos;ll set them up with you: $1,000 a yard, one time, and free for the first 10 yards I set up.
            Tell me what each truck has to leave with, and we&apos;ll make its short list together.
            After that it&apos;s $500 a yard per month. No contract, and never per-seat.
          </p>
          <DemoLeadForm />
          <Link href="/signup" className="flex min-h-12 items-center justify-center rounded-lg bg-bone px-6 text-base font-semibold text-white hover:bg-bone-soft">Get started with your yard</Link>
          <p className="text-sm text-ink-dim">Pick your yards, pay by card, and you&apos;re in. About 3 minutes.</p>
          <Link href="/" className="mt-2 text-sm text-ink-dim underline underline-offset-2 hover:text-ink">Back to synnr.io</Link>
        </div>
      </main>
    </div>
  );
}
