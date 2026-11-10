import { Check, Paperclip, Download } from "lucide-react";

/**
 * The product, drawn as it works: a job goes in, what to take comes out with
 * the critical items first, and the stage sheet is built. A sample job, laid
 * out left to right (top to bottom on a phone). It's a picture for sighted
 * visitors; the caption under it says the same thing in words.
 */

type Item = { label: string; qty?: string; critical?: boolean; on?: boolean };

const TAKE: Item[] = [
  { label: "Baker 20 setting tool", critical: true, on: true },
  { label: "Frac plugs", qty: "3", critical: true, on: true },
  { label: "Gun strings", qty: "3", critical: true, on: true },
  { label: "Power charges", qty: "3", critical: true },
  { label: "Detonators and switches", critical: true, on: true },
  { label: "CCL", on: true },
  { label: "Sinker bars", qty: "4", on: true },
  { label: "Crossover subs" },
  { label: "Pump-in sub" },
];

const READ: [string, string][] = [
  ["Job", "Plug and perf"],
  ["Casing", "5-1/2 in."],
  ["Stages", "3"],
  ["Truck", "WL-07"],
];

const STAGES: [string, string, string, string, string][] = [
  ["1", "18,950", "18,760", "18,900", "4"],
  ["2", "18,740", "18,560", "18,700", "4"],
  ["3", "18,540", "18,360", "18,500", "4"],
];

const on = TAKE.filter((t) => t.on).length;

function Step({ n, title, children, className = "" }: { n: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2.5 text-[13px]">
        <span className="font-mono tabular-nums text-bone">{n}</span>
        <span className="font-medium text-ink">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Console() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-line-2 bg-[#0b0c0e]">
      {/* Which job this is */}
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 text-[13px]">
          <span className="h-2 w-2 shrink-0 rounded-[1px] bg-bone" />
          <span className="whitespace-nowrap font-medium text-ink">WL-07</span>
          <span className="truncate text-ink-faint">Plug and perf, 3 stages</span>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full border border-line-2 px-3 py-1 text-[12px] text-ink-dim">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Loading out
        </span>
      </div>

      <div className="grid divide-y divide-line lg:grid-cols-[0.85fr_1.2fr_1.25fr] lg:divide-x lg:divide-y-0">
        <Step n="1" title="The job">
          <p className="synnr-rise mt-5 rounded-xl rounded-tl-sm bg-elevated px-4 py-3 text-[15px] leading-relaxed text-ink" style={{ ["--i" as string]: 0 }}>
            Plug and perf tomorrow. <span className="whitespace-nowrap">5-1/2</span> casing, 3 stages. Taking <span className="whitespace-nowrap">WL-07</span>.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-faint"><Paperclip className="h-3.5 w-3.5" /> Or a photo of the dispatch</p>
          <dl className="mt-6 border-t border-line">
            {READ.map(([k, v], i) => (
              <div key={k} className="synnr-rise flex items-baseline justify-between gap-4 border-b border-line py-2.5 text-[14px]" style={{ ["--i" as string]: i + 2 }}>
                <dt className="text-ink-faint">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Step>

        <Step n="2" title="What to take">
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-[44px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{on}<span className="text-ink-faint"> / {TAKE.length}</span></span>
            <span className="text-[13px] text-ink-dim">on the truck</span>
          </div>
          <ul className="mt-5 border-t border-line">
            {TAKE.map((t, i) => (
              <li key={t.label} className="synnr-rise flex items-center gap-3 border-b border-line py-2.5 text-[14px]" style={{ ["--i" as string]: i + 4 }}>
                <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${t.on ? "border-emerald-400 bg-emerald-400 text-coal" : t.critical ? "border-bone" : "border-line-2"}`}>
                  {t.on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className={`min-w-0 flex-1 truncate ${t.on ? "text-ink-dim" : "text-ink"}`}>
                  {t.label}{t.qty ? <span className="text-ink-faint"> × {t.qty}</span> : null}
                </span>
                {t.critical ? <span className={`shrink-0 text-[12px] ${t.on ? "text-ink-faint" : "text-bone"}`}>Critical</span> : null}
              </li>
            ))}
          </ul>
        </Step>

        <Step n="3" title="Stage sheet">
          <div className="mt-5 flex items-baseline gap-5 sm:gap-8">
            {[["3", "stages"], ["3", "plugs"], ["12", "clusters"]].map(([n, l]) => (
              <span key={l} className="flex items-baseline gap-2">
                <span className="text-[36px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[44px]">{n}</span>
                <span className="text-[13px] text-ink-dim">{l}</span>
              </span>
            ))}
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[13px] tabular-nums">
              <thead>
                <tr className="bg-surface text-ink-faint">
                  {["Stage", "Plug", "Top shot", "Bottom shot", "Clusters"].map((h, i) => (
                    <th key={h} className={`whitespace-nowrap px-2.5 py-2.5 text-[12px] font-normal ${i === 4 ? "hidden sm:table-cell lg:hidden xl:table-cell" : ""} ${i > 0 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAGES.map((r, i) => (
                  <tr key={r[0]} className="synnr-rise border-t border-line text-ink" style={{ ["--i" as string]: i + 13 }}>
                    {r.map((c, j) => (
                      <td key={j} className={`px-2.5 py-2.5 ${j === 4 ? "hidden sm:table-cell lg:hidden xl:table-cell" : ""} ${j > 0 ? "text-right font-mono text-[12.5px]" : "text-ink-dim"}`}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="synnr-rise mt-4 flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-3" style={{ ["--i" as string]: 16 }}>
            <span className="min-w-0 truncate text-[13px] text-ink">WL-07 stage sheet.xlsx</span>
            <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-ink-dim"><Download className="h-3.5 w-3.5" /> Excel</span>
          </div>
          <p className="mt-auto pt-5 text-[12px] leading-relaxed text-ink-faint">Depths in feet. Built from the job, ready to check against the program.</p>
        </Step>
      </div>
    </div>
  );
}
