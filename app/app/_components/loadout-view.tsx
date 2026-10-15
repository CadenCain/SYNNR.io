import Link from "next/link";
import { ScanLine, ClipboardCheck, ChevronRight, Warehouse } from "lucide-react";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UnitTile } from "@/lib/saas/readiness";
import type { UnitState } from "@/lib/saas/status";
import { cn } from "@/lib/utils";

/**
 * The Load out screen, presentation only. The real home page feeds it live
 * trucks; the marketing screenshot feeds it the demo yard, so the picture on
 * the site is this exact screen.
 */

const CHIP: Record<UnitState, { cls: string; label: string; edge: string }> = {
  not_ready: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Not ready", edge: "border-l-red-500" },
  due_soon: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "Due soon", edge: "border-l-amber-500" },
  ready: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready", edge: "border-l-emerald-500" },
  not_setup: { cls: "border-line-2 bg-elevated text-ink-faint", label: "Not set up", edge: "border-l-line-2" },
};

export interface LoadOutTruck {
  t: UnitTile;
  pieces: number;
  /** Already worded, in the yard's time zone: "Loaded out today 4:40 AM by Ray Hinojosa, 5 of 5 scanned". */
  loadoutLine: string | null;
  doneToday: boolean;
}

export default function LoadOutView({ trucks, summary }: { trucks: LoadOutTruck[]; summary: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold tracking-tight">Load out</h1>
          <p className="mt-0.5 text-sm text-ink-dim">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/yards" className={buttonClass("outline", "sm")}><Warehouse className="h-4 w-4" /> Yards &amp; adding trucks</Link>
        </div>
      </div>

      {trucks.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <ScanLine className="h-8 w-8 text-ink-faint" />
          <div className="text-lg font-semibold">No trucks yet</div>
          <p className="max-w-md text-sm text-ink-dim">Add your trucks and trailers to a yard, put your iron on them, and every load-out gets checked as it goes on.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/app/yards" className={buttonClass("default")}>Add a truck</Link>
            <Link href="/app/import" className={buttonClass("outline")}>Import a spreadsheet</Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {trucks.map(({ t, pieces, loadoutLine, doneToday }) => (
            <Card key={t.id} className={cn("flex flex-col gap-3 border-l-4 p-4", CHIP[t.state].edge)}>
              <Link href={`/app/units/${t.id}`} className="group flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-lg font-semibold group-hover:text-bone">{t.name}</span>
                    <span className={cn("whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold", CHIP[t.state].cls)}>{CHIP[t.state].label}</span>
                  </div>
                  <div className="text-[13px] text-ink-faint">
                    {unitTypeLabel(t.type)} · {pieces} {pieces === 1 ? "piece" : "pieces"} of iron
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-ink-faint" />
              </Link>
              {t.state === "not_ready" || t.state === "due_soon" ? (
                <div className={cn("break-words text-sm", t.state === "not_ready" ? "text-red-400" : "text-amber-400")}>{t.why}</div>
              ) : null}
              <div className={cn("text-[13px]", doneToday ? "text-emerald-400" : "text-ink-faint")}>{loadoutLine ?? "No load-out scanned yet"}</div>
              <div className="flex gap-2">
                <Link href={`/app/units/${t.id}/scan`} className={buttonClass("default", "lg", "min-w-0 flex-1")}>
                  <ScanLine className="h-5 w-5" /> {doneToday ? "Scan again" : "Start load-out"}
                </Link>
                <Link href={`/app/units/${t.id}/dispatch`} className={buttonClass("outline", "lg", "shrink-0 px-4")} aria-label={`Check ${t.name} for a job`}>
                  <ClipboardCheck className="h-5 w-5" /> <span className="hidden sm:inline">Check</span>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
