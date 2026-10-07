"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { List, ScanLine } from "lucide-react";
import type { EquipRow, EquipState } from "@/lib/saas/equipment";
import { STATE_ORDER, stateLabel } from "@/lib/saas/equipment";
import type { UnitTile } from "@/lib/saas/readiness";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The whole yard at a glance: every truck and every rack, with each piece of
 * iron as a colored tile. A tag tells you about one piece when you tap it;
 * this is the view of all of it at once, including which truck each piece
 * rides on, which the testing company never knows.
 */

const TILE: Record<EquipState, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/[0.07]",
  due: "border-amber-500/50 bg-amber-500/10",
  overdue: "border-red-500/50 bg-red-500/10",
  down: "border-red-500/60 bg-red-500/15",
  no_paper: "border-line-2 bg-elevated",
  retired: "border-line bg-elevated",
};
const DOT: Record<EquipState, string> = {
  ok: "bg-emerald-500", due: "bg-amber-500", overdue: "bg-red-500", down: "bg-red-500", no_paper: "bg-ink-faint", retired: "bg-ink-faint",
};
const TRUCK_CHIP: Record<UnitTile["state"], { cls: string; label: string }> = {
  not_ready: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Not ready" },
  due_soon: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "Due soon" },
  ready: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready" },
  not_setup: { cls: "border-line-2 bg-elevated text-ink-faint", label: "Not set up" },
};
const TRUCK_ORDER: Record<UnitTile["state"], number> = { not_ready: 0, due_soon: 1, not_setup: 2, ready: 3 };
const isProblem = (r: EquipRow) => r.state !== "ok";

export interface YardMapProps {
  rows: EquipRow[];
  trucks: UnitTile[];
  yards: { id: string; name: string }[];
  /** Last load-out scan per truck: unit id → when it finished. */
  lastLoadout?: Record<string, string>;
  /** "Oct 7, 5:10 AM" style, done on the server so it's in the yard's time zone. */
  fmt?: Record<string, string>;
}

export default function YardMap({ rows, trucks, yards, lastLoadout = {}, fmt = {} }: YardMapProps) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [yard, setYard] = useState(yards[0]?.id ?? "");

  const live = useMemo(() => rows.filter((r) => r.state !== "retired"), [rows]);
  const inYard = (r: EquipRow) => !yard || r.yardOf === yard;
  const sortTiles = (a: EquipRow, b: EquipRow) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name);

  const truckBlocks = trucks
    .filter((t) => !yard || t.yardId === yard)
    .map((t) => ({ t, iron: live.filter((r) => r.unitId === t.id).sort(sortTiles) }))
    .sort((a, b) => TRUCK_ORDER[a.t.state] - TRUCK_ORDER[b.t.state] || a.t.name.localeCompare(b.t.name));

  // Iron sitting in the yard, grouped by the spot noted on its last move.
  // Missing iron isn't in any spot, so it gets its own block.
  const yardIron = live.filter((r) => !r.unitId && inYard(r));
  const missing = yardIron.filter((r) => r.status === "missing").sort(sortTiles);
  const spots = new Map<string, EquipRow[]>();
  for (const r of yardIron) {
    if (r.status === "missing") continue;
    const key = r.note ?? "";
    spots.set(key, [...(spots.get(key) ?? []), r]);
  }
  const spotBlocks = [...spots.entries()]
    .map(([note, iron]) => ({ note, iron: iron.sort(sortTiles) }))
    .sort((a, b) => (a.note === "" ? 1 : b.note === "" ? -1 : a.note.localeCompare(b.note)));

  const scoped = live.filter(inYard);
  const red = scoped.filter((r) => r.state === "overdue" || r.state === "down").length;
  const due = scoped.filter((r) => r.state === "due").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">Yard map</h1>
          <p className="mt-0.5 text-sm text-ink-dim">
            Where each piece was last logged, and what was proven on each truck at its last load-out scan. {scoped.length} pieces{red ? `, ${red} red` : ""}{due ? `, ${due} due soon` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {yards.length > 1 && (
            <select value={yard} onChange={(e) => setYard(e.target.value)} aria-label="Yard"
              className="h-9 rounded-lg border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-bone">
              {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              <option value="">All yards</option>
            </select>
          )}
          <button type="button" onClick={() => setOnlyProblems((v) => !v)} aria-pressed={onlyProblems}
            className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              onlyProblems ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink-dim hover:text-ink")}>
            Only show problems
          </button>
          <Link href="/app" className={buttonClass("outline", "sm")}><List className="h-4 w-4" /> List view</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-dim">
        {(["ok", "due", "overdue", "down", "no_paper"] as EquipState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", DOT[s])} />
            {s === "ok" ? "Current" : s === "due" ? "Due in 30 days" : s === "overdue" ? "Overdue" : s === "down" ? "Red-tagged or missing" : "No paper yet"}
          </span>
        ))}
      </div>

      {truckBlocks.length === 0 && yardIron.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-12 text-center text-sm text-ink-dim">
          Nothing here yet. <Link href="/app" className="text-bone hover:underline">Add equipment</Link> and put it on a truck or in the yard.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {truckBlocks.map(({ t, iron }) => (
            <Block key={t.id}
              title={<Link href={`/app/units/${t.id}`} className="hover:text-bone">{t.name}</Link>}
              chip={<span className={cn("whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold", TRUCK_CHIP[t.state].cls)}>{TRUCK_CHIP[t.state].label}</span>}
              sub={`${unitTypeLabel(t.type)} · ${iron.length} ${iron.length === 1 ? "piece" : "pieces"} · ${lastLoadout[t.id] ? `load-out scanned ${fmt[t.id] ?? ""}` : "no load-out scan yet"}`}
              action={<Link href={`/app/units/${t.id}/scan`} className="inline-flex items-center gap-1 text-[13px] font-medium text-bone hover:underline"><ScanLine className="h-3.5 w-3.5" /> Scan load-out</Link>}
              why={t.state === "not_ready" || t.state === "due_soon" ? t.why : null}
              whyTone={t.state === "not_ready" ? "text-red-400" : "text-amber-400"}
              iron={iron} onlyProblems={onlyProblems} empty="No iron on this truck." />
          ))}
          {missing.length > 0 && (
            <Block key="missing" title="Missing" chip={null}
              sub={`${missing.length} ${missing.length === 1 ? "piece" : "pieces"} flagged missing, last seen in the yard`}
              why={missing.map((r) => r.note).filter(Boolean).join(" · ") || null} whyTone="text-red-400"
              iron={missing} onlyProblems={onlyProblems} empty="" />
          )}
          {spotBlocks.map(({ note, iron }) => (
            <Block key={`yard-${note}`}
              title={note ? `In the yard: ${note}` : "In the yard"}
              chip={null}
              sub={`${iron.length} ${iron.length === 1 ? "piece" : "pieces"}${note ? "" : " with no spot noted"}`}
              why={null} whyTone=""
              iron={iron} onlyProblems={onlyProblems} empty="" />
          ))}
        </div>
      )}
    </div>
  );
}

function Block({ title, chip, sub, why, whyTone, iron, onlyProblems, empty, action }: {
  title: React.ReactNode; chip: React.ReactNode; sub: string; why: string | null; whyTone: string;
  iron: EquipRow[]; onlyProblems: boolean; empty: string; action?: React.ReactNode;
}) {
  const shown = onlyProblems ? iron.filter(isProblem) : iron;
  const hidden = iron.length - shown.length;
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="break-words font-semibold">{title}</h2>
          {chip}
        </div>
        <div className="text-[13px] text-ink-faint">{sub}</div>
        {why ? <div className={cn("break-words text-[13px]", whyTone)}>{why}</div> : null}
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
      {iron.length === 0 ? (
        empty ? <p className="text-sm text-ink-faint">{empty}</p> : null
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((r) => <Tile key={r.id} r={r} />)}
          {hidden > 0 ? (
            <div className="flex items-center rounded-lg border border-dashed border-emerald-500/40 px-2.5 py-2 text-[12px] text-emerald-400">
              {shown.length === 0 ? `All ${hidden} current` : `+${hidden} current`}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function Tile({ r }: { r: EquipRow }) {
  return (
    <Link href={`/app/assets/${r.id}`} title={r.next ? `${r.next.title}: ${r.next.detail}` : "Nothing tracked yet"}
      className={cn("flex min-w-0 flex-col gap-0.5 rounded-lg border px-2.5 py-2 transition-colors hover:border-bone", TILE[r.state])}>
      <span className="line-clamp-2 break-words text-[13px] font-semibold leading-snug text-ink">{r.name}</span>
      <span className="flex min-w-0 items-center gap-1 text-[12px] text-ink-dim">
        <span className="truncate">{r.identifier ?? "No serial"}</span>
        {r.scannedAt ? <span title="Scanned onto this truck at the last load-out"><ScanLine className="h-3 w-3 shrink-0 text-emerald-400" aria-label="Scanned at load-out" /></span> : null}
      </span>
      <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-dim">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[r.state])} />
        {r.state === "due" && r.next?.exp ? `Due ${shortDate(r.next.exp)}` : stateLabel(r)}
      </span>
    </Link>
  );
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${MON[m - 1]} ${d}`;
}
