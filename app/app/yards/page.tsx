import Link from "next/link";
import { revalidatePath } from "next/cache";
import { MapPin, Plus, ChevronRight, Upload } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { syncYardQuantity } from "@/lib/saas/billing";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

async function createYard(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  if (!name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_yards").insert({ company_id: company.id, name, location });
  if (error) throw new Error(error.message);
  await syncYardQuantity(company.id); // per-yard billing follows the yard count
  revalidatePath("/app/yards");
}

export default async function YardsPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db
    .from("saas_yards")
    .select("id, name, location, saas_units(count), saas_assets(count)")
    .eq("company_id", company.id)
    .order("name");
  type Row = { id: string; name: string; location: string | null; saas_units: { count: number }[]; saas_assets: { count: number }[] };
  const yards = (data ?? []) as Row[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Yards</h1>
          <p className="mt-1 text-sm text-ink-dim">Each yard holds your trucks, shops, assets, and certs.</p>
        </div>
        <Link href="/app/import" className={buttonClass("outline", "sm")}><Upload className="h-4 w-4" /> Import</Link>
      </div>

      {yards.length > 0 && (
        <div className="flex flex-col gap-2">
          {yards.map((y) => (
            <Link key={y.id} href={`/app/yards/${y.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2 hover:bg-surface">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
                  <MapPin className="h-5 w-5 text-ink-dim" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{y.name}</div>
                  <div className="truncate text-sm text-ink-dim">
                    {y.location ? y.location + " · " : ""}
                    {y.saas_units?.[0]?.count ?? 0} units · {y.saas_assets?.[0]?.count ?? 0} assets
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-ink">{yards.length ? "Add another yard" : "Add your first yard"}</h2>
        <form action={createYard} className="flex flex-col gap-3 sm:flex-row">
          <input name="name" required placeholder="Yard name (e.g. Midland Yard)"
            className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
          <input name="location" placeholder="Location (optional)"
            className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
          <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add yard</Button>
        </form>
      </Card>
    </div>
  );
}
