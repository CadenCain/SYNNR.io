import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Plus, Box } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { categoryLabel, COMPLIANCE_KINDS, kindLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import RenewControl from "@/app/app/_components/renew-control";
import { addComplianceItem } from "@/app/app/units/[unitId]/actions";
import PhotoUpload from "./photo-upload";

export const dynamic = "force-dynamic";

interface CItem {
  id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus;
}

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
    .select("id, title, kind, expiration_date, status")
    .eq("parent_type", "asset").eq("parent_id", assetId)
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const items = (ciData ?? []) as CItem[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        {a.unit_id ? (
          <Link href={`/app/units/${a.unit_id}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Unit</Link>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{a.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">{categoryLabel(a.category)}{a.identifier ? ` · ${a.identifier}` : ""} · {a.status.replace(/_/g, " ")}</p>
      </div>

      {/* Primary photo */}
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Photo</h2>
          <PhotoUpload assetId={a.id} companyId={company.id} hasPhoto={!!photoUrl} />
        </div>
        {photoUrl ? (
          <Image src={photoUrl} alt={a.name} width={640} height={400} unoptimized
            className="max-h-72 w-full rounded-lg border border-zinc-800 object-cover" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600">
            <Box className="mr-2 h-5 w-5" /> No photo yet
          </div>
        )}
      </Card>

      {/* Compliance items on this asset */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-300">Certs, tests &amp; inspections</h2>
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
                      {kindLabel(it.kind)}{it.expiration_date ? ` · expires ${it.expiration_date}` : " · no expiration set"}
                    </div>
                  </div>
                  <RenewControl itemId={it.id} companyId={company.id} redirectPath={here} />
                </div>
              </Card>
            ))}
          </div>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-zinc-300">{items.length ? "Add another" : "Add a test, cert, or inspection"}</h3>
          <form action={addComplianceItem} className="flex flex-col gap-3">
            <input type="hidden" name="parent_type" value="asset" />
            <input type="hidden" name="parent_id" value={a.id} />
            <input type="hidden" name="redirect_path" value={here} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="title" required placeholder="e.g. BOP test"
                className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" />
              <select name="kind" defaultValue="test"
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
    </div>
  );
}
