import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment } from "@/lib/saas/equipment";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import YardMap from "@/app/app/_components/yard-map";
import { fmtWhen } from "@/lib/saas/format";

export const dynamic = "force-dynamic";

/** Every truck and rack in the yard, and the iron on it, colored by status. */
export default async function YardMapPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [list, rd, { data: scanRows }] = await Promise.all([
    getEquipment(db, company.id),
    getCompanyReadiness(db, company.id),
    db.from("saas_loadout_scans").select("unit_id, finished_at").eq("company_id", company.id)
      .order("finished_at", { ascending: false }).limit(500),
  ]);
  // Newest load-out per truck.
  const lastLoadout: Record<string, string> = {};
  for (const r of (scanRows ?? []) as { unit_id: string | null; finished_at: string }[]) {
    if (r.unit_id && !lastLoadout[r.unit_id]) lastLoadout[r.unit_id] = r.finished_at;
  }
  const fmt = Object.fromEntries(Object.entries(lastLoadout).map(([k, v]) => [k, fmtWhen(v)]));
  return <YardMap rows={list.rows} trucks={rd.units} yards={list.yards} lastLoadout={lastLoadout} fmt={fmt} />;
}
