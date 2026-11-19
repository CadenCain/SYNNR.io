/**
 * Pictures of the product for the public site: a question with what the
 * documents say, a question the documents can't answer, the documents a
 * shop has put in, and a pasted job. They show the product as it runs
 * today, so an answer is the passage itself, word for word, with where it
 * came from. Every document, customer and rate in them is made up, and each
 * frame says it's a sample shop. They're pictures for sighted visitors; the
 * copy beside each says the same thing in words.
 */

const frame = "overflow-hidden rounded-md border border-line-2 bg-surface";

function Strip() {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 text-[13px] md:px-8">
      <span className="truncate text-ink-dim">Caprock Coil &amp; Pressure Control</span>
      <span className="shrink-0 text-ink-faint">Sample shop</span>
    </div>
  );
}

const FOUND = [
  {
    n: 1, title: "MSA: Dry Creek Operating", where: "Customer terms · 7. Standby",
    body: "The first two hours of waiting on Company at location are not charged. After that, standby is billed at $185.00 per hour for each unit, in half-hour steps. Standby time must be written on the field ticket and signed by Company’s representative. Waiting caused by Contractor’s own equipment is not standby and is not billed.",
  },
  {
    n: 2, title: "Price sheet 2026", where: "Pricing · Standby",
    body: "Standby is $225.00 per hour for each unit after the first hour on location, unless the customer’s agreement says otherwise.",
  },
];

/**
 * The one picture the homepage leads with: what the MSA says about standby,
 * answered with the clause itself and where it's written. `stacked` is the
 * narrow version, for beside a column of text.
 */
export function AnswerShot({ stacked = false }: { stacked?: boolean }) {
  return (
    <div aria-hidden className={frame}>
      <Strip />
      <div className={stacked ? "" : "lg:grid lg:grid-cols-12"}>
        <div className={`border-b border-line px-5 py-7 md:px-8 md:py-9 ${stacked ? "" : "lg:col-span-4 lg:border-b-0 lg:border-r lg:py-12"}`}>
          <div className="text-[13px] text-ink-faint">Asked</div>
          <p className={`mt-3 font-medium leading-[1.12] tracking-[-0.03em] text-ink ${stacked ? "text-[22px]" : "text-[24px] lg:text-[32px]"}`}>
            What does our MSA say about standby time?
          </p>
        </div>
        <div className={`px-5 py-7 md:px-8 md:py-9 ${stacked ? "" : "lg:col-span-8 lg:px-12 lg:py-12"}`}>
          <div className="flex items-center gap-2.5 text-[13px] text-ink-dim">
            <span className="h-[7px] w-[7px] shrink-0 bg-signal" />
            From your documents, word for word
          </div>
          {FOUND.map((p, i) => (
            <div key={p.n} className={i === 0 ? "mt-6" : "mt-8 border-t border-line pt-8"}>
              <p className={`leading-[1.5] tracking-[-0.011em] ${i === 0 ? "text-ink" : "text-ink-dim"} ${stacked ? "text-[16px]" : "text-[17px] lg:text-[21px]"}`}>{p.body}</p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                <span className="tabular-nums text-ink-faint">{p.n}</span>
                <span className="text-ink">{p.title}</span>
                <span className="text-ink-faint">{p.where}</span>
              </div>
            </div>
          ))}
          {/* The real screen lists a couple more below these two; the picture says so rather than hiding them. */}
          <div className="mt-8 border-t border-line pt-5 text-[13px] text-ink-faint">2 more passages from the MSA</div>
        </div>
      </div>
    </div>
  );
}

/** A question the shop's documents say nothing about, and what SYNNR says back. */
export function NoAnswerShot() {
  return (
    <div aria-hidden className={frame}>
      <Strip />
      <div className="border-b border-line px-5 py-6 md:px-8">
        <div className="text-[13px] text-ink-faint">Asked</div>
        <p className="mt-2.5 text-[20px] font-medium leading-[1.2] tracking-[-0.025em] text-ink">What’s the torque on the injector chain?</p>
      </div>
      <div className="px-5 py-6 md:px-8">
        <p className="text-[17px] leading-[1.5] text-ink-dim">Nothing in your documents about that. I won&rsquo;t guess.</p>
      </div>
    </div>
  );
}

const SHELF: { kind: string; docs: { title: string; meta: string }[] }[] = [
  { kind: "How we do it", docs: [
    { title: "Pressure control: rig-up and test", meta: "4 pages" },
    { title: "After the job: wash and put-away", meta: "2 pages" },
  ] },
  { kind: "Customer terms", docs: [{ title: "MSA: Dry Creek Operating", meta: "18 pages · Managers only" }] },
  { kind: "Pricing", docs: [{ title: "Price sheet 2026", meta: "3 pages · Managers only" }] },
  { kind: "Notes", docs: [{ title: "Things nobody wrote down", meta: "Typed in" }] },
];

/** What a shop has put in: its documents by kind, with the ones only managers see marked. */
export function BrainShot() {
  return (
    <div aria-hidden className={frame}>
      <Strip />
      <div className="px-5 pb-3 pt-6 md:px-8 md:pt-8">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[19px] font-medium tracking-[-0.02em] text-ink">The Brain</span>
          <span className="text-[13px] text-ink-faint">5 documents to answer from</span>
        </div>
        {SHELF.map((g) => (
          <div key={g.kind} className="mt-6">
            <div className="text-[13px] text-ink-faint">{g.kind}</div>
            <ul className="mt-2 border-t border-line">
              {g.docs.map((d) => (
                <li key={d.title} className="flex flex-col gap-0.5 border-b border-line py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="min-w-0 text-[15px] text-ink">{d.title}</span>
                  <span className="shrink-0 text-[13px] text-ink-faint">{d.meta}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const JOB_TEXT = "Dry Creek Operating, pump-down\nUnit PD-5, on location 5:00 AM\n5-1/8 10K wellhead. Frac crew ahead of us.";
const JOB_FOUND: [string, string][] = [
  ["Job list: Pump-down package", "What goes on the truck"],
  ["Pressure control: rig-up and test", "How we do it · Before leaving the yard"],
  ["MSA: Dry Creek Operating", "Customer terms · 10. Pressure Testing"],
  ["Things nobody wrote down", "Notes"],
];

/** A job pasted in the way dispatch sent it, and the places the shop's documents speak to it. */
export function JobPasteShot() {
  return (
    <div aria-hidden className={frame}>
      <Strip />
      <div className="border-b border-line px-5 py-6 md:px-8">
        <div className="text-[13px] text-ink-faint">A job, pasted the way dispatch sent it</div>
        <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.6] text-ink">{JOB_TEXT}</p>
      </div>
      <div className="px-5 pb-3 pt-6 md:px-8">
        <div className="text-[13px] text-ink-dim">What your documents say about it</div>
        <ul className="mt-3 border-t border-line">
          {JOB_FOUND.map(([title, where], i) => (
            <li key={title} className="flex items-baseline gap-4 border-b border-line py-3">
              <span className="w-3 shrink-0 text-[13px] tabular-nums text-ink-faint">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-ink">{title}</span>
                <span className="mt-0.5 block text-[13px] text-ink-faint">{where}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
