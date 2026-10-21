import Link from "next/link";
import { ScanLine, ClipboardCheck, ChevronRight, Warehouse, Boxes, History, PackageCheck } from "lucide-react";
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
  out: { cls: "border-bone/30 bg-bone/10 text-bone", label: "Out on job", edge: "border-l-bone" },
};

export interface ActivityLine { id: string; time: string; actor: string | null; message: string; tone: "red" | "amber" | "green" | null }
export interface PersonWeek { name: string; loadouts: number; returns: number; overrides: number; other: number }
export interface IronCounts { out: number; outTooLong: number; outOfTest: number; dueSoon: number; down: number }

export default function LoadOutView({ trucks: allTrucks, counts, summary, week, yards = [], yardId = null, activity = [], iron, byPerson = [], myTruckId = null, alertDays = 7 }: {
  trucks: LoadOutTruckRow[];
  counts: LoadOutCounts;
  summary: string;
  week?: LoadOutWeek;
  yards?: { id: string; name: string }[];
  yardId?: string | null;
  activity?: ActivityLine[];
  iron?: IronCounts;
  byPerson?: PersonWeek[];
  /** A hand's own truck (the one they last loaded out) goes first. */
  myTruckId?: string | null;
  alertDays?: number;
}) {
  const mine = myTruckId ? allTrucks.find((x) => x.t.id === myTruckId) ?? null : null;
  const trucks = mine ? [mine, ...allTrucks.filter((x) => x !== mine)] : allTrucks;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">Load out</h1>
          <p className="mt-0.5 text-sm text-ink-dim">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/return" className={buttonClass("outline", "sm")}><PackageCheck className="h-4 w-4" /> Check iron in</Link>
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
            { n: counts.blocked, label: "Trucks blocked", tone: counts.blocked ? "text-red-400" : "text-ink", sub: null },
            { n: counts.ready, label: "Ready to load", tone: "text-emerald-400", sub: null },
            { n: counts.out, label: "Out on jobs", tone: "text-bone", sub: counts.outTooLong ? `${counts.outTooLong} out too long` : null },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl border border-line bg-surface px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-4">
              <div className="text-[12px] font-medium leading-tight text-ink-dim sm:text-[13px]">{x.label}</div>
              <div className={cn("mt-1 text-3xl font-semibold tabular-nums", x.tone)}>{x.n}</div>
              {x.sub ? <div className="text-xs font-semibold text-red-400">{x.sub}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {iron && trucks.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            { n: iron.out, label: "Pieces out on jobs", sub: iron.outTooLong ? `${iron.outTooLong} out ${alertDays}+ days` : "all within the limit", href: "/app/equipment?place=out", bad: iron.outTooLong > 0 },
            { n: iron.outOfTest, label: "Out of test", sub: "can't go out", href: "/app/equipment?f=overdue", bad: iron.outOfTest > 0 },
            { n: iron.dueSoon, label: "Test due soon", sub: "book the recert", href: "/app/compliance", bad: false },
            { n: iron.down, label: "Red-tagged or missing", sub: "pulled from service", href: "/app/equipment?f=down", bad: iron.down > 0 },
          ].map((x) => (
            <Link key={x.label} href={x.href} className="rounded-2xl border border-line bg-surface px-3 py-3 hover:border-bone/50 sm:px-4">
              <div className="text-[12px] font-medium leading-tight text-ink-dim sm:text-[13px]">{x.label}</div>
              <div className={cn("mt-1 text-2xl font-semibold tabular-nums", x.bad ? "text-red-400" : "text-ink")}>{x.n}</div>
              <div className={cn("text-xs", x.bad && x.label === "Pieces out on jobs" ? "font-semibold text-red-400" : "text-ink-faint")}>{x.sub}</div>
            </Link>
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
          {trucks.map(({ t, pieces, status, why, whyTone, loadoutLine, doneToday, loadoutId, overridden, outTooLong }) => (
            <Card key={t.id} className={cn("flex flex-col gap-3 border-l-4 p-4", outTooLong ? "border-l-red-500" : CHIP[status].edge)}>
              {mine && t.id === mine.t.id ? <div className="-mb-1 text-xs font-semibold text-bone">Your truck</div> : null}
              <Link href={`/app/units/${t.id}`} className="group flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-lg font-semibold group-hover:text-bone">{t.name}</span>
                    <span className={cn("whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold",
                      outTooLong ? "border-red-500/40 bg-red-500/10 text-red-400" : overridden ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : CHIP[status].cls)}>
                      {outTooLong ? "Out too long" : overridden ? "Out on override" : CHIP[status].label}
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
                {status === "out" ? (
                  <Link href={`/app/units/${t.id}/return`} className={buttonClass("default", "lg", "h-14 min-w-0 flex-1 text-base")}>
                    <PackageCheck className="h-5 w-5" /> Check in
                  </Link>
                ) : (
                  <Link href={`/app/units/${t.id}/scan`} className={buttonClass("default", "lg", "h-14 min-w-0 flex-1 text-base")}>
                    <ScanLine className="h-5 w-5" /> {doneToday ? "Scan again" : "Start load-out"}
                  </Link>
                )}
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

      {byPerson.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Last 7 days, by person</h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-[13px] text-ink-dim">
                <tr><th className="px-4 py-2 font-medium">Person</th><th className="px-3 py-2 text-right font-medium">Load-outs</th><th className="px-3 py-2 text-right font-medium">Check-ins</th><th className="px-3 py-2 text-right font-medium">Overrides</th><th className="px-4 py-2 text-right font-medium">Other</th></tr>
              </thead>
              <tbody>
                {byPerson.map((p) => (
                  <tr key={p.name} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.loadouts}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.returns}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", p.overrides ? "font-semibold text-amber-400" : "")}>{p.overrides}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-dim">{p.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
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
