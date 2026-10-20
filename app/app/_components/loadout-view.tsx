import Link from "next/link";
import { ScanLine, ClipboardCheck, ChevronRight, Warehouse, Boxes, History } from "lucide-react";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LoadOutTruckRow, LoadOutCounts, LoadOutWeek, TruckStatus } from "@/lib/saas/loadout-board";
import { cn } from "@/lib/utils";

/**
 * The Load out screen, presentation only. The real home page feeds it live
 * trucks; the marketing screenshot feeds it the demo yard, so the picture on
 * the site is this exact screen. A manager sees every truck as Blocked,
 * Ready, or Loaded out, per yard, and who did what today.
 */

const CHIP: Record<TruckStatus, { cls: string; label: string; edge: string }> = {
  blocked: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Blocked", edge: "border-l-red-500" },
  ready: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready to load", edge: "border-l-emerald-500" },
  out: { cls: "border-bone/30 bg-bone/10 text-bone", label: "Loaded out", edge: "border-l-bone" },
};

export interface ActivityLine { id: string; time: string; actor: string | null; message: string; tone: "red" | "amber" | "green" | null }

export default function LoadOutView({ trucks, counts, summary, week, yards = [], yardId = null, activity = [] }: {
  trucks: LoadOutTruckRow[];
  counts: LoadOutCounts;
  summary: string;
  week?: LoadOutWeek;
  yards?: { id: string; name: string }[];
  yardId?: string | null;
  activity?: ActivityLine[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">Load out</h1>
          <p className="mt-0.5 text-sm text-ink-dim">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/packages" className={buttonClass("outline", "sm")}><Boxes className="h-4 w-4" /> Packages &amp; kits</Link>
          <Link href="/app/loadouts" className={buttonClass("outline", "sm")}><History className="h-4 w-4" /> All load-outs</Link>
          <Link href="/app/yards" className={buttonClass("outline", "sm")}><Warehouse className="h-4 w-4" /> Yards &amp; trucks</Link>
        </div>
      </div>

      {yards.length > 1 ? (
        <nav aria-label="Yard" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ id: null as string | null, name: "All yards" }, ...yards].map((y) => (
            <Link key={y.id ?? "all"} href={y.id ? `/app?yard=${y.id}` : "/app"}
              className={cn("flex h-11 shrink-0 items-center rounded-lg border px-4 text-sm font-medium",
                yardId === y.id ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink hover:bg-elevated")}>
              {y.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {trucks.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { n: counts.blocked, label: "Blocked", tone: counts.blocked ? "text-red-400" : "text-ink" },
            { n: counts.ready, label: "Ready to load", tone: "text-emerald-400" },
            { n: counts.out, label: "Loaded out today", tone: "text-bone" },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-line bg-surface px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-4">
              <div className="text-[12px] font-medium leading-tight text-ink-dim sm:text-[13px]">{x.label}</div>
              <div className={cn("mt-1 text-3xl font-semibold tabular-nums", x.tone)}>{x.n}</div>
            </div>
          ))}
        </div>
      ) : null}

      {trucks.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <ScanLine className="h-8 w-8 text-ink-faint" />
          <div className="text-lg font-semibold">No trucks yet</div>
          <p className="max-w-md text-sm text-ink-dim">Add your trucks and trailers to a yard, put your iron on them, and every load-out gets checked as it goes on.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/app/welcome" className={buttonClass("default")}>Getting set up</Link>
            <Link href="/app/yards" className={buttonClass("outline")}>Add a truck</Link>
            <Link href="/app/import" className={buttonClass("outline")}>Import a spreadsheet</Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {trucks.map(({ t, pieces, status, why, whyTone, loadoutLine, doneToday, loadoutId, overridden }) => (
            <Card key={t.id} className={cn("flex flex-col gap-3 border-l-4 p-4", CHIP[status].edge)}>
              <Link href={`/app/units/${t.id}`} className="group flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-lg font-semibold group-hover:text-bone">{t.name}</span>
                    <span className={cn("whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold",
                      overridden ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : CHIP[status].cls)}>
                      {overridden ? "Out on override" : CHIP[status].label}
                    </span>
                  </div>
                  <div className="text-[13px] text-ink-faint">
                    {unitTypeLabel(t.type)} · {pieces} {pieces === 1 ? "piece" : "pieces"} of iron{yards.length > 1 && !yardId ? ` · ${t.yardName}` : ""}
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-faint" />
              </Link>
              {why ? <div className={cn("break-words text-sm", whyTone === "red" ? "font-medium text-red-400" : "text-amber-400")}>{why}</div> : null}
              {loadoutId ? (
                <Link href={`/app/loadouts/${loadoutId}`} className={cn("text-[13px] underline-offset-2 hover:underline", status === "blocked" ? "text-red-400" : overridden ? "text-amber-400" : "text-bone")}>
                  {loadoutLine} · See the record
                </Link>
              ) : (
                <div className="text-[13px] text-ink-faint">{loadoutLine ?? "No load-out scanned yet"}</div>
              )}
              <div className="flex gap-2">
                <Link href={`/app/units/${t.id}/scan`} className={buttonClass(status === "out" ? "outline" : "default", "lg", "h-14 min-w-0 flex-1 text-base")}>
                  <ScanLine className="h-5 w-5" /> {doneToday ? "Scan again" : "Start load-out"}
                </Link>
                <Link href={`/app/units/${t.id}/dispatch`} className={buttonClass("outline", "lg", "h-14 shrink-0 px-4")} aria-label={`Check ${t.name}'s paper for a job date`}>
                  <ClipboardCheck className="h-5 w-5" /> <span className="hidden sm:inline">Check</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {week && trucks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Last 7 days</h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { n: week.loadouts, label: "Load-outs scanned", tone: "text-ink" },
              { n: week.caught, label: "Bad pieces caught", tone: week.caught ? "text-red-400" : "text-ink" },
              { n: week.overrides, label: "Rolled on override", tone: week.overrides ? "text-amber-400" : "text-ink" },
            ].map((x) => (
              <div key={x.label} className="rounded-2xl border border-line bg-surface px-3 py-3 sm:px-4">
                <div className="text-[12px] font-medium leading-tight text-ink-dim sm:text-[13px]">{x.label}</div>
                <div className={cn("mt-1 text-2xl font-semibold tabular-nums", x.tone)}>{x.n}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {trucks.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Who did what today</h2>
          {activity.length === 0 ? (
            <Card className="p-4 text-sm text-ink-faint">Nothing yet today. Load-outs, moves, cert uploads, and overrides show up here with a name and a time.</Card>
          ) : (
            <Card className="divide-y divide-line">
              {activity.map((a) => (
                <div key={a.id} className="flex gap-3 px-4 py-3 text-sm">
                  <span className="w-16 shrink-0 tabular-nums text-ink-faint">{a.time}</span>
                  <div className="min-w-0">
                    {a.actor ? <span className="font-semibold text-ink">{a.actor}: </span> : null}
                    <span className={cn("break-words", a.tone === "red" ? "text-red-400" : a.tone === "amber" ? "text-amber-400" : a.tone === "green" ? "text-emerald-400" : "text-ink-dim")}>{a.message}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      ) : null}
    </div>
  );
}
