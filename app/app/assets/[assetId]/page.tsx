import Image from "next/image";
import { notFound } from "next/navigation";
import { Plus, Box, Settings2, Trash2 } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { categoryLabel, ASSET_CATEGORIES, COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceRow, { type RowItem } from "@/app/app/_components/compliance-row";
import { getItemCustomers } from "@/lib/saas/customers";
import { addComplianceItem } from "@/app/app/units/[unitId]/actions";
import { updateAsset, deleteAsset } from "@/app/app/_actions";
import PhotoUpload from "./photo-upload";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

export default async function AssetDetail({ params }: { params: Promise<{ assetId: string }> }) {
  const { company } = await requireCompany();
  const { assetId } = await params;
  const db = await saasDb();
  const here = `/app/assets/${assetId}`;

  const { data: asset } = await db
    .from("saas_assets").select("id, name, category, identifier, status, primary_photo_path, unit_id")
    .eq("id", assetId).eq("company_id", company.id).maybeSingle();
  if (!asset) notFound();
  const a = asset as { id: string; name: string; category: string; identifier: string | null; status: string; primary_photo_path: string | null; unit_id: string | null };

  let photoUrl: string | null = null;
  if (a.primary_photo_path) {
    const { data: signed } = await db.storage.from("proofs").createSignedUrl(a.primary_photo_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  const { data: ciData } = await db
    .from("saas_compliance_items_with_status")
    .select("id, title, kind, issued_date, expiration_date, status")
    .eq("parent_type", "asset").eq("parent_id", assetId)
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const items = (ciData ?? []) as RowItem[];
  const itemCustomers = await getItemCustomers(db, company.id, items.map((i) => i.id));
  for (const it of items) it.customers = itemCustomers.get(it.id) ?? [];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={a.unit_id ? { href: `/app/units/${a.unit_id}`, label: "Unit" } : { href: "/app/yards", label: "Yards" }}
        title={a.name}
        description={`${categoryLabel(a.category)}${a.identifier ? ` · ${a.identifier}` : ""} · ${a.status.replace(/_/g, " ")}`}
        actions={
          <details className="group relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink [&::-webkit-details-marker]:hidden">
              <Settings2 className="h-4 w-4" /> Manage
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-line bg-elevated p-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9)]">
              <form action={updateAsset} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={a.id} />
                <label className="text-xs text-ink-faint">Name<input name="name" defaultValue={a.name} required className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Category
                  <select name="category" defaultValue={a.category} className={`${fld} mt-1 w-full`}>
                    {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select></label>
                <label className="text-xs text-ink-faint">Status
                  <select name="status" defaultValue={a.status} className={`${fld} mt-1 w-full`}>
                    <option value="in_service">In service</option>
                    <option value="out_of_service">Out of service</option>
                    <option value="missing">Missing</option>
                  </select></label>
                <label className="text-xs text-ink-faint">Identifier<input name="identifier" defaultValue={a.identifier ?? ""} className={`${fld} mt-1 w-full`} /></label>
                <Button type="submit" size="sm">Save</Button>
              </form>
              <form action={deleteAsset} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="unit_id" value={a.unit_id ?? ""} />
                <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete asset
                </button>
              </form>
            </div>
          </details>
        }
      />

      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Photo</h2>
          <PhotoUpload assetId={a.id} companyId={company.id} hasPhoto={!!photoUrl} />
        </div>
        {photoUrl ? (
          <Image src={photoUrl} alt={a.name} width={640} height={400} unoptimized
            className="max-h-72 w-full rounded-xl border border-line object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-faint">
            <Box className="mr-2 h-5 w-5" /> No photo yet
          </div>
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Certs, tests &amp; inspections</h2>
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((it) => <ComplianceRow key={it.id} item={it} companyId={company.id} redirectPath={here} />)}
          </div>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-ink">{items.length ? "Add another" : "Add a test, cert, or inspection"}</h3>
          <form action={addComplianceItem} className="flex flex-col gap-3">
            <input type="hidden" name="parent_type" value="asset" />
            <input type="hidden" name="parent_id" value={a.id} />
            <input type="hidden" name="redirect_path" value={here} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="title" required placeholder="e.g. BOP test" className={`${fld} flex-1`} />
              <select name="kind" defaultValue="test" className={`${fld} sm:w-44`}>
                {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Issued<input name="issued_date" type="date" className={fld} /></label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Expires<input name="expiration_date" type="date" className={fld} /></label>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
