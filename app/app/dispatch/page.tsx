import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { unitTypeLabel } from "@/lib/saas/taxonomy";

export const dynamic = "force-dynamic";

/** "Run a check" — pick the unit, land on its pre-dispatch check. */
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Run a check" description="Pick the unit — you'll get its computed pre-dispatch check." />
      {units.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No units yet. <Link href="/app/yards" className="text-bone hover:underline">Add a truck or rig</Link> first.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {units.map((u) => (
            <Link key={u.id} href={`/app/units/${u.id}/dispatch`}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-coal">
                  <Truck className="h-5 w-5 text-ink-dim" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-sm text-ink-dim">{unitTypeLabel(u.type)}{u.yard ? ` · ${u.yard}` : ""}</div>
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
