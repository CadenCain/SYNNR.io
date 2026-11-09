import { requireCompany } from "@/lib/saas/auth";
import { readAll } from "@/lib/saas/read-all";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import { getYardRules, isManagerRole } from "@/lib/saas/yard-rules";
import QuickClient, { type QuickItem, type QuickUnit, type QuickAsset } from "./quick-client";

export const metadata = { title: "Add or renew" };

export const dynamic = "force-dynamic";

const ORDER: Record<ComplianceStatus, number> = { expired: 0, no_paper: 1, expiring: 2, valid: 3, none: 4 };

export default async function QuickPage() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [itemData, { data: unitData }, assetData, { data: yardData }] = await Promise.all([
    readAll<unknown>((a, b) => db.from("saas_compliance_items_with_status")
      .select("id, title, status, expiration_date, parent_type, parent_id", { count: "exact" })
      .eq("company_id", company.id).neq("parent_type", "crew").order("id").range(a, b)),
    db.from("saas_units").select("id, name, type, saas_yards(name)").eq("company_id", company.id).order("name"),
    readAll<unknown>((a, b) => db.from("saas_assets").select("id, name, last_seen_where, unit_id", { count: "exact" }).eq("company_id", company.id).order("name").order("id").range(a, b)),
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("created_at"),
  ]);

  const rules = await getYardRules(db, company.id);

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

  const assets: QuickAsset[] = assetRows.map((a) => ({
    id: a.id,
    name: a.name,
    lastSeen: a.last_seen_where,
    unitName: a.unit_id ? unitNames.get(a.unit_id) ?? "" : "",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Add or renew" description="Upload a new cert, add what's new, or say where something is." />
      <QuickClient items={items} units={units} assets={assets} companyId={company.id}
        isManager={isManagerRole(company.role)} allowOnTheWay={rules.allowCertOnTheWay} yards={(yardData ?? []) as { id: string; name: string }[]} />
    </div>
  );
}
