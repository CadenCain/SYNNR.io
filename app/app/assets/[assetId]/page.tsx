import Image from "next/image";
import { notFound } from "next/navigation";
import { Plus, Box, Settings2, Trash2 } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { categoryLabel, ASSET_CATEGORIES, COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import { Button, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceRow, { type RowItem } from "@/app/app/_components/compliance-row";
import { AddDisclosure } from "@/components/ui/disclosure";
import { getItemCustomers } from "@/lib/saas/customers";
import { addComplianceItem } from "@/app/app/units/[unitId]/actions";
import { updateAsset, deleteAsset, updateAssetLastSeen } from "@/app/app/_actions";
import { fmtDate, seenAge } from "@/lib/saas/format";
import PhotoUpload from "./photo-upload";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

export default async function AssetDetail({ params }: { params: Promise<{ assetId: string }> }) {
  const { company } = await requireCompany();
  const { assetId } = await params;
  const db = await saasDb();
  const here = `/app/assets/${assetId}`;

  const { data: asset } = await db
    .from("saas_assets").select("id, name, category, identifier, status, primary_photo_path, unit_id, last_seen_where, last_seen_by, last_seen_at")
    .eq("id", assetId).eq("company_id", company.id).maybeSingle();
  if (!asset) notFound();
  const a = asset as { id: string; name: string; category: string; identifier: string | null; status: string; primary_photo_path: string | null; unit_id: string | null; last_seen_where: string | null; last_seen_by: string | null; last_seen_at: string | null };

  let photoUrl: string | null = null;
  if (a.primary_photo_path) {
    const { data: signed } = await db.storage.from("proofs").createSignedUrl(a.primary_photo_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  // Paperwork shot (cert / MTR / test chart) — latest attachment labeled so.
  const { data: paperRows } = await db.from("saas_attachments")
    .select("storage_path").eq("company_id", company.id)
    .eq("entity_type", "asset").eq("entity_id", assetId).eq("label", "paperwork")
    .order("created_at", { ascending: false }).limit(1);
  let paperUrl: string | null = null;
  const paperPath = ((paperRows ?? []) as { storage_path: string }[])[0]?.storage_path ?? null;
  if (paperPath) {
    const { data: signed } = await db.storage.from("proofs").createSignedUrl(paperPath, 3600);
    paperUrl = signed?.signedUrl ?? null;
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
          <Popover>
            <PopoverTrigger className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink">
              <Settings2 className="h-4 w-4" /> Manage
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
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
              {company.role !== "member" && (
              <div className="mt-2 border-t border-line pt-2">
                <AlertDialog>
                  <AlertDialogTrigger className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete asset
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {a.name}?</AlertDialogTitle>
                      <AlertDialogDescription>Its certs, records, and photo go with it. There is no undo.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <form action={deleteAsset}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="unit_id" value={a.unit_id ?? ""} />
                        <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-bone-soft hover:bg-red-400")}>Delete it</button>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </PopoverContent>
          </Popover>
        }
      />

      {/* Last seen — a note, not a tracker. Never affects readiness. */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Where is it</h2>
        <p className="text-sm">
          {a.last_seen_where ? (
            <>
              <span className="font-medium">{a.last_seen_where}</span>
              <span className="text-ink-dim">
                {a.last_seen_by ? ` · per ${a.last_seen_by}` : ""}
              </span>
              {(() => {
                const age = seenAge(a.last_seen_at);
                if (!age) return null;
                const tone = age.tone === "fresh" ? "text-emerald-400"
                  : age.tone === "aging" ? "text-amber-400" : "text-ink-faint";
                return (
                  <span className={`ml-2 font-mono text-xs ${tone}`}>
                    {age.label}{age.tone === "stale" ? " · may have moved" : ""}
                  </span>
                );
              })()}
            </>
          ) : (
            <span className="text-ink-dim">Not recorded yet.</span>
          )}
        </p>
        <form action={updateAssetLastSeen} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="id" value={a.id} />
          <input name="last_seen_where" required placeholder="Where is it? e.g. Andrews yard, on 12, shop bench"
            defaultValue="" className={`${fld} min-w-0 flex-1`} />
          <Button type="submit" size="sm" className="h-11 shrink-0">Update</Button>
        </form>
        <p className="text-xs text-ink-faint">
          A note, not a tracker. It&apos;s only as good as whoever updates it, and it never affects a truck&apos;s ready call.
        </p>
      </Card>

      {/* Two shots make an asset accountable: the iron and its paper. A slot
          without its photo wears amber — flagged, not blocked, same rule as a
          cert with no date. */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Photos — the iron &amp; its paper</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">The asset</span>
              <PhotoUpload assetId={a.id} companyId={company.id} hasPhoto={!!photoUrl} />
            </div>
            {photoUrl ? (
              <Image src={photoUrl} alt={a.name} width={640} height={400} unoptimized
                className="max-h-72 w-full rounded-xl border border-line object-cover" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] text-sm text-amber-400">
                <Box className="h-5 w-5" /> Asset photo missing
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">The paperwork</span>
              <PhotoUpload assetId={a.id} companyId={company.id} hasPhoto={!!paperUrl} label="paperwork" />
            </div>
            {paperUrl ? (
              <Image src={paperUrl} alt={`${a.name} paperwork`} width={640} height={400} unoptimized
                className="max-h-72 w-full rounded-xl border border-line object-cover" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] text-sm text-amber-400">
                <Box className="h-5 w-5" /> Paperwork photo missing
              </div>
            )}
          </div>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Certs, tests &amp; inspections</h2>
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((it) => <ComplianceRow key={it.id} item={it} companyId={company.id} redirectPath={here} canDelete={company.role !== "member"} />)}
          </div>
        )}
        <AddDisclosure label={items.length ? "Add another" : "Add a test, cert, or inspection"} defaultOpen={items.length === 0}>
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
        </AddDisclosure>
      </section>
    </div>
  );
}
