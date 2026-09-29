import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import type { UnitState } from "@/lib/saas/status";

export const dynamic = "force-dynamic";

const ORDER: Record<UnitState, number> = { not_ready: 0, due_soon: 1, not_setup: 2, ready: 3 };
const CHIP: Record<UnitState, { cls: string; label: string }> = {
  not_ready: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Not ready" },
  due_soon: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "Due soon" },
  ready: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready" },
  not_setup: { cls: "border-line-2 bg-elevated text-ink-faint", label: "Not set up" },
};

/**
 * "Check readiness": pick the truck, land on its check. Each row carries the
 * truck's state and reason right now, red first, so the foreman sees which
 * ones need a look before opening any of them.
 */
export default async function DispatchPicker() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const rd = await getCompanyReadiness(db, company.id);
  const units = [...rd.units].sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Check readiness" description="Pick a truck to check it against the job date: its certs, its crew's cards, and its gear." />
      {units.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No units yet. <Link href="/app/yards" className="text-bone hover:underline">Add a truck or rig</Link> first.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {units.map((u) => (
            <Link key={u.id} href={`/app/units/${u.id}/dispatch`}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2 sm:gap-4">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-coal sm:flex">
                  <Truck className="h-5 w-5 text-ink-dim" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${CHIP[u.state].cls}`}>{CHIP[u.state].label}</span>
                  </div>
                  <div className={`truncate text-sm ${u.state === "not_ready" ? "text-red-400" : "text-ink-dim"}`}>
                    {u.state === "ready" ? `${unitTypeLabel(u.type)}${u.yardName ? ` · ${u.yardName}` : ""}` : u.why}
                  </div>
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
