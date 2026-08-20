import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import QuickClient, { type QuickItem, type QuickUnit, type QuickAsset } from "./quick-client";

export const dynamic = "force-dynamic";

const ORDER: Record<ComplianceStatus, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };

export default async function QuickPage() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [{ data: itemData }, { data: unitData }, { data: assetData }, { data: crewData }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, status, expiration_date, parent_type, parent_id")
      .eq("company_id", company.id),
    db.from("saas_units").select("id, name, type, saas_yards(name)").eq("company_id", company.id).order("name"),
    db.from("saas_assets").select("id, name, last_seen_where, unit_id").eq("company_id", company.id).order("name"),
    db.from("saas_crew_members").select("id, name").eq("company_id", company.id),
  ]);

  type UnitRow = { id: string; name: string; type: string; saas_yards: { name: string } | { name: string }[] | null };
  const unitRows = (unitData ?? []) as UnitRow[];
  const units: QuickUnit[] = unitRows.map((u) => ({
    id: u.id,
    name: u.name,
    type: u.type,
    yardName: (Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name) ?? "",
  }));

  const unitNames = new Map(unitRows.map((u) => [u.id, u.name]));
  type AssetRow = { id: string; name: string; last_seen_where: string | null; unit_id: string | null };
  const assetRows = (assetData ?? []) as AssetRow[];
  const assetNames = new Map(assetRows.map((a) => [a.id, a.name]));
  const crewNames = new Map(((crewData ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  type Row = { id: string; title: string; status: ComplianceStatus; expiration_date: string | null; parent_type: string; parent_id: string };
  const items: QuickItem[] = ((itemData ?? []) as Row[])
    .map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      expiration_date: i.expiration_date,
      parentLabel: (i.parent_type === "unit" ? unitNames.get(i.parent_id) : i.parent_type === "crew" ? crewNames.get(i.parent_id) : assetNames.get(i.parent_id)) ?? "",
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""));

  const assets: QuickAsset[] = assetRows.map((a) => ({
    id: a.id,
    name: a.name,
    lastSeen: a.last_seen_where,
    unitName: a.unit_id ? unitNames.get(a.unit_id) ?? "" : "",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Quick action" description="Two taps. Renew what's due, add what's new, or say where something is." />
      <QuickClient items={items} units={units} assets={assets} companyId={company.id} />
    </div>
  );
}
