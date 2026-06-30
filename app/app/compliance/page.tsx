import Link from "next/link";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

interface Item {
  id: string; title: string; kind: string; expiration_date: string | null;
  status: ComplianceStatus; parent_type: string; parent_id: string;
}

const ORDER: Record<ComplianceStatus, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

export default async function CompliancePage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db
    .from("saas_compliance_items_with_status")
    .select("id, title, kind, expiration_date, status, parent_type, parent_id")
    .eq("company_id", company.id);
  const items = ((data ?? []) as Item[]).sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""),
  );

  const hrefFor = (i: Item) => (i.parent_type === "unit" ? `/app/units/${i.parent_id}` : `/app/assets/${i.parent_id}`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="mt-1 text-sm text-zinc-400">Everything with an expiration, soonest first.</p>
      </div>

      {items.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-zinc-400">
          No compliance items yet. Add certs and inspections from a unit or asset.
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((i) => (
            <Link key={i.id} href={hrefFor(i)}>
              <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                <div className="min-w-0">
                  <div className="truncate font-medium">{i.title}</div>
                  <div className="text-sm text-zinc-500">
                    {kindLabel(i.kind)} · {i.parent_type}
                    {i.expiration_date ? ` · expires ${i.expiration_date}` : ""}
                  </div>
                </div>
                <StatusBadge status={i.status} />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
