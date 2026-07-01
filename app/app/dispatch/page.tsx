import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { unitTypeLabel } from "@/lib/saas/taxonomy";

export const dynamic = "force-dynamic";

/** "Roll a truck" — pick the unit, land on its pre-dispatch check. */
export default async function DispatchPicker() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const { data } = await db
    .from("saas_units").select("id, name, type, saas_yards(name)")
    .eq("company_id", company.id).order("name");
  type Row = { id: string; name: string; type: string; saas_yards: { name: string } | { name: string }[] | null };
  const units = ((data ?? []) as Row[]).map((u) => ({
    id: u.id, name: u.name, type: u.type,
    yard: (Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name) ?? "",
  }));

  // Which units are currently out (open checkout, no linked check-in)?
  const { data: cos } = await db
    .from("saas_dispatch_checks").select("id, unit_id, type, checkout_id")
    .eq("company_id", company.id).order("started_at", { ascending: false }).limit(200);
  type C = { id: string; unit_id: string; type: string; checkout_id: string | null };
  const checks = (cos ?? []) as C[];
  const checkedIn = new Set(checks.filter((c) => c.type === "checkin" && c.checkout_id).map((c) => c.checkout_id as string));
  const outUnits = new Set<string>();
  const seen = new Set<string>();
  for (const c of checks) {
    if (c.type !== "checkout" || seen.has(c.unit_id)) continue;
    seen.add(c.unit_id);
    if (!checkedIn.has(c.id)) outUnits.add(c.unit_id);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Roll a truck" description="Pick the unit — you'll get its pre-dispatch check." />
      {units.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No units yet. <Link href="/app/yards" className="text-bone hover:underline">Add a truck or rig</Link> first.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {units.map((u) => {
            const out = outUnits.has(u.id);
            return (
              <Link key={u.id} href={`/app/units/${u.id}/dispatch`}>
                <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-coal">
                    <Truck className={out ? "h-5 w-5 text-amber-400" : "h-5 w-5 text-ink-dim"} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{u.name}</div>
                    <div className="truncate text-sm text-ink-dim">{unitTypeLabel(u.type)}{u.yard ? ` · ${u.yard}` : ""}</div>
                  </div>
                  {out ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">Out — check in</span> : null}
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
