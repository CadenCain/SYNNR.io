import Link from "next/link";
import { Warehouse, Plus, Upload } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge, StatusDot } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

interface Item {
  id: string; title: string; expiration_date: string | null; status: ComplianceStatus;
  parent_type: string; parent_id: string;
}

export default async function Dashboard() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [{ count: yardCount }, { data: itemData }] = await Promise.all([
    db.from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    db.from("saas_compliance_items_with_status")
      .select("id, title, expiration_date, status, parent_type, parent_id")
      .eq("company_id", company.id),
  ]);
  const items = (itemData ?? []) as Item[];

  const counts = { expired: 0, expiring: 0, valid: 0, none: 0 } as Record<ComplianceStatus, number>;
  for (const i of items) counts[i.status]++;

  const actionList = items
    .filter((i) => i.status === "expired" || i.status === "expiring")
    .sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))
    .slice(0, 12);

  const rollup: { status: ComplianceStatus; label: string; count: number }[] = [
    { status: "expired", label: "Expired", count: counts.expired },
    { status: "expiring", label: "Expiring this month", count: counts.expiring },
    { status: "valid", label: "Valid", count: counts.valid },
  ];

  const hrefFor = (i: Item) => (i.parent_type === "unit" ? `/app/units/${i.parent_id}` : `/app/assets/${i.parent_id}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="mt-1 text-sm text-ink-dim">Every cert, inspection, and DOT item across your yards — at a glance.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rollup.map((r) => (
          <Card key={r.label} className="p-5">
            <div className="flex items-center gap-2 text-sm text-ink-dim"><StatusDot status={r.status} />{r.label}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{r.count}</div>
          </Card>
        ))}
      </div>

      {yardCount === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface">
            <Warehouse className="h-6 w-6 text-ink-dim" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">No yards yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-dim">Add your first yard and start tracking trucks, shops, assets, and certs.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Link href="/app/yards" className={buttonClass("default")}><Plus className="h-[18px] w-[18px]" /> Add a yard</Link>
            <Link href="/app/import" className={buttonClass("outline")}><Upload className="h-[18px] w-[18px]" /> Import a list</Link>
          </div>
        </Card>
      ) : actionList.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-ink">Needs attention</h2>
          <div className="flex flex-col gap-2">
            {actionList.map((i) => (
              <Link key={i.id} href={hrefFor(i)}>
                <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-line-2 hover:bg-surface">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.title}</div>
                    <div className="text-sm text-ink-dim">{i.expiration_date ? `expires ${i.expiration_date}` : "no date"}</div>
                  </div>
                  <StatusBadge status={i.status} />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          Nothing expiring soon. You&apos;re rolling ready. ✓
        </Card>
      )}
    </div>
  );
}
