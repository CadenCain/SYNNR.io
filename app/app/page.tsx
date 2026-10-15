import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { getEquipment } from "@/lib/saas/equipment";
import { localToday } from "@/lib/saas/status";
import { buildLoadOutTrucks, weekNumbers } from "@/lib/saas/loadout-board";
import LoadOutView from "./_components/loadout-view";

export const dynamic = "force-dynamic";

/**
 * Home: Load out. RollReady's main job is one question, "can this truck
 * roll right now?", answered at the moment iron goes on it. Every truck,
 * worst first, with its red reason, whether it's been loaded out today, and
 * a big button to start the load-out scan. The equipment list, yard map,
 * and tests due all support this screen.
 */
export default async function LoadOutHome() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();
  const [rd, list, { data: scanRows }, { data: weekScans }, { count: overrides }] = await Promise.all([
    getCompanyReadiness(db, company.id),
    getEquipment(db, company.id),
    db.from("saas_loadout_scans").select("unit_id, finished_at, scanned_by, scanned, expected")
      .eq("company_id", company.id).order("finished_at", { ascending: false }).limit(500),
    db.from("saas_loadout_scans").select("pieces").eq("company_id", company.id).gte("finished_at", weekAgo),
    db.from("saas_dispatch_checks").select("id", { count: "exact", head: true })
      .eq("company_id", company.id).eq("status", "not_ready_override").gte("started_at", weekAgo),
  ]);
  const { trucks, summary } = buildLoadOutTrucks(rd.units, list.rows, (scanRows ?? []) as never, localToday());
  const week = weekNumbers((weekScans ?? []) as { pieces: { red?: boolean }[] }[], overrides ?? 0);
  return <LoadOutView trucks={trucks} summary={summary} week={week} />;
}
