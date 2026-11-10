"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { jobState, orderLines, type JobLine } from "@/lib/saas/jobs";
import { setLine, addLine, removeLine, markReady, deleteJob } from "../actions";

const when = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";

/**
 * Loading the truck. Every piece is one big row: tap it when it's on. What
 * stops the job is at the top. The truck reads NOT READY, and says what's
 * missing, until every row is tapped and someone calls it ready.
 */
export default function JobCheck({ jobId, initial, initialReady, me, manager, writable }: {
  jobId: string; initial: JobLine[]; initialReady: { by: string | null; at: string | null } | null; me: string; manager: boolean; writable: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const [ready, setReady] = useState(initialReady);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const [busyReady, setBusyReady] = useState(false);

  const ordered = orderLines(lines);
  const s = jobState(lines);

  function tap(l: JobLine) {
    if (!writable) return;
    const on = !l.on_at;
    setErr("");
    // Show it right away; put it back if the save doesn't go through.
    setLines((ls) => ls.map((x) => x.id === l.id ? { ...x, on_at: on ? new Date().toISOString() : null, on_by: on ? me : null } : x));
    if (!on) setReady(null);
    start(async () => {
      const r = await setLine(l.id, on);
      if (!r.ok) {
        setLines((ls) => ls.map((x) => x.id === l.id ? { ...x, on_at: l.on_at, on_by: l.on_by } : x));
        setErr(r.error);
      } else {
        setLines((ls) => ls.map((x) => x.id === l.id ? { ...x, on_at: r.on_at, on_by: r.on_by } : x));
      }
    });
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const label = String(fd.get("label") ?? "").trim();
    if (!label) return;
    const qty = Number(fd.get("qty")) || 1;
    const critical = fd.get("critical") === "on";
    setErr("");
    start(async () => {
      const r = await addLine(jobId, { label, qty, critical });
      if (!r.ok) { setErr(r.error); return; }
      setLines((ls) => [...ls, { id: r.id, label, qty, critical, why: null, source: "added", sort: r.sort, on_at: null, on_by: null }]);
      setReady(null);
      form.reset();
      setAdding(false);
    });
  }

  function remove(l: JobLine) {
    setErr("");
    start(async () => {
      const r = await removeLine(l.id);
      if (!r.ok) { setErr(r.error); return; }
      setLines((ls) => ls.filter((x) => x.id !== l.id));
    });
  }

  async function callReady() {
    setBusyReady(true); setErr("");
    const r = await markReady(jobId);
    setBusyReady(false);
    if (!r.ok) { setErr(r.error); router.refresh(); return; }
    setReady({ by: r.ready_by, at: r.ready_at });
  }

  async function del() {
    if (!window.confirm("Delete this job? Its list and who loaded what go with it.")) return;
    const r = await deleteJob(jobId);
    if (!r.ok) { setErr(r.error); return; }
    router.replace("/app");
    router.refresh();
  }

  const isReady = Boolean(ready) && s.ready;

  return (
    <div className="flex flex-col gap-6">
      {/* Where the truck stands */}
      <div className={cn("rounded-2xl border px-5 py-5 sm:px-6", isReady ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-line-2 bg-[#0b0c0e]")}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", isReady ? "bg-emerald-400" : "bg-red-400")} />
              <span className={cn("text-[40px] font-light leading-none tracking-[-0.03em] sm:text-[52px]", isReady ? "text-emerald-400" : "text-red-400")}>{isReady ? "Ready" : "Not ready"}</span>
            </div>
            <p className="mt-3 text-[14px] text-ink-dim" role="status">
              {isReady
                ? `Cleared by ${ready?.by ?? "someone"}${ready?.at ? ` at ${when(ready.at)}` : ""}. Everything on the list is on the truck.`
                : s.total === 0
                  ? "This job has no list yet. Add what it takes."
                  : s.ready
                    ? "Everything is on. Call it ready."
                    : `${s.missing.length} still off the truck${s.criticalMissing ? `, ${s.criticalMissing} of them critical` : ""}.`}
            </p>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[40px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[52px]">{s.on}<span className="text-ink-faint"> / {s.total}</span></span>
            <span className="text-[13px] text-ink-dim">on the truck</span>
          </div>
        </div>
        {!isReady && s.ready && writable ? (
          <button type="button" onClick={callReady} disabled={busyReady}
            className="mt-5 h-14 w-full rounded-xl bg-emerald-400 text-[17px] font-semibold text-coal transition-colors hover:bg-emerald-300 disabled:opacity-60 sm:w-auto sm:px-10">
            {busyReady ? "Saving…" : "Call it ready"}
          </button>
        ) : null}
      </div>

      {err ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      {/* The list */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-ink">What to take</h2>
          {writable ? (
            <button type="button" onClick={() => setAdding((a) => !a)} className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
              <Plus className="h-4 w-4" /> Add a piece
            </button>
          ) : null}
        </div>

        {adding ? (
          <form onSubmit={add} className="mt-3 flex flex-col gap-3 rounded-xl border border-line-2 bg-surface p-4 sm:flex-row sm:items-center">
            <input name="label" required maxLength={120} autoFocus placeholder="What is it?" aria-label="What is it?"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint" />
            <input name="qty" type="number" min={1} max={999} defaultValue={1} aria-label="How many"
              className="h-11 w-20 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none focus:border-ink-faint" />
            <label className="flex h-11 items-center gap-2 text-[14px] text-ink-dim"><input name="critical" type="checkbox" className="h-5 w-5 accent-bone" /> Critical</label>
            <button type="submit" className="h-11 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white">Add</button>
          </form>
        ) : null}

        <ul className="mt-3 overflow-hidden rounded-xl border border-line">
          {ordered.length === 0 ? (
            <li className="bg-surface px-5 py-8 text-center text-[14px] text-ink-dim">Nothing on the list yet.</li>
          ) : ordered.map((l) => {
            const on = Boolean(l.on_at);
            return (
              <li key={l.id} className="flex items-stretch border-b border-line bg-surface last:border-b-0">
                <button type="button" onClick={() => tap(l)} disabled={!writable} aria-pressed={on}
                  className={cn("flex min-h-16 min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors sm:px-5", writable && "hover:bg-elevated active:bg-elevated")}>
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    on ? "border-emerald-400 bg-emerald-400 text-coal" : l.critical ? "border-bone" : "border-line-2")}>
                    {on ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[16px] leading-snug", on ? "text-ink-dim" : "text-ink")}>
                      {l.label}{l.qty > 1 ? <span className="text-ink-faint"> × {l.qty}</span> : null}
                    </span>
                    {l.why ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">Dispatch: {l.why}</span> : null}
                    {on ? <span className="mt-0.5 block text-[12px] text-ink-faint">{l.on_by ?? "Someone"}{l.on_at ? `, ${when(l.on_at)}` : ""}</span> : null}
                  </span>
                  {l.critical ? <span className={cn("shrink-0 text-[12px]", on ? "text-ink-faint" : "text-bone")}>Critical</span> : null}
                </button>
                {manager && writable ? (
                  <button type="button" onClick={() => remove(l)} aria-label={`Take ${l.label} off the list`} title="Take it off the list"
                    className="flex w-11 shrink-0 items-center justify-center border-l border-line text-ink-faint transition-colors hover:bg-elevated hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {manager && writable ? (
        <button type="button" onClick={del} className="self-start text-[13px] text-ink-faint underline-offset-4 transition-colors hover:text-red-400 hover:underline">Delete this job</button>
      ) : null}
    </div>
  );
}
