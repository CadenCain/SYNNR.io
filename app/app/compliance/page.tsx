import { requireCompany } from "@/lib/saas/auth";
import { getItemCustomers } from "@/lib/saas/customers";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceTable, { type CompItem } from "./compliance-table";

export const dynamic = "force-dynamic";

interface Item {
  id: string; title: string; kind: string; expiration_date: string | null;
  status: ComplianceStatus; parent_type: string; parent_id: string;
}

export default async function CompliancePage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data }, { data: unitData }, { data: assetData }, { data: crewData }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, kind, expiration_date, status, parent_type, parent_id")
      .eq("company_id", company.id),
    db.from("saas_units").select("id, name").eq("company_id", company.id),
    db.from("saas_assets").select("id, name").eq("company_id", company.id),
    db.from("saas_crew_members").select("id, name").eq("company_id", company.id),
  ]);
  const items = (data ?? []) as Item[];
  const itemCustomers = await getItemCustomers(db, company.id, items.map((i) => i.id));
  const name = (rows: unknown, id: string) =>
    (((rows ?? []) as { id: string; name: string }[]).find((r) => r.id === id)?.name) ?? "";

  const rows: CompItem[] = items.map((i) => ({
    id: i.id,
    title: i.title,
    kind: i.kind,
    kindLabel: kindLabel(i.kind),
    expiration_date: i.expiration_date,
    status: i.status,
    parent_type: i.parent_type,
    parentLabel:
      i.parent_type === "unit" ? name(unitData, i.parent_id)
      : i.parent_type === "crew" ? `${name(crewData, i.parent_id)} (crew)`
      : name(assetData, i.parent_id),
    href: i.parent_type === "unit" ? `/app/units/${i.parent_id}` : i.parent_type === "crew" ? `/app/crew/${i.parent_id}` : `/app/assets/${i.parent_id}`,
    customers: itemCustomers.get(i.id) ?? [],
  }));

  const gearCount = items.filter((i) => i.parent_type !== "crew").length;
  const crewCount = items.filter((i) => i.parent_type === "crew").length;
  const failing = items.filter((i) => i.status === "expired" || i.status === "none").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Compliance" description="Everything with an expiration — gear, DOT, and crew cards. Filter, sort, fix." />

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-line-2 px-2.5 py-1 text-ink-dim">{gearCount} gear cert{gearCount === 1 ? "" : "s"} &amp; inspections</span>
          <span className="rounded-full border border-line-2 px-2.5 py-1 text-ink-dim">{crewCount} crew card{crewCount === 1 ? "" : "s"}</span>
          <span className={`rounded-full border px-2.5 py-1 ${failing > 0 ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"}`}>
            {failing > 0 ? `${failing} failing (expired or missing date)` : "nothing failing"}
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          No compliance items yet. Add certs and inspections from a unit, asset, or crew member.
        </Card>
      ) : (
        <ComplianceTable items={rows} />
      )}
    </div>
  );
}
