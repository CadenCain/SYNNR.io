import Link from "next/link";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";

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
    <div className="flex flex-col gap-7">
      <PageHeader title="Compliance" description="Everything with an expiration, soonest first." />

      {items.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No compliance items yet. Add certs and inspections from a unit or asset.
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th className="hidden sm:table-cell">Type</Th>
              <Th className="hidden sm:table-cell">On</Th>
              <Th>Expires</Th>
              <Th className="text-right">Status</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <Tr key={i.id}>
                <Td><Link href={hrefFor(i)} className="font-medium text-ink hover:underline">{i.title}</Link></Td>
                <Td className="hidden text-ink-dim sm:table-cell">{kindLabel(i.kind)}</Td>
                <Td className="hidden capitalize text-ink-dim sm:table-cell">{i.parent_type}</Td>
                <Td className="tabular-nums text-ink-dim">{i.expiration_date ?? "—"}</Td>
                <Td className="text-right"><StatusBadge status={i.status} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
