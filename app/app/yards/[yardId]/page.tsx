import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Truck, Plus, ChevronRight, Settings2, Trash2 } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { isRecentDuplicate } from "@/lib/saas/dedupe";
import { saasDb } from "@/lib/saas/db";
import { UNIT_TYPES, unitTypeLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { updateYard, deleteYard } from "@/app/app/_actions";
import ShareProof from "@/app/app/_components/share-proof";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

async function createUnit(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const yard_id = String(formData.get("yard_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "truck");
  const identifier = String(formData.get("identifier") ?? "").trim() || null;
  if (!yard_id || !name) return;
  const db = await saasDb();
  if (await isRecentDuplicate(db, "saas_units", { company_id: company.id, yard_id, name })) {
    revalidatePath(`/app/yards/${yard_id}`);
    return; // double-tap echo
  }
  const { error } = await db.from("saas_units").insert({ company_id: company.id, yard_id, name, type, identifier });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/yards/${yard_id}`);
}

export default async function YardDetail({ params }: { params: Promise<{ yardId: string }> }) {
  const { company } = await requireCompany();
  const { yardId } = await params;
  const db = await saasDb();

  const { data: yard } = await db.from("saas_yards").select("id, name, location").eq("id", yardId).eq("company_id", company.id).maybeSingle();
  if (!yard) notFound();
  const y = yard as { id: string; name: string; location: string | null };

  const { data: unitsData } = await db.from("saas_units").select("id, name, type, identifier").eq("yard_id", yardId).order("name");
  const units = (unitsData ?? []) as { id: string; name: string; type: string; identifier: string | null }[];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={{ href: "/app/yards", label: "Yards" }}
        title={y.name}
        description={y.location ?? undefined}
        actions={
          <>
          <ShareProof scope="yard" yardId={y.id} />
          <details className="group relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink [&::-webkit-details-marker]:hidden">
              <Settings2 className="h-4 w-4" /> Manage
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-line bg-elevated p-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9)]">
              <form action={updateYard} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={y.id} />
                <label className="text-xs text-ink-faint">Name<input name="name" defaultValue={y.name} required className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Location<input name="location" defaultValue={y.location ?? ""} className={`${fld} mt-1 w-full`} /></label>
                <Button type="submit" size="sm">Save</Button>
              </form>
              <form action={deleteYard} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="id" value={y.id} />
                <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete yard &amp; everything in it
                </button>
              </form>
            </div>
          </details>
          </>
        }
      />

      {units.length > 0 && (
        <div className="flex flex-col gap-2">
          {units.map((u) => (
            <Link key={u.id} href={`/app/units/${u.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Truck className="h-5 w-5 text-ink-dim" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-sm text-ink-dim">{unitTypeLabel(u.type)}{u.identifier ? ` · ${u.identifier}` : ""}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-ink">{units.length ? "Add another unit" : "Add a truck, rig, or shop"}</h2>
        <form action={createUnit} className="flex flex-col gap-3">
          <input type="hidden" name="yard_id" value={y.id} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input name="name" required placeholder="Name (e.g. Rig 4)" className={`${fld} flex-1`} />
            <select name="type" defaultValue="truck" className={`${fld} flex-1`}>
              {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input name="identifier" placeholder="VIN / unit # (optional)" className={`${fld} flex-1`} />
            <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add unit</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
