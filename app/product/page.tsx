import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav, SiteFooter } from "../_site/chrome";
import { SHARE_IMAGE } from "../_site/share";
import { AfterShot, BoardShot, DispatchShot, JobShot, ListShot, ReadShot } from "../_site/shots";
import { AskShot, BrainShot, JobPasteShot } from "../_site/brain-shots";

export const metadata: Metadata = {
  title: "How SYNNR works",
  openGraph: { title: "How SYNNR works", description: "Your shop's documents in, and answers that come only from them, with the passage shown.", images: SHARE_IMAGE },
  description: "How SYNNR works: put your shop's procedures, MSAs, price sheets and notes in, ask a question or paste a job, and get what your own documents say, with the passage it came from.",
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

/** The product, one step at a time: first the brain, then what it does on a job for a shop that wants that too. */
export default function Product() {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <SiteNav />
      <main>
        <section className="synnr-grid">
          <div className={`${wrap} pb-16 pt-14 md:pb-24 md:pt-24`}>
            <p className="text-[13px] text-ink-dim">How it works</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(38px,6.4vw,72px)] font-semibold leading-[1] tracking-[-0.045em] text-ink">
              Your documents in. Your answers out.
            </h1>
            <p className="mt-7 max-w-2xl text-[17px] leading-[1.55] text-ink-dim md:text-[20px]">
              SYNNR holds what your shop knows and answers from it, for anyone on the crew, from a phone. Three steps.
            </p>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-faint">
              The screens here are a sample shop, and every document in them is made up. Yours show your own.
            </p>
          </div>
        </section>

        <Step n={1} title="Put in what your shop runs on." visual={<BrainShot />}>
          <p>Procedures, customers&apos; MSAs, price sheets, job reports: load them as PDF, Word, or plain text. SYNNR reads each one and keeps it by section and page.</p>
          <p>Then the things nobody ever wrote down. Type them in the way you&apos;d tell a new hand, and they count the same as a document.</p>
          <p>Mark a price sheet or a customer&apos;s terms managers only, and a hand&apos;s question never touches it. We do the first load with you.</p>
          <p className="text-[14px] text-ink-faint">A scan, which is pictures of pages with no words in them, can&apos;t be read yet. Neither can a spreadsheet: save it as a PDF first.</p>
        </Step>

        <Step n={2} title="Anyone on the crew asks." flip visual={<AskShot />}>
          <p>A hand asks the way he&apos;d ask the office. SYNNR finds the passages in your documents that answer it and shows them word for word, with the document and section each one is from.</p>
          <p>One tap opens the document at that passage. If your documents have nothing on it, it says so. It never fills a gap with what&apos;s typical somewhere else.</p>
          <p className="text-[14px] text-ink-faint">Being turned on now: the answer written out in plain words from those passages, with each part tied to the passage it came from. Until then it finds passages by the words in your question, so ask in the words your documents use.</p>
        </Step>

        <Step n={3} title="Or paste the job." visual={<JobPasteShot />}>
          <p>Paste a job the way dispatch sent it. SYNNR pulls what your shop&apos;s own documents say about that job: the job list for that kind of work, the procedure, what that customer&apos;s terms require, and the notes that mention it.</p>
          <p>Everything that was asked, and what came back, is kept. A hand sees his own questions; a manager sees what the whole crew is asking.</p>
        </Step>

        <section id="jobs" className="scroll-mt-14 border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24`}>
            <h2 className="synnr-reveal text-[28px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink md:text-[38px]">It can run the job too.</h2>
            <div className="synnr-reveal max-w-2xl text-[16px] leading-[1.6] text-ink-dim md:text-[18px]">
              <p>
                For a shop that wants it, SYNNR goes from knowing what a job takes to making sure it went out: a list to load by, a photo of every piece that stops the job, and a photo of the gear put away after. Nobody has to use it. Here is how a job runs when you do.
              </p>
              <p className="mt-4 text-[14px] text-ink-faint">The job below is a sample from a wireline shop.</p>
            </div>
          </div>
        </section>

        <Step n={1} title="It starts with what your shop takes." visual={<ListShot />}>
          <p>For each kind of job you run, SYNNR holds your list: what goes on the truck, and which pieces stop the job if they&apos;re forgotten.</p>
          <p>They&apos;re your lists in your words, not ours. We sit down with you and load them, and a manager can change them any time.</p>
        </Step>

        <Step n={2} title="A job comes in." flip visual={<div className="grid gap-4 sm:grid-cols-2"><DispatchShot /><ReadShot /></div>}>
          <p>Type the kind of job and the truck, and put in what the dispatch says about the job. SYNNR pulls your shop&apos;s list for that kind of job.</p>
          <p>If the dispatch says to bring something, add it to the job as critical and it goes to the top of the list.</p>
          <p className="text-[14px] text-ink-faint">Being turned on now: send a photo or a screenshot of the dispatch instead of typing, and SYNNR reads it for you. It leaves names and phone numbers out, and the photo isn&apos;t kept.</p>
        </Step>

        <Step n={3} title="The crew loads by the list." visual={<JobShot />}>
          <p>Every piece is one big row. Tap it when it&apos;s on the truck. What stops the job is at the top.</p>
          <p>A critical piece only goes on with a photo of it. Tap it and the camera opens, so the photo is the tap.</p>
          <p>It works on a phone, with one hand, and it shows who put each piece on and when.</p>
        </Step>

        <Step n={4} title="Ready, or not." flip visual={<JobShot ready />}>
          <p>The truck reads NOT READY, and says exactly what&apos;s missing, until every piece is tapped and someone calls it ready.</p>
          <p>Nobody can call it ready early. If a piece comes back off, or one gets added, it goes back to NOT READY.</p>
          <p>The photos stay with the job. One link sends the list and the photos to the customer, with no login.</p>
        </Step>

        <Step n={5} title="The manager sees every truck." wide visual={<BoardShot />}>
          <p>One screen: every job, how much is loaded, and how many critical pieces are still off. No walking the yard, no calling around at 5 AM.</p>
        </Step>

        <Step n={6} title="After the job, the crew proves it was put away right." visual={<AfterShot />}>
          <p>A job list also says what gets proven when the job is done: the equipment washed, made safe to travel, back where it belongs, whatever your shop keeps having to check.</p>
          <p>Each one takes a photo, with who took it and when. The manager sees it on the same board, and a truck still missing a photo the next morning is in his email.</p>
          <p>Nobody drives back up to the yard to look.</p>
        </Step>

        <section className="border-t border-line">
          <div className={`${wrap} grid gap-8 py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-16 md:py-24`}>
            <div className="text-[14px] text-ink-faint md:pt-2">What&apos;s next</div>
            <div className="synnr-reveal max-w-2xl">
              <p className="text-[22px] leading-[1.35] tracking-[-0.015em] text-ink md:text-[28px]">
                The answer, written out. Today SYNNR shows you the passages. Next it writes the answer from them in plain words, with each part tied to the passage it came from, and it can read a scan. After that it looks at every proof photo and flags the ones that don&apos;t look right, so your manager sees those first.
              </p>
              <p className="mt-6 text-[15px] text-ink-dim">The written answer is built and being turned on. The rest comes after it.</p>
              <Link href="/#access" className="mt-8 inline-flex h-12 items-center rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white">Request access</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
