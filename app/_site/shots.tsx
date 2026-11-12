import { Camera, Check } from "lucide-react";

/**
 * Pictures of the product for the public site, drawn from the same pieces
 * the app uses so they stay honest: a dispatch, what SYNNR read from it, a
 * shop's job list, the job checklist, the manager's board, and what the
 * crew proves after the job. Every value in them is a sample. They're decoration for sighted visitors; the copy
 * beside each one says the same thing in words.
 */

const panel = "overflow-hidden rounded-2xl border border-line-2 bg-[#0b0c0e]";
const tag = "shrink-0 text-[12px]";

type Row = { label: string; qty?: string; critical?: boolean; on?: boolean; why?: string };

// The shop's own list for the job, word for word. The job's checklist is
// these same lines, plus the one piece the crew added because of the remarks.
const LIST: Row[] = [
  { label: "Free point tool", critical: true },
  { label: "Cutters, right size", critical: true },
  { label: "Gauge cutter, right size", critical: true },
  { label: "Jars" },
  { label: "Weight bars" },
  { label: "CCL, 1-11/16 or 1-3/8" },
];
const OFF = new Set(["CCL, 1-11/16 or 1-3/8"]);
const JOB: Row[] = [
  { label: "Small jet cutters", qty: "2", critical: true },
  ...LIST.map((r) => ({ ...r, on: !OFF.has(r.label) })),
];

function Dot({ on, critical }: { on?: boolean; critical?: boolean }) {
  return (
    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${on ? "border-emerald-400 bg-emerald-400 text-coal" : critical ? "border-bone" : "border-line-2"}`}>
      {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
    </span>
  );
}

/** A plain dispatch, the kind a crew already gets, with the line that matters marked. */
export function DispatchShot() {
  const rows: [string, string][] = [["Job type", "Pipe recovery, FP and cut"], ["Truck", "WL-07"], ["Start", "7:00 AM"], ["Tubing", "2-3/8"], ["Pressure control", "Lubricator"]];
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-line-2 bg-[#e9eaec] text-[#17191c]">
      <div className="border-b border-black/10 px-5 py-3 text-[12px] text-black/50">Your dispatch</div>
      <dl className="px-5 py-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-black/[0.07] py-2 text-[14px]">
            <dt className="text-black/50">{k}</dt><dd className="font-medium">{v}</dd>
          </div>
        ))}
        <div className="py-3 text-[14px]">
          <dt className="text-black/50">Remarks</dt>
          <dd className="mt-1 font-medium leading-snug"><span className="bg-[#ff5a1f]/25 px-0.5">Tight spot in the tubing. Bring the small jet cutters.</span></dd>
        </div>
      </dl>
    </div>
  );
}

/** What goes into SYNNR for that dispatch: the three things a hand fills in. */
export function ReadShot() {
  const rows: [string, string][] = [["Kind of job", "Pipe recovery"], ["Truck", "WL-07"]];
  return (
    <div aria-hidden className={panel}>
      <div className="border-b border-line px-5 py-3 text-[12px] text-ink-faint">What goes into SYNNR</div>
      <dl className="px-5 py-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[14px]">
            <dt className="text-ink-faint">{k}</dt><dd className="text-ink">{v}</dd>
          </div>
        ))}
        <div className="border-b border-line py-3">
          <dt className="text-[14px] text-ink-faint">Remarks from the dispatch</dt>
          <dd className="mt-1.5 border-l-2 border-bone pl-3 text-[14px] leading-snug text-ink">Tight spot in the tubing. Bring the small jet cutters.</dd>
        </div>
        <div className="py-3">
          <dt className="text-[14px] text-ink-faint">Added to the job</dt>
          <dd className="mt-2 flex items-start justify-between gap-3">
            <span className="block text-[15px] text-ink">Small jet cutters<span className="text-ink-faint"> × 2</span></span>
            <span className={`${tag} text-bone`}>Critical</span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** A shop's own list for one kind of job. */
export function ListShot() {
  const rows = LIST;
  return (
    <div aria-hidden className={panel}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
        <span className="text-[15px] font-medium text-ink">Pipe recovery</span>
        <span className="text-[12px] text-ink-faint">Your shop&apos;s list</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-[14px] last:border-b-0">
            <span className="text-ink">{r.label}{r.qty ? <span className="text-ink-faint"> × {r.qty}</span> : null}</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[12px] ${r.critical ? "border-bone text-bone" : "border-line-2 text-ink-faint"}`}>{r.critical ? "Critical" : "Mark critical"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The job screen: where the truck stands, and the list to load by. */
export function JobShot({ ready = false }: { ready?: boolean }) {
  const rows = ready ? JOB.map((r) => ({ ...r, on: true })) : JOB;
  const on = rows.filter((r) => r.on).length;
  const off = rows.filter((r) => !r.on);
  const offCritical = off.filter((r) => r.critical).length;
  const ordered = [...rows].sort((a, b) => Number(Boolean(b.critical)) - Number(Boolean(a.critical)));
  return (
    <div aria-hidden className={panel}>
      <div className="flex items-baseline gap-3 border-b border-line px-5 py-3.5">
        <span className="text-[15px] font-medium text-ink">WL-07</span><span className="text-[13px] text-ink-faint">Pipe recovery</span>
      </div>
      <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b px-5 py-5 ${ready ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-line"}`}>
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`h-2 w-2 rounded-full ${ready ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className={`text-[34px] font-light leading-none tracking-[-0.03em] ${ready ? "text-emerald-400" : "text-red-400"}`}>{ready ? "Ready" : "Not ready"}</span>
          </div>
          <p className="mt-2.5 text-[13px] text-ink-dim">{ready ? "Cleared at 5:10 AM. Everything on the list is on the truck, with a photo of each critical piece." : `${off.length} still off the truck, ${offCritical} of them critical.`}</p>
        </div>
        <span className="text-[34px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{on}<span className="text-ink-faint"> / {rows.length}</span></span>
      </div>
      <ul>
        {ordered.map((r) => (
          <li key={r.label} className="flex items-center gap-3.5 border-b border-line px-5 py-3 last:border-b-0">
            <Dot on={r.on} critical={r.critical} />
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] ${r.on ? "text-ink-dim" : "text-ink"}`}>{r.label}{r.qty ? <span className="text-ink-faint"> × {r.qty}</span> : null}</span>
              {r.why ? <span className="mt-0.5 block text-[12px] leading-snug text-ink-dim">Dispatch: {r.why}</span> : null}
            </span>
            {r.critical ? <span className={`${tag} ${r.on ? "text-ink-faint" : "text-bone"}`}>Critical</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The manager's board: every job, how much is on, what's still critical. */
export function BoardShot() {
  const jobs = [
    { truck: "WL-07", job: "Pipe recovery", on: 5, total: 7, note: "1 critical still off", tone: "text-bone", ready: false },
    { truck: "WL-03", job: "Set a packer", on: 3, total: 3, note: "Cleared 5:10 AM", tone: "text-emerald-400", ready: true },
    { truck: "WL-11", job: "Plug and cement", on: 2, total: 11, note: "2 critical still off", tone: "text-bone", ready: false },
  ];
  const stat = (n: number, label: string, tone = "text-ink") => (
    <div className="flex items-baseline gap-2.5 px-5 py-4">
      <span className={`text-[36px] font-light leading-none tracking-[-0.03em] tabular-nums ${tone}`}>{n}</span>
      <span className="text-[13px] leading-tight text-ink-dim">{label}</span>
    </div>
  );
  return (
    <div aria-hidden className={panel}>
      <div className="grid divide-y divide-line border-b border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {stat(2, "loading out")}{stat(1, "ready", "text-emerald-400")}{stat(3, "critical pieces still off", "text-bone")}
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {jobs.map((j) => (
          <div key={j.truck} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-[17px] font-medium tracking-[-0.01em] text-ink">{j.truck}</div><div className="text-[13px] text-ink-dim">{j.job}</div></div>
              <span className={`mt-1 h-2 w-2 rounded-full ${j.ready ? "bg-emerald-400" : "bg-red-400"}`} />
            </div>
            <div className="mt-4 text-[28px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{j.on}<span className="text-ink-faint"> / {j.total}</span></div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${j.ready ? "bg-emerald-400" : "bg-ink-dim"}`} style={{ width: `${Math.round((j.on / j.total) * 100)}%` }} /></div>
            <div className={`mt-2.5 text-[12px] ${j.tone}`}>{j.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** After the job: what the crew proves with a photo before anyone goes home. */
export function AfterShot() {
  const rows = [
    { label: "BOP rams closed for travel", note: "Photo, 6:42 PM", done: true },
    { label: "Pressure control package washed", note: "No photo yet", done: false },
  ];
  return (
    <div aria-hidden className={panel}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
        <span className="flex items-baseline gap-3"><span className="text-[15px] font-medium text-ink">WL-07</span><span className="text-[13px] text-ink-faint">Pipe recovery</span></span>
        <span className="flex items-center gap-2 text-[12px] text-ink-dim"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Ready, 5:10 AM</span>
      </div>
      <div className="border-b border-line px-5 py-4">
        <div className="text-[15px] font-medium text-ink">After the job</div>
        <p className="mt-1 text-[13px] text-bone">1 of 2 still to prove. A photo of each before anyone goes home.</p>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3.5 border-b border-line px-5 py-3.5 last:border-b-0">
            <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border ${r.done ? "border-emerald-400 bg-emerald-400 text-coal" : "border-bone text-bone"}`}>
              {r.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Camera className="h-3 w-3" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[14px] ${r.done ? "text-ink-dim" : "text-ink"}`}>{r.label}</span>
              <span className={`mt-0.5 block text-[12px] ${r.done ? "text-ink-faint" : "text-bone"}`}>{r.note}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
