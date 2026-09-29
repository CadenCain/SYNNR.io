"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Printer, Download, Plus, X, QrCode } from "lucide-react";
import type { EquipRow, EquipState, EquipmentList } from "@/lib/saas/equipment";
import { STATE_ORDER, stateLabel } from "@/lib/saas/equipment";
import { ASSET_CATEGORIES, categoryLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The home screen: every piece of iron in one list. Search and filters run
 * in the browser against rows the server already sent, so typing and
 * tapping a filter answer instantly, no round trip.
 *
 * Presentation only. The real page feeds it live rows; the marketing
 * screenshot feeds it a fixed sample, so the picture on the site is this
 * exact screen.
 */

export type Filter = "all" | "overdue" | "due" | "down" | "no_paper" | "retired";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "due", label: "Due soon" },
  { key: "down", label: "Red-tagged or missing" },
  { key: "no_paper", label: "No paper yet" },
  { key: "retired", label: "Retired" },
];

const CHIP: Record<EquipState, string> = {
  down: "border-red-500/40 bg-red-500/10 text-red-400",
  overdue: "border-red-500/40 bg-red-500/10 text-red-400",
  due: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  no_paper: "border-line-2 bg-elevated text-ink-dim",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  retired: "border-line-2 bg-elevated text-ink-faint",
};

const NEXT_TONE: Record<string, string> = {
  expired: "text-red-400",
  missing: "text-red-400",
  pending: "text-amber-400",
  due_soon: "text-amber-400",
  ok: "text-ink-dim",
};

export interface EquipmentViewProps {
  list: EquipmentList;
  companyName: string;
  initialFilter?: Filter;
  initialQuery?: string;
  /** Server action for the add form. Absent on the screenshot. */
  addAction?: (fd: FormData) => Promise<void>;
}

export default function EquipmentView({ list, companyName, initialFilter = "all", initialQuery = "", addAction }: EquipmentViewProps) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [q, setQ] = useState(initialQuery);
  const [yard, setYard] = useState("");
  const [type, setType] = useState("");
  const [adding, setAdding] = useState(false);

  const setFilterAndUrl = (f: Filter) => {
    setFilter(f);
    try {
      const u = new URL(window.location.href);
      if (f === "all") u.searchParams.delete("f"); else u.searchParams.set("f", f);
      window.history.replaceState(null, "", u);
    } catch { /* screenshot / no window */ }
  };

  const types = useMemo(() => [...new Set(list.rows.map((r) => r.category))].sort(), [list.rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.rows
      .filter((r) => (filter === "all" ? r.state !== "retired" : r.state === filter))
      .filter((r) => !yard || r.yardOf === yard)
      .filter((r) => !type || r.category === type)
      .filter((r) => !needle || [r.name, r.identifier ?? "", r.where, categoryLabel(r.category), r.next?.title ?? ""]
        .some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]
        || (a.next?.exp ?? "9999").localeCompare(b.next?.exp ?? "9999")
        || a.name.localeCompare(b.name));
  }, [list.rows, filter, yard, type, q]);

  const c = list.counts;
  const countFor = (f: Filter) =>
    f === "all" ? c.tracked : f === "overdue" ? c.overdue : f === "due" ? c.due : f === "down" ? c.down : f === "no_paper" ? c.noPaper : c.retired;
  const current = c.tracked - c.overdue - c.due - c.down - c.noPaper;

  const tiles: { f: Filter; label: string; short?: string; value: number; tone: string; sub: string }[] = [
    { f: "overdue", label: "Overdue", value: c.overdue, tone: c.overdue ? "text-red-400" : "text-ink", sub: "test or cert past due" },
    { f: "due", label: "Due in 30 days", value: c.due, tone: c.due ? "text-amber-400" : "text-ink", sub: "get these scheduled" },
    { f: "down", label: "Red-tagged or missing", short: "Red-tagged / missing", value: c.down, tone: c.down ? "text-red-400" : "text-ink", sub: "can't go out" },
    { f: "all", label: "Current", value: current, tone: "text-emerald-400", sub: `of ${c.tracked} pieces tracked` },
  ];

  const hasAny = list.rows.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">Equipment</h1>
          <p className="mt-0.5 break-words text-sm text-ink-dim">{companyName} · {c.tracked} {c.tracked === 1 ? "piece" : "pieces"} tracked</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasAny && (
            <>
              <Link href="/app/tags" className={buttonClass("outline", "sm")}><Printer className="h-4 w-4" /> Print QR tags</Link>
              <a href="/app/equipment/export" className={buttonClass("outline", "sm")}><Download className="h-4 w-4" /> Download list</a>
            </>
          )}
          {addAction && (
            <button type="button" onClick={() => setAdding((v) => !v)} className={buttonClass("default", "sm")}>
              {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {adding ? "Close" : "Add equipment"}
            </button>
          )}
        </div>
      </div>

      {adding && addAction && <AddForm action={addAction} list={list} />}

      {hasAny && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {tiles.map((t) => (
            <button key={t.label} type="button" onClick={() => setFilterAndUrl(t.f)}
              className={cn("rounded-2xl border bg-surface px-3.5 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors hover:border-line-2 sm:p-4",
                filter === t.f && t.f !== "all" ? "border-bone ring-1 ring-bone/30" : "border-line")}>
              <div className="text-[13px] font-medium leading-tight text-ink-dim">{t.short ?? t.label}</div>
              <div className={cn("mt-1 text-2xl font-semibold tabular-nums sm:text-3xl", t.tone)}>{t.value}</div>
              <div className="mt-0.5 hidden text-xs text-ink-faint sm:block">{t.sub}</div>
            </button>
          ))}
        </div>
      )}

      {hasAny ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search name, serial, truck, test"
                className="h-11 w-full rounded-lg border border-line-2 bg-surface pl-9 pr-3 text-ink outline-none focus:border-bone" />
            </label>
            <div className="flex gap-2">
              {list.yards.length > 1 && (
                <select value={yard} onChange={(e) => setYard(e.target.value)} aria-label="Yard"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-bone sm:flex-none">
                  <option value="">All yards</option>
                  {list.yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              )}
              {types.length > 1 && (
                <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-bone sm:flex-none">
                  <option value="">All types</option>
                  {types.map((t) => <option key={t} value={t}>{categoryLabel(t)}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
              {FILTERS.filter((f) => f.key === "all" || countFor(f.key) > 0 || filter === f.key).map((f) => (
                <button key={f.key} type="button" onClick={() => setFilterAndUrl(f.key)}
                  className={cn("inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    filter === f.key ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink-dim hover:text-ink")}>
                  {f.label}
                  <span className={cn("tabular-nums", filter === f.key ? "text-white/80" : "text-ink-faint")}>{countFor(f.key)}</span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <Card className="px-6 py-10 text-center text-sm text-ink-dim">
              Nothing matches. <button type="button" className="text-bone hover:underline" onClick={() => { setQ(""); setYard(""); setType(""); setFilterAndUrl("all"); }}>Clear the filters</button>
            </Card>
          ) : (
            <>
              {/* Phones: one card per piece */}
              <div className="flex flex-col gap-2 lg:hidden">
                {shown.map((r) => <PhoneRow key={r.id} r={r} />)}
              </div>
              {/* Laptop and up: the table */}
              <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.05)] lg:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {["Equipment", "Serial", "Where", "Next test", "Status"].map((h) => (
                        <th key={h} className="whitespace-nowrap border-b border-line bg-elevated/60 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-dim">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => <TableRow key={r.id} r={r} />)}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-faint">Showing {shown.length} of {filter === "retired" ? c.retired : c.tracked}.</p>
            </>
          )}
        </section>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <QrCode className="h-8 w-8 text-ink-faint" />
          <div className="text-lg font-semibold">No equipment yet</div>
          <p className="max-w-md text-sm text-ink-dim">Add your iron one piece at a time, or bring in the whole list from a spreadsheet. Each piece gets its test dates, its paper, and a QR tag.</p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {addAction && <button type="button" onClick={() => setAdding(true)} className={buttonClass("default")}><Plus className="h-4 w-4" /> Add equipment</button>}
            <Link href="/app/import" className={buttonClass("outline")}>Import a spreadsheet</Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function NextCell({ r }: { r: EquipRow }) {
  if (!r.next) return <span className="text-ink-faint">Nothing tracked yet</span>;
  return (
    <div className="min-w-0">
      <div className="break-words font-medium text-ink">{r.next.title}</div>
      <div className={cn("text-[13px]", NEXT_TONE[r.next.result])}>{r.next.detail}</div>
    </div>
  );
}

function Chip({ r }: { r: EquipRow }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold", CHIP[r.state])}>{stateLabel(r)}</span>;
}

function TableRow({ r }: { r: EquipRow }) {
  return (
    <tr className="relative transition-colors hover:bg-elevated/60 [&:last-child>td]:border-0">
      <td className="border-b border-line/60 px-4 py-3 align-top">
        <Link href={`/app/assets/${r.id}`} className="font-semibold text-ink after:absolute after:inset-0 hover:text-bone">{r.name}</Link>
        <div className="text-[13px] text-ink-faint">{categoryLabel(r.category)}</div>
      </td>
      <td className="whitespace-nowrap border-b border-line/60 px-4 py-3 align-top text-ink-dim">{r.identifier ?? "None"}</td>
      <td className="border-b border-line/60 px-4 py-3 align-top text-ink-dim">{r.where}</td>
      <td className="border-b border-line/60 px-4 py-3 align-top"><NextCell r={r} /></td>
      <td className="border-b border-line/60 px-4 py-3 align-top"><Chip r={r} /></td>
    </tr>
  );
}

function PhoneRow({ r }: { r: EquipRow }) {
  return (
    <Link href={`/app/assets/${r.id}`}>
      <Card className="flex flex-col gap-1.5 p-4 transition-colors active:bg-elevated">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 break-words font-semibold">{r.name}</div>
          <Chip r={r} />
        </div>
        <div className="break-words text-[13px] text-ink-dim">
          {r.identifier ? `${r.identifier} · ` : ""}{r.where}
        </div>
        {r.next ? (
          <div className={cn("break-words text-[13px]", NEXT_TONE[r.next.result])}>
            <span className="font-medium text-ink">{r.next.title}:</span> {r.next.detail}
          </div>
        ) : (
          <div className="text-[13px] text-ink-faint">Nothing tracked yet</div>
        )}
      </Card>
    </Link>
  );
}

const fld = "h-11 w-full rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-bone";

function AddForm({ action, list }: { action: (fd: FormData) => Promise<void>; list: EquipmentList }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-5">
      <form action={async (fd) => { setBusy(true); try { await action(fd); } finally { setBusy(false); } }} className="flex flex-col gap-3">
        <div className="text-sm font-semibold">Add a piece of equipment</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-faint">Name
            <input name="name" required placeholder="e.g. 2in 1502 plug valve" className={`${fld} mt-1`} />
          </label>
          <label className="text-xs text-ink-faint">Type
            <select name="category" defaultValue="flow_iron" className={`${fld} mt-1`}>
              {ASSET_CATEGORIES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-faint">Serial number
            <input name="identifier" placeholder="As stamped on the iron" className={`${fld} mt-1`} />
          </label>
          <label className="text-xs text-ink-faint">Where it is
            <select name="where" defaultValue={list.yards[0] ? `yard:${list.yards[0].id}` : ""} className={`${fld} mt-1`}>
              {list.yards.length === 0 && <option value="">No yards yet</option>}
              {list.yards.map((y) => (
                <optgroup key={y.id} label={y.name}>
                  <option value={`yard:${y.id}`}>{y.name} (in the yard)</option>
                  {list.units.filter((u) => u.yardId === y.id).map((u) => <option key={u.id} value={`unit:${u.id}`}>{u.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">Next you add its test or cert with a photo of the paper.</p>
          <button type="submit" disabled={busy} className={buttonClass("default")}>{busy ? "Adding…" : "Add it"}</button>
        </div>
      </form>
    </Card>
  );
}
