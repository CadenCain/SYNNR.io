"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { savePlan, clearPlan } from "./actions";

type Line = { label: string; qty: number };
const lineSummary = (ls: Line[]) => ls.map((l) => `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`).join(", ");
const count = (ls: Line[]) => ls.reduce((n, l) => n + l.qty, 0);

/** A manager picks what the truck's next job needs. The hand sees it at the truck and can't take anything off. */
export default function PlanForm({ truck, kit, packages, pieceNames, initial }: {
  truck: { id: string; name: string };
  kit: Line[];
  packages: { id: string; name: string; lines: Line[] }[];
  pieceNames: string[];
  initial: { packageIds: string[]; lines: Line[]; note: string } | null;
}) {
  const router = useRouter();
  const [packageIds, setPackageIds] = useState<string[]>(initial?.packageIds ?? []);
  const [lines, setLines] = useState<Line[]>(initial?.lines ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [label, setLabel] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const picked = packages.filter((x) => packageIds.includes(x.id));
  const total = count(kit) + picked.reduce((n, x) => n + count(x.lines), 0) + count(lines);

  function addLine() {
    const l = label.trim().slice(0, 80);
    if (!l) return;
    setLines((ls) => [...ls, { label: l, qty: Math.min(99, Math.max(1, Math.floor(Number(qty)) || 1)) }]);
    setLabel(""); setQty("1");
  }
  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setErr("");
    try {
      const res = await fn();
      if (!res.ok) { setErr(res.error ?? "Couldn't save. Try again."); setBusy(false); return; }
      router.push("/app");
      router.refresh();
    } catch {
      setErr("No signal. Try again when you have one.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-lg font-semibold">What does the job need?</h2>
        <div className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-line-2 bg-elevated px-4 py-2">
          <Check className="h-5 w-5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <div className="font-semibold">{truck.name} kit (always)</div>
            <div className="break-words text-[13px] text-ink-dim">{kit.length ? lineSummary(kit) : "No kit set yet."}</div>
          </div>
        </div>
        {packages.length === 0 ? <p className="text-sm text-ink-dim">No packages yet. Make them under Packages &amp; kits, one for each kind of job.</p> : null}
        {packages.map((x) => {
          const on = packageIds.includes(x.id);
          return (
            <button key={x.id} type="button" aria-pressed={on}
              onClick={() => setPackageIds((ids) => (on ? ids.filter((i) => i !== x.id) : [...ids, x.id]))}
              className={cn("flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-2 text-left", on ? "border-bone bg-bone/10" : "border-line-2 hover:bg-elevated")}>
              {on ? <Check className="h-5 w-5 shrink-0 text-bone" /> : <Plus className="h-5 w-5 shrink-0 text-ink-faint" />}
              <div className="min-w-0">
                <div className="font-semibold">{x.name}</div>
                <div className="break-words text-[13px] text-ink-dim">{lineSummary(x.lines) || "No lines yet"}</div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <h2 className="font-semibold">Anything extra for this job</h2>
          <p className="text-sm text-ink-dim">Pieces this job needs that aren&apos;t in a package, like a second plug valve.</p>
        </div>
        {lines.length ? (
          <div className="flex flex-wrap gap-2">
            {lines.map((l, i) => (
              <span key={`${l.label}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-line-2 py-1 pl-3 pr-1 text-sm">
                {l.label}{l.qty > 1 ? ` × ${l.qty}` : ""}
                <button type="button" aria-label={`Remove ${l.label}`} onClick={() => setLines((ls) => [...ls.slice(0, i), ...ls.slice(i + 1)])}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:bg-elevated"><X className="h-4 w-4" /></button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addLine(); }}
            list="rr-plan-names" placeholder="Kind of piece, like 2in 1502 plug valve" aria-label="Extra piece"
            className="h-12 w-full min-w-0 grow rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
          <datalist id="rr-plan-names">{pieceNames.map((n) => <option key={n} value={n} />)}</datalist>
          <div className="flex gap-2">
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" aria-label="How many"
              className="h-12 w-16 shrink-0 rounded-lg border border-line-2 bg-coal px-3 text-center text-base text-ink outline-none focus:border-bone" />
            <button type="button" onClick={addLine} className={buttonClass("outline", "lg", "grow")}><Plus className="h-5 w-5" /> Add</button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
        <label htmlFor="plan-note" className="font-semibold">Note for the hand <span className="font-normal text-ink-faint">(optional)</span></label>
        <input id="plan-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="Like: flowback, leaves at 5 AM"
          className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
      </section>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 flex flex-col gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <p className="text-sm"><span className="text-lg font-bold tabular-nums">{total}</span> {total === 1 ? "piece" : "pieces"} {truck.name} has to leave with</p>
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => run(() => savePlan({ unitId: truck.id, packageIds, lines, note }))}
            className={buttonClass("default", "lg", "h-14 grow text-base")}>{busy ? "Saving…" : "Save the plan"}</button>
          {initial ? (
            <button type="button" disabled={busy} onClick={() => run(() => clearPlan(truck.id))} className={buttonClass("outline", "lg", "h-14 text-base")}>Clear the plan</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
