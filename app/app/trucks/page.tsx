import Link from "next/link";
import { ChevronRight, ClipboardCheck, Warehouse } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import type { UnitState } from "@/lib/saas/status";
import ShareProof from "@/app/app/_components/share-proof";

export const dynamic = "force-dynamic";

const ORDER: Record<UnitState, number> = { not_ready: 0, due_soon: 1, not_setup: 2, ready: 3 };
const CHIP: Record<UnitState, { cls: string; label: string }> = {
  not_ready: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Not ready" },
  due_soon: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "Due soon" },
  ready: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready" },
  not_setup: { cls: "border-line-2 bg-elevated text-ink-faint", label: "Not set up" },
};

/**
 * Trucks, worst first. A truck is ready when its own paper (DOT, registration)
 * and every piece of iron on it are current, and nothing on it is red-tagged
 * or missing.
 */
export default async function Trucks() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const rd = await getCompanyReadiness(db, company.id);
  const units = [...rd.units].sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));
  const yards = new Set(units.map((u) => u.yardId));
  const notReady = units.filter((u) => u.state === "not_ready").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Trucks"
        description={units.length
          ? `${units.length} ${units.length === 1 ? "truck" : "trucks"}${notReady ? `, ${notReady} not ready` : ", none held up"}. A truck is ready when its own paper and all the iron on it are current.`
          : "A truck is ready when its own paper and all the iron on it are current."}
        actions={
          <>
            <Link href="/app/yards" className={buttonClass("outline", "sm")}><Warehouse className="h-4 w-4" /> Yards &amp; adding trucks</Link>
            {units.length > 0 && <ShareProof scope="company" warn={notReady ? `${notReady} ${notReady === 1 ? "truck is" : "trucks are"} NOT READY right now, and the link will say so.` : undefined} />}
            {units.length > 0 && <Link href="/app/dispatch" className={buttonClass("default", "sm")}><ClipboardCheck className="h-4 w-4" /> Check a truck for a job</Link>}
          </>
        }
      />
      {units.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No trucks yet. <Link href="/app/yards" className="text-bone hover:underline">Add a truck or trailer</Link> to a yard, then move iron onto it.
        </Card>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {units.map((u) => (
            <Link key={u.id} href={`/app/units/${u.id}`}>
              <Card className={`flex h-full items-center gap-3 border-l-4 p-4 transition-colors hover:border-line-2 ${
                u.state === "not_ready" ? "border-l-red-500" : u.state === "due_soon" ? "border-l-amber-500" : u.state === "ready" ? "border-l-emerald-500" : "border-l-line-2"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words font-semibold">{u.name}</span>
                    <span className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${CHIP[u.state].cls}`}>{CHIP[u.state].label}</span>
                  </div>
                  <div className="text-[13px] text-ink-faint">{unitTypeLabel(u.type)}{yards.size > 1 && u.yardName ? ` · ${u.yardName}` : ""}</div>
                  <div className={`mt-0.5 break-words text-sm ${u.state === "not_ready" ? "text-red-400" : u.state === "due_soon" ? "text-amber-400" : "text-ink-dim"}`}>{u.why}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
