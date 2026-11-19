import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteNav, SiteFooter } from "../_site/chrome";
import { AccessLink } from "../_site/access-link";
import { SHARE_IMAGE } from "../_site/share";
import { AnswerShot, BrainShot, JobPasteShot } from "../_site/brain-shots";
import { Section, Site, body, cta, fine, h1, h3, wrap } from "../_site/ui";

export const metadata: Metadata = {
  title: "How SYNNR works",
  openGraph: { title: "How SYNNR works", description: "Your shop’s documents in, and answers that come only from them, with the source shown.", images: SHARE_IMAGE },
  description: "How SYNNR works: feed it your shop’s SOPs, MSAs, pricing and notes, ask a question or paste a job, and get what your own documents say, with where it came from.",
  alternates: { canonical: "/product" },
};

function Step({ n, title, children, visual }: { n: number; title: string; children: ReactNode; visual: ReactNode }) {
  return (
    <Section>
      <div className="grid items-start gap-x-10 gap-y-10 md:grid-cols-12">
        <div className="synnr-reveal md:col-span-5">
          <div className="text-[14px] tabular-nums text-ink-faint">{n}</div>
          <h2 className={`${h3} mt-4`}>{title}</h2>
          <div className={`${body} mt-6 flex max-w-[460px] flex-col gap-4`}>{children}</div>
        </div>
        <div className="synnr-reveal md:col-span-7">{visual}</div>
      </div>
    </Section>
  );
}

/** The product, one step at a time, with the screen for each. */
export default function Product() {
  return (
    <Site>
      <SiteNav />
      <main>
        <section>
          <div className={`${wrap} pb-20 pt-16 md:pb-32 md:pt-28`}>
            <h1 className={`${h1} max-w-[1000px]`}>Your documents in. Your answers out.</h1>
            <p className="mt-8 max-w-[640px] text-[18px] leading-[1.45] text-ink-dim md:mt-12 md:text-[22px]">
              SYNNR holds what your shop knows and answers from it, for anyone on the crew, from a phone.
            </p>
            <p className={`${fine} mt-4 max-w-[640px]`}>
              The screens here are a sample shop, and every document in them is made up. Yours show your own.
            </p>
          </div>
        </section>

        <Step n={1} title="Feed it your shop." visual={<BrainShot />}>
          <p>SOPs, customers&rsquo; MSAs, pricing, job reports: load them as PDF, Word, or plain text. SYNNR keeps each one by section and page.</p>
          <p>Then the things nobody ever wrote down. Type them in the way you&rsquo;d tell a new hand, and they count the same as a document.</p>
          <p>Mark a price sheet or a customer&rsquo;s terms managers only, and a hand&rsquo;s question never touches it. We do the first load with you.</p>
          <p className={fine}>A scan, which is pictures of pages with no words in them, can&rsquo;t be read yet. Neither can a spreadsheet: save it as a PDF first.</p>
        </Step>

        <Step n={2} title="Ask it anything." visual={<JobPasteShot />}>
          <p>A hand asks the way he&rsquo;d ask the office, from a phone.</p>
          <p>Or paste a job the way dispatch sent it. SYNNR pulls what your own documents say about that job: the job list for that kind of work, the procedure, what that customer&rsquo;s terms require, and the notes that mention it.</p>
          <p>What was asked, and what came back, is kept. A hand sees his own questions; a manager sees what the whole crew is asking.</p>
        </Step>

        <Step n={3} title="Get the answer from your documents." visual={<AnswerShot stacked />}>
          <p>It shows the passage that answers it, word for word, with the document and the section it&rsquo;s from. One tap opens the document at that spot.</p>
          <p>If your documents have nothing on it, it says so. It never fills a gap with what&rsquo;s typical somewhere else.</p>
          <p className={fine}>Being turned on now: the answer written out in plain words, each part tied to the passage it came from. Until then it finds passages by the words in your question, so ask in the words your documents use.</p>
        </Step>

        <Section name="What’s next">
          <div className="synnr-reveal grid gap-x-10 md:grid-cols-12">
            <div className="md:col-span-9">
              <p className="text-[24px] leading-[1.25] tracking-[-0.025em] text-ink md:text-[38px] md:leading-[1.18] md:tracking-[-0.035em]">
                The answer, written out. Then reading a scan, so a signed MSA goes in the way it sits in your files.
              </p>
              <p className={`${body} mt-8 max-w-[640px]`}>
                The written answer is built and being turned on. Reading scans comes after it.
              </p>
              <p className={`${body} mt-4 max-w-[640px]`}>
                SYNNR can also run a job: a list to load by, a photo of each piece that stops the job, and a board
                where a manager sees every truck. Nobody has to use it. Ask about it when Caden calls.
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
