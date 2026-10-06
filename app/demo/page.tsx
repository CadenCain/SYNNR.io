import type { Metadata } from "next";
import Image from "next/image";
import { Phone, ShieldCheck, Smartphone, Truck } from "lucide-react";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";
import DemoLeadForm from "./lead-form";
import { SHOWCASE_PROOF_TOKEN } from "@/lib/saas/demo-seed";

/**
 * Public demo landing. One tap seeds a private copy of the Caprock demo yard
 * and signs the visitor into the real app (see /demo/start). The only preview
 * on this page is the showcase proof link, generated from the same seed, so
 * nothing here can drift from what the visitor is about to drive. Lead
 * capture posts to /api/demo-lead: name, company, cell. No card, no account.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "RollReady live demo",
  description: "Try RollReady with a demo yard. Your own private copy of a working coil tubing yard, no signup, no card.",
};

const DEMO_PROOF = `/proof/${SHOWCASE_PROOF_TOKEN}`;

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ busy?: string; err?: string }> }) {
  const { busy, err } = await searchParams;
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
        <a href="/" className="inline-block text-sm font-semibold text-ink hover:text-bone">RollReady <span className="font-normal text-ink-faint">by SYNNR</span></a>

        <div className="mt-8 flex flex-col gap-5">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Try RollReady with a demo yard</h1>
          <p className="text-base leading-relaxed text-ink-dim">
            Tap the button and you get your own copy of a made-up Odessa coil tubing company: 62 pieces of
            iron on 16 trucks and trailers, and a few problems already on the list. The BOP stack on CT‑03 is
            past its pressure test, a plug valve on CT‑06 got red-tagged after UT, and another one has been
            missing since a rig-down. A hand already sent a photo of a new BOP cert with a date that isn&apos;t on
            the paper, so it&apos;s waiting on you under Review uploads. Open a piece of iron, look at its QR tag
            and where it&apos;s been, and see what it takes to turn it green.
          </p>
          <p className="text-base leading-relaxed text-ink-dim">
            Nobody else sees your copy, and it deletes itself after 24 hours.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action="/demo/start" method="post">
              <button type="submit" className="flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-bone px-6 text-base font-semibold text-coal hover:bg-bone-soft sm:w-auto">
                <Truck className="h-5 w-5" /> Open the demo yard
              </button>
            </form>
            <a href={OWNER_PHONE_TEL} className="flex min-h-13 items-center justify-center gap-2 rounded-lg border border-line-2 px-5 text-base text-ink hover:bg-elevated">
              <Phone className="h-4 w-4" /> Call or text {OWNER_PHONE}
            </a>
          </div>
          <p className="text-sm text-ink-faint">No signup and no card.</p>
          {busy ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              A lot of people are opening demo yards right now. Give it a few minutes and tap again.
            </p>
          ) : err ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              The demo yard didn&apos;t load. Try once more. If it keeps happening, the proof link below still shows the yard.
            </p>
          ) : null}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><ShieldCheck className="h-5 w-5 text-emerald-400" /></span>
            <h2 className="text-lg font-semibold">See a proof link</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              This is the page a shop sends an operator instead of a binder. It comes from the same demo
              yard, so you&apos;ll see CT‑03&apos;s expired BOP test on it.
            </p>
            <a href={DEMO_PROOF} target="_blank" rel="noreferrer"
              className="mt-1 flex min-h-11 w-fit items-center rounded-lg bg-bone px-4 text-sm font-semibold text-coal hover:bg-bone-soft">
              Open the proof link
            </a>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-coal"><Smartphone className="h-5 w-5 text-ink-dim" /></span>
            <h2 className="text-lg font-semibold">Works on a phone</h2>
            <p className="text-sm leading-relaxed text-ink-dim">
              Every piece of iron on your phone, worst first. Tap one to see its paper, its QR tag, and
              where it&apos;s been. You can open the demo on your phone too.
            </p>
            <Image src="/screens/app-phone.webp" alt="RollReady on a phone: the equipment list with a red-tagged plug valve on top"
              width={750} height={1624} className="mx-auto mt-2 w-40 rounded-[22px] border-[5px] border-slate-900 shadow-lg" />
          </div>
        </div>

        <div id="your-yard" className="mt-12 flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold">Want this set up with your iron?</h2>
          <p className="max-w-md text-sm leading-relaxed text-ink-dim">
            Setup is free for the first 10 yards. Bring your binder or spreadsheets and we&apos;ll load your
            iron, serials, and test dates together in one afternoon. After that it&apos;s $500 a yard per month. No contract, and never
            per-seat.
          </p>
          <DemoLeadForm />
          <a href="/" className="mt-2 text-sm text-ink-dim underline underline-offset-2 hover:text-ink">Back to synnr.io</a>
        </div>
      </main>
    </div>
  );
}
