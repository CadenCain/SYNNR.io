import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import QuickClient, { type QuickItem, type QuickUnit } from "./quick-client";

export const dynamic = "force-dynamic";

const ORDER: Record<ComplianceStatus, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

export default async function QuickPage() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [{ data: itemData }, { data: unitData }, { data: assetData }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, status, expiration_date, parent_type, parent_id")
      .eq("company_id", company.id),
    db.from("saas_units").select("id, name, saas_yards(name)").eq("company_id", company.id).order("name"),
    db.from("saas_assets").select("id, name").eq("company_id", company.id),
  ]);

  type UnitRow = { id: string; name: string; saas_yards: { name: string } | { name: string }[] | null };
  const unitRows = (unitData ?? []) as UnitRow[];
  const units: QuickUnit[] = unitRows.map((u) => ({
    id: u.id,
    name: u.name,
    yardName: (Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name) ?? "",
  }));

  const unitNames = new Map(unitRows.map((u) => [u.id, u.name]));
  const assetNames = new Map(((assetData ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));

  type Row = { id: string; title: string; status: ComplianceStatus; expiration_date: string | null; parent_type: string; parent_id: string };
  const items: QuickItem[] = ((itemData ?? []) as Row[])
    .map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      expiration_date: i.expiration_date,
      parentLabel: (i.parent_type === "unit" ? unitNames.get(i.parent_id) : assetNames.get(i.parent_id)) ?? "",
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Quick action" description="Two taps. Renew what's due or add what's new." />
      <QuickClient items={items} units={units} companyId={company.id} />
    </div>
  );
}
