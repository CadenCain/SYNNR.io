import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Truck, Plus, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { UNIT_TYPES, unitTypeLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function createUnit(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const yard_id = String(formData.get("yard_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "truck");
  const identifier = String(formData.get("identifier") ?? "").trim() || null;
  if (!yard_id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_units").insert({ company_id: company.id, yard_id, name, type, identifier });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/yards/${yard_id}`);
}

export default async function YardDetail({ params }: { params: Promise<{ yardId: string }> }) {
  const { company } = await requireCompany();
  const { yardId } = await params;
  const db = await saasDb();

  const { data: yard } = await db
    .from("saas_yards").select("id, name, location").eq("id", yardId).eq("company_id", company.id).maybeSingle();
  if (!yard) notFound();
  const y = yard as { id: string; name: string; location: string | null };

  const { data: unitsData } = await db
    .from("saas_units").select("id, name, type, identifier").eq("yard_id", yardId).order("name");
  const units = (unitsData ?? []) as { id: string; name: string; type: string; identifier: string | null }[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/yards" className="text-sm text-zinc-500 hover:text-zinc-300">← Yards</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{y.name}</h1>
        {y.location ? <p className="mt-1 text-sm text-zinc-400">{y.location}</p> : null}
      </div>

      {units.length > 0 && (
        <div className="flex flex-col gap-2">
          {units.map((u) => (
            <Link key={u.id} href={`/app/units/${u.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
                  <Truck className="h-5 w-5 text-zinc-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-sm text-zinc-500">{unitTypeLabel(u.type)}{u.identifier ? ` · ${u.identifier}` : ""}</div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">{units.length ? "Add another unit" : "Add a truck, rig, or shop"}</h2>
        <form action={createUnit} className="flex flex-col gap-3">
          <input type="hidden" name="yard_id" value={y.id} />
          <div className="flex flex-col gap-3 sm:flex-row">
            <input name="name" required placeholder="Name (e.g. Rig 4)"
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" />
            <select name="type" defaultValue="truck"
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]">
              {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input name="identifier" placeholder="VIN / unit # (optional)"
              className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-zinc-100 outline-none focus:border-[#e7ddc7]" />
            <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add unit</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
