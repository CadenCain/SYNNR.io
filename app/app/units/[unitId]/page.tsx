import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Box } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { unitTypeLabel, categoryLabel, ASSET_CATEGORIES, COMPLIANCE_KINDS, kindLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import RenewControl from "@/app/app/_components/renew-control";
import { addComplianceItem, addAsset } from "./actions";

export const dynamic = "force-dynamic";

interface CItem {
  id: string; title: string; kind: string; issued_date: string | null;
  expiration_date: string | null; status: ComplianceStatus; responsible_person: string | null;
}

export default async function UnitDetail({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const here = `/app/units/${unitId}`;

  const { data: unit } = await db
    .from("saas_units").select("id, name, type, identifier, yard_id, saas_yards(name)")
    .eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (!unit) notFound();
  const u = unit as { id: string; name: string; type: string; identifier: string | null; yard_id: string; saas_yards: { name: string } | { name: string }[] | null };
  const yardName = Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name;

  const { data: ciData } = await db
    .from("saas_compliance_items_with_status")
    .select("id, title, kind, issued_date, expiration_date, status, responsible_person")
    .eq("parent_type", "unit").eq("parent_id", unitId)
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const items = (ciData ?? []) as CItem[];

  const { data: assetData } = await db
    .from("saas_assets").select("id, name, category, status").eq("unit_id", unitId).order("name");
  const assets = (assetData ?? []) as { id: string; name: string; category: string; status: string }[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/app/yards/${u.yard_id}`} className="text-sm text-zinc-500 hover:text-zinc-300">← {yardName ?? "Yard"}</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{u.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">{unitTypeLabel(u.type)}{u.identifier ? ` · ${u.identifier}` : ""}</p>
      </div>

      {/* Truck book — compliance items */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-300">Truck book — certs, inspections &amp; DOT</h2>
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <Card key={it.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{it.title}</span>
                      <StatusBadge status={it.status} />
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-500">
                      {kindLabel(it.kind)}
                      {it.expiration_date ? ` · expires ${it.expiration_date}` : " · no expiration set"}
                      {it.responsible_person ? ` · ${it.responsible_person}` : ""}
                    </div>
                  </div>
                  <RenewControl itemId={it.id} companyId={company.id} redirectPath={here} />
                </div>
              </Card>
            ))}
          </div>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">{items.length ? "Add another item" : "Add a cert, inspection, or DOT item"}</h3>
          <form action={addComplianceItem} className="flex flex-col gap-3">
            <input type="hidden" name="parent_type" value="unit" />
            <input type="hidden" name="parent_id" value={u.id} />
            <input type="hidden" name="redirect_path" value={here} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="title" required placeholder="e.g. Annual DOT inspection"
                className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" />
              <select name="kind" defaultValue="inspection"
                className="h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7] sm:w-44">
                {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">Issued
                <input name="issued_date" type="date" className="h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" /></label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">Expires
                <input name="expiration_date" type="date" className="h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" /></label>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
            </div>
          </form>
        </Card>
      </section>

      {/* Assets on this unit */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-300">Assets on this unit</h2>
        {assets.length > 0 && (
          <div className="flex flex-col gap-2">
            {assets.map((a) => (
              <Link key={a.id} href={`/app/assets/${a.id}`}>
                <Card className="flex items-center gap-3 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                  <Box className="h-5 w-5 shrink-0 text-zinc-500" />
                  <span className="flex-1 truncate font-medium">{a.name}</span>
                  <span className="text-sm text-zinc-500">{categoryLabel(a.category)}</span>
                </Card>
              </Link>
            ))}
          </div>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">Add an asset to this unit</h3>
          <form action={addAsset} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="unit_id" value={u.id} />
            <input type="hidden" name="yard_id" value={u.yard_id} />
            <input type="hidden" name="redirect_path" value={here} />
            <input name="name" required placeholder="Asset name (e.g. BOP #3)"
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" />
            <select name="category" defaultValue="pressure_control"
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7] sm:w-48">
              {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
