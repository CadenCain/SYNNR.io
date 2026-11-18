import { ArrowUp, ChevronDown, Lock } from "lucide-react";

/**
 * Pictures of the brain for the public site: a question with what the
 * documents say, and the list of documents a shop has put in. They show the
 * product as it runs today, so the answer is the passages themselves, word
 * for word. Every document, customer and rate in them is made up. They're
 * decoration for sighted visitors; the copy beside each says the same thing
 * in words.
 */

const panel = "overflow-hidden rounded-2xl border border-line-2 bg-[#0b0c0e]";

const PASSAGES = [
  {
    n: 1, title: "MSA: Dry Creek Operating", where: "Customer terms · 7. Standby", open: true,
    body: "The first two hours of waiting on Company at location are not charged. After that, standby is billed at $185.00 per hour for each unit, in half-hour steps. Standby time must be written on the field ticket and signed by Company's representative.",
  },
  {
    n: 2, title: "Price sheet 2026", where: "Pricing · Standby", open: true,
    body: "Standby is $225.00 per hour for each unit after the first hour on location, unless the customer's agreement says otherwise.",
  },
  { n: 3, title: "Post-job report: pump-down, Dry Creek", where: "Job reports · What happened", open: false, body: "" },
];

/** A hand asks what standby costs, and gets the two places the shop wrote it down. */
export function AskShot() {
  return (
    <div aria-hidden className={`${panel} px-4 py-5 sm:px-7 sm:py-7`}>
      <div className="mx-auto max-w-2xl">
        <div className="ml-auto w-fit max-w-[85%] rounded-xl bg-elevated px-4 py-3 text-[15px] leading-6 text-ink">What do we charge for standby?</div>
        <div className="mt-5 flex gap-3">
          <span className="mt-2.5 h-2 w-2 shrink-0 rounded-[1px] bg-bone" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-7 text-ink-dim">Here&apos;s what the documents say, word for word.</p>
            <ul className="mt-3 overflow-hidden rounded-xl border border-line">
              {PASSAGES.map((p) => (
                <li key={p.n} className="border-b border-line bg-surface last:border-b-0">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-elevated px-1 font-mono text-[11px] text-ink-dim">{p.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] leading-snug text-ink">{p.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{p.where}</span>
                    </span>
                    <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-ink-faint ${p.open ? "rotate-180" : ""}`} />
                  </div>
                  {p.open ? (
                    <div className="px-4 pb-4 pl-12">
                      <p className="border-l-2 border-line-2 pl-3 text-[14px] leading-relaxed text-ink-dim">{p.body}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-xl border border-line-2 bg-surface py-2 pl-4 pr-2">
          <span className="text-[15px] text-ink-faint">Ask your shop&apos;s brain</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-elevated text-ink-faint"><ArrowUp className="h-4 w-4" /></span>
        </div>
      </div>
    </div>
  );
}

const SHELF: { kind: string; docs: { title: string; meta: string; locked?: boolean }[] }[] = [
  { kind: "How we do it", docs: [
    { title: "Pressure control: rig-up and test", meta: "4 pages" },
    { title: "After the job: wash and put-away", meta: "2 pages" },
  ] },
  { kind: "Customer terms", docs: [{ title: "MSA: Dry Creek Operating", meta: "18 pages", locked: true }] },
  { kind: "Pricing", docs: [{ title: "Price sheet 2026", meta: "3 pages", locked: true }] },
  { kind: "Notes", docs: [{ title: "Things nobody wrote down", meta: "typed in" }] },
];

/** What a shop has put in: its documents by kind, with the ones only managers see marked. */
export function BrainShot() {
  return (
    <div aria-hidden className={`${panel} px-5 py-5 sm:px-6`}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] font-medium text-ink">The Brain</span>
        <span className="text-[12px] text-ink-faint">5 to answer from</span>
      </div>
      {SHELF.map((g) => (
        <div key={g.kind} className="mt-4">
          <div className="text-[12px] text-ink-faint">{g.kind}</div>
          <ul className="mt-1.5 overflow-hidden rounded-xl border border-line">
            {g.docs.map((d) => (
              <li key={d.title} className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-[14px] text-ink">
                    <span className="truncate">{d.title}</span>
                    {d.locked ? <span className="flex shrink-0 items-center gap-1 rounded-full border border-line-2 px-2 py-0.5 text-[11px] text-ink-dim"><Lock className="h-3 w-3" /> Managers only</span> : null}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-faint">{d.meta}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
    <div aria-hidden className={`${panel} px-5 py-5 sm:px-6`}>
      <div className="ml-auto w-fit max-w-[92%] rounded-xl bg-elevated px-4 py-3">
        <div className="text-[12px] text-ink-faint">A job, from dispatch</div>
        <div className="mt-1 whitespace-pre-line text-[14px] leading-6 text-ink">{JOB_TEXT}</div>
      </div>
      <ul className="mt-4 overflow-hidden rounded-xl border border-line">
        {JOB_FOUND.map(([title, where], i) => (
          <li key={title} className="flex items-start gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0">
            <span className="mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-elevated px-1 font-mono text-[11px] text-ink-dim">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[14px] leading-snug text-ink">{title}</span>
              <span className="mt-0.5 block text-[12px] text-ink-faint">{where}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
