import Link from "next/link";
import { ScanLine, ClipboardCheck, ChevronRight, Warehouse, Boxes, History, PackageCheck, ListTodo, Wrench } from "lucide-react";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import UnsentDrafts from "./unsent-drafts";
import NeverSentDrafts from "./never-sent-drafts";
import TruckBackButton from "./truck-back-button";
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
export interface PersonWeek {
  name: string; loadouts: number; returns: number; overrides: number; other: number;
  /** Pieces they loaded this week, and how many of those were checked by hand instead of scanned off a tag. */
  pieces?: number; byHand?: number;
  /** On the crew, but nothing in RollReady this week. */
  idle?: boolean;
}
export interface IronCounts { out: number; outTooLong: number; outOfTest: number; dueSoon: number; down: number }

export default function LoadOutView({ trucks: allTrucks, counts, summary, week, yards = [], yardId = null, activity = [], iron, byPerson = [], myTruckId = null, alertDays = 7, plans = {}, manager = false, hand = false, picking = false, pickAction, tips, companyId = "", quick = false }: {
  trucks: LoadOutTruckRow[];
  /** The yard runs the quick check: trucks read by their last check, and the buttons say so. */
  quick?: boolean;
  /** This company: a yard check-in draft from another company on this phone isn't listed here. */
  companyId?: string;
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
  /** Each truck's planned next job, by truck id. */
  plans?: Record<string, { text: string; by: string | null; note: string | null; late?: string | null }>;
  /** Managers plan jobs. */
  manager?: boolean;
  /** A hand (not a manager): their truck first, the rest folded away, no manager numbers. */
  hand?: boolean;
  /** Picking a different truck (?pick=1). */
  picking?: boolean;
  /** Saves "this is my truck" on this phone. */
  pickAction?: (fd: FormData) => Promise<void>;
  /** First-time tips for a hand, shown under their truck. */
  tips?: React.ReactNode;
}) {
  const mine = myTruckId ? allTrucks.find((x) => x.t.id === myTruckId) ?? null : null;
  const trucks = mine ? [mine, ...allTrucks.filter((x) => x !== mine)] : allTrucks;
  const card = (row: LoadOutTruckRow, isMine = false) => (
    <TruckCard key={row.t.id} row={row} isMine={isMine} plan={plans[row.t.id]} manager={manager} hand={hand} quick={quick}
      showYard={yards.length > 1 && !yardId} />
  );

  if (hand) {
    const others = trucks.filter((x) => x !== mine);
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-[26px] font-semibold tracking-tight">Load out</h1>
        <UnsentDrafts trucks={allTrucks.map((x) => ({ id: x.t.id, name: x.t.name }))} companyId={companyId} />
        <NeverSentDrafts trucks={allTrucks.map((x) => ({ id: x.t.id, name: x.t.name }))} companyId={companyId} />
        {trucks.length === 0 ? (
          <Card className="p-5 text-sm text-ink-dim">No trucks set up yet. A manager adds them.</Card>
        ) : mine && !picking ? (
          <section className="flex flex-col gap-2">
            {card(mine, true)}
            <Link href="/app?pick=1" className="inline-flex min-h-12 items-center self-start px-1 text-sm text-ink-dim underline underline-offset-2">Not your truck today? Pick another</Link>
          </section>
        ) : (
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-lg font-semibold">Which truck are you on today?</h2>
            <form action={pickAction} className="flex flex-col gap-2">
              <select name="unit_id" defaultValue={mine?.t.id ?? ""} required aria-label="Your truck"
                className="h-14 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone">
                <option value="" disabled>Pick your truck</option>
                {trucks.map((x) => <option key={x.t.id} value={x.t.id}>{x.t.name}</option>)}
              </select>
              <button type="submit" className={buttonClass("default", "lg", "h-14 text-base")}>That&apos;s my truck</button>
            </form>
            <p className="text-sm text-ink-dim">Pick it once. This phone remembers it.</p>
          </Card>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href="/app/return" className={buttonClass("outline", "lg", "h-12 text-base")}><PackageCheck className="h-5 w-5" /> Check in tools or loose iron</Link>
          <Link href="/app/signout" className={buttonClass("outline", "lg", "h-12 text-base")}><Wrench className="h-5 w-5" /> Sign out a tool</Link>
        </div>
        {tips}
        {others.length > 0 ? (
          <details className="group rounded-2xl border border-line bg-surface">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-semibold">
              <span>{mine ? "Other trucks" : "All trucks"} ({others.length})</span>
              <ChevronRight className="h-5 w-5 text-ink-faint transition-transform group-open:rotate-90" />
            </summary>
            <div className="grid grid-cols-1 gap-3 p-3 pt-0">{others.map((x) => card(x))}</div>
          </details>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <UnsentDrafts trucks={allTrucks.map((x) => ({ id: x.t.id, name: x.t.name }))} companyId={companyId} />
      <NeverSentDrafts trucks={allTrucks.map((x) => ({ id: x.t.id, name: x.t.name }))} companyId={companyId} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">Load out</h1>
          <p className="mt-0.5 text-sm text-ink-dim">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/return" className={buttonClass("outline", "sm")}><PackageCheck className="h-4 w-4" /> Check in tools or loose iron</Link>
          <Link href="/app/signout" className={buttonClass("outline", "sm")}><Wrench className="h-4 w-4" /> Tools out</Link>
          <Link href="/app/packages" className={buttonClass("outline", "sm")}><Boxes className="h-4 w-4" /> Packages &amp; kits</Link>
          <Link href="/app/loadouts" className={buttonClass("outline", "sm")}><History className="h-4 w-4" /> Load-out records</Link>
          <Link href="/app/yards" className={buttonClass("outline", "sm")}><Warehouse className="h-4 w-4" /> Yards &amp; trucks</Link>
        </div>
      </div>

      {(() => {
        // Scanned and blocked is "still blocked", not "nobody scanned it out"
        // (the same split the morning email makes).
        const late = allTrucks.filter((x) => plans[x.t.id]?.late);
        const blocked = late.filter((x) => plans[x.t.id]!.late!.endsWith("Still NOT READY."));
        const unscanned = late.filter((x) => !blocked.includes(x));
        const groups = [
          { key: "blocked", rows: blocked, title: blocked.length === 1 ? "A planned truck is still blocked" : "Planned to leave, still blocked" },
          { key: "unscanned", rows: unscanned, title: unscanned.length === 1 ? "A truck hasn't been scanned out" : `${unscanned.length} trucks haven't been scanned out` },
        ].filter((g) => g.rows.length);
        return groups.length ? (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3">
            {groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-1">
                <div className="font-semibold text-red-400">{g.title}</div>
                {g.rows.map((x) => (
                  <Link key={x.t.id} href={`/app/units/${x.t.id}/scan`} className="break-words text-sm text-ink hover:underline">
                    <span className="font-semibold">{x.t.name}:</span> {plans[x.t.id]!.late}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ) : null;
      })()}

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
            { n: iron.outOfTest, label: "Out of test or no paper", sub: "can't go out", href: "/app/equipment?f=overdue", bad: iron.outOfTest > 0 },
            { n: iron.dueSoon, label: "Test due soon", sub: "book the recert", href: "/app/compliance", bad: false },
            { n: iron.down, label: "Pulled from service", sub: "red-tagged, missing, or needs redress", href: "/app/equipment?f=down", bad: iron.down > 0 },
          ].map((x) => (
            // A yard picked here stays picked on the list the tile opens.
            <Link key={x.label} href={yardId && x.href.startsWith("/app/equipment") ? `${x.href}&yard=${yardId}` : x.href} className="rounded-2xl border border-line bg-surface px-3 py-3 hover:border-bone/50 sm:px-4">
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
          {trucks.map((x) => card(x, Boolean(mine && x.t.id === mine.t.id)))}
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
          {/* Phones: one line per person, no sideways scrolling. */}
          <Card className="divide-y divide-line sm:hidden">
            {byPerson.map((p) => (
              <div key={p.name} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
                <span className="font-medium">{p.name}</span>
                {p.idle ? <span className="font-semibold text-red-400">Nothing in RollReady this week</span> : (
                  <span className="text-ink-dim">
                    {p.loadouts} {p.loadouts === 1 ? "load-out" : "load-outs"} · {p.returns} {p.returns === 1 ? "check-in" : "check-ins"}
                    {p.overrides ? <> · <span className="font-semibold text-amber-400">{p.overrides} {p.overrides === 1 ? "override" : "overrides"}</span></> : null}
                    {p.pieces ? <> · <span className={p.pieces && (p.byHand ?? 0) / p.pieces > 0.5 ? "font-semibold text-amber-400" : ""}>{p.byHand ?? 0} of {p.pieces} checked by hand</span></> : null}
                    {p.other ? <> · {p.other} other</> : null}
                  </span>
                )}
              </div>
            ))}
          </Card>
          <Card className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-[13px] text-ink-dim">
                <tr><th className="px-4 py-2 font-medium">Person</th><th className="px-3 py-2 text-right font-medium">Load-outs</th><th className="px-3 py-2 text-right font-medium">Check-ins</th><th className="px-3 py-2 text-right font-medium">Overrides</th><th className="px-3 py-2 text-right font-medium">Checked by hand</th><th className="px-4 py-2 text-right font-medium">Other</th></tr>
              </thead>
              <tbody>
                {byPerson.map((p) => p.idle ? (
                  <tr key={p.name} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td colSpan={5} className="px-3 py-2.5 text-right font-semibold text-red-400">Nothing in RollReady this week</td>
                  </tr>
                ) : (
                  <tr key={p.name} className="border-t border-line">
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.loadouts}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.returns}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", p.overrides ? "font-semibold text-amber-400" : "")}>{p.overrides}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", p.pieces && (p.byHand ?? 0) / p.pieces > 0.5 ? "font-semibold text-amber-400" : "text-ink-dim")}>
                      {p.pieces ? `${p.byHand ?? 0} of ${p.pieces}` : ""}
                    </td>
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

/** One truck on the board: what state it's in, why, and the one thing to do next. */
function TruckCard({ row, isMine, plan, manager, hand, showYard, quick = false }: {
  row: LoadOutTruckRow; isMine: boolean; plan?: { text: string; by: string | null; note: string | null; late?: string | null };
  manager: boolean; hand: boolean; showYard: boolean; quick?: boolean;
}) {
  const { t, pieces, status, why, whyTone, loadoutLine, doneToday, loadoutId, overridden, outTooLong, stillOut } = row;
  return (
    <Card className={cn("flex flex-col gap-3 border-l-4 p-4", outTooLong ? "border-l-red-500" : CHIP[status].edge)}>
          {isMine ? <div className="-mb-1 text-xs font-semibold text-bone">Your truck</div> : null}
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
                {unitTypeLabel(t.type)}{quick ? "" : ` · ${pieces} ${pieces === 1 ? "piece" : "pieces"} of iron`}{showYard ? ` · ${t.yardName}` : ""}
              </div>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-faint" />
          </Link>
          {why ? <div className={cn("break-words text-sm", whyTone === "red" ? "font-medium text-red-400" : "text-amber-400")}>{why}</div> : null}
          {stillOut ? <div className="break-words text-sm text-amber-400">{stillOut}</div> : null}
          {plan?.late ? <div className="break-words text-sm font-semibold text-red-400">{plan.late}</div> : null}
          {plan ? (
            <div className="flex items-start gap-1.5 break-words text-sm text-ink">
              <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-bone" />
              <span><span className="font-semibold">Next job:</span> {plan.text}{plan.note ? <> &middot; &ldquo;{plan.note}&rdquo;</> : null}{plan.by ? <span className="text-ink-faint"> &middot; {plan.by}</span> : null}</span>
            </div>
          ) : null}
          {loadoutId ? (
            <Link href={`/app/loadouts/${loadoutId}`} className={cn("text-[13px] underline-offset-2 hover:underline", status === "blocked" ? "text-red-400" : overridden ? "text-amber-400" : "text-bone")}>
              {loadoutLine} · See the record
            </Link>
          ) : (
            <div className="text-[13px] text-ink-faint">{loadoutLine ?? (quick ? "Not checked yet" : "No load-out scanned yet")}</div>
          )}
          <div className="flex gap-2">
            {status === "out" && quick ? (
              <TruckBackButton unitId={t.id} name={t.name} />
            ) : status === "out" ? (
              <Link href={`/app/units/${t.id}/return`} className={buttonClass("default", "lg", "h-14 min-w-0 flex-1 text-base")}>
                <PackageCheck className="h-5 w-5" /> Check in
              </Link>
            ) : quick ? (
              <Link href={`/app/units/${t.id}/scan`} className={buttonClass("default", "lg", "h-14 min-w-0 flex-1 text-base")}>
                <ScanLine className="h-5 w-5" /> {doneToday ? "Check it again" : "Check it"}
              </Link>
            ) : (
              <Link href={`/app/units/${t.id}/scan`} className={buttonClass("default", "lg", "h-14 min-w-0 flex-1 text-base")}>
                <ScanLine className="h-5 w-5" /> {doneToday ? "Scan again" : "Start load-out"}
              </Link>
            )}
            {manager ? (
              <Link href={`/app/units/${t.id}/plan`} className={buttonClass("outline", "lg", "h-14 shrink-0 px-4")} aria-label={`Plan ${t.name}'s next job`}>
                <ListTodo className="h-5 w-5" /> <span className="hidden sm:inline">Plan</span>
              </Link>
            ) : null}
            {hand || quick ? null : (
              <Link href={`/app/units/${t.id}/dispatch`} className={buttonClass("outline", "lg", "h-14 shrink-0 px-4")} aria-label={`Check ${t.name}'s paper for a job date`}>
                <ClipboardCheck className="h-5 w-5" /> <span className="hidden sm:inline">Paper check</span>
              </Link>
            )}
          </div>
          {/* Out on a job, the truck's load-out still opens from here with no
              signal: it's saved on the phone, the truck page isn't. */}
          {status === "out" ? (
            <Link href={`/app/units/${t.id}/scan`} className="-mt-1 inline-flex min-h-12 items-center gap-1.5 self-start px-1 text-sm text-ink-dim underline underline-offset-2">
              <ScanLine className="h-4 w-4" /> {quick ? "Check it for its next job" : "Start a new load-out"}
            </Link>
          ) : null}
        </Card>
  );
}
