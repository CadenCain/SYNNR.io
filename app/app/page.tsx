import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { getEquipment } from "@/lib/saas/equipment";
import { localToday } from "@/lib/saas/status";
import { YARD_TZ } from "@/lib/saas/format";
import { buildLoadOutTrucks, weekNumbers, type LoadoutScanRow } from "@/lib/saas/loadout-board";
import LoadOutView, { type ActivityLine } from "./_components/loadout-view";
import { WarmOffline } from "./_components/offline-support";

export const dynamic = "force-dynamic";

/**
 * Home: Load out. RollReady's main job is one question, "can this truck
 * roll right now?", answered at the moment iron goes on it. Every truck as
 * Blocked, Ready to load, or Loaded out, per yard, and who did what today.
 * The equipment list, yard map, and tests due all support this screen.
 */
/** A week back from now, as an ISO time. */
const weekAgoIso = () => new Date(Date.now() - 7 * 86400e3).toISOString();
/** Midnight this morning in the yard's time zone, as an ISO time (a day and a half back is plenty to filter from). */
const sinceIso = () => new Date(Date.now() - 36 * 3600e3).toISOString();

const TONE: Record<string, ActivityLine["tone"]> = {
  loadout_blocked: "red", check_not_ready: "red", alert_failed: "red", asset_status: "red",
  rolled_override: "amber",
  loadout_ready: "green", check_ready: "green", renewed: "green",
};

export default async function LoadOutHome({ searchParams }: { searchParams: Promise<{ yard?: string }> }) {
  const { company } = await requireCompany();
  const { yard } = await searchParams;
  const db = await saasDb();
  const weekAgo = weekAgoIso();
  const today = localToday();
  const [rd, list, { data: scanRows }, { data: weekScans }, { count: oldOverrides }, { data: overrideRows }, { data: eventRows }] = await Promise.all([
    getCompanyReadiness(db, company.id),
    getEquipment(db, company.id),
    db.from("saas_loadout_scans").select("id, unit_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned")
      .eq("company_id", company.id).order("finished_at", { ascending: false }).limit(300),
    db.from("saas_loadout_scans").select("pieces, unit_id").eq("company_id", company.id).gte("finished_at", weekAgo),
    db.from("saas_dispatch_checks").select("id", { count: "exact", head: true })
      .eq("company_id", company.id).eq("status", "not_ready_override").gte("started_at", weekAgo),
    db.from("saas_loadout_overrides").select("loadout_id, created_at").eq("company_id", company.id).gte("created_at", weekAgo),
    db.from("saas_events").select("id, kind, actor, message, unit_id, created_at")
      .eq("company_id", company.id).gte("created_at", sinceIso()).order("created_at", { ascending: false }).limit(60),
  ]);

  const yards = list.yards.map((y) => ({ id: y.id, name: y.name }));
  const yardId = yard && yards.some((y) => y.id === yard) ? yard : null;
  const units = yardId ? rd.units.filter((u) => u.yardId === yardId) : rd.units;
  const unitIds = new Set(units.map((u) => u.id));

  const overrides = (overrideRows ?? []) as { loadout_id: string; created_at: string }[];
  const { trucks, counts, summary } = buildLoadOutTrucks(units, list.rows, (scanRows ?? []) as LoadoutScanRow[], new Set(overrides.map((o) => o.loadout_id)), today);
  const inYard = <T extends { unit_id: string | null }>(r: T) => !yardId || (r.unit_id !== null && unitIds.has(r.unit_id));
  const week = weekNumbers(((weekScans ?? []) as { pieces: { red?: boolean }[]; unit_id: string | null }[]).filter(inYard), overrides.length + (yardId ? 0 : oldOverrides ?? 0));

  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: YARD_TZ });
  const activity: ActivityLine[] = ((eventRows ?? []) as { id: string; kind: string; actor: string | null; message: string; unit_id: string | null; created_at: string }[])
    .filter((e) => dayOf(e.created_at) === today && inYard(e))
    .slice(0, 15)
    .map((e) => ({
      id: e.id,
      time: new Date(e.created_at).toLocaleTimeString("en-US", { timeZone: YARD_TZ, hour: "numeric", minute: "2-digit" }),
      actor: e.actor, message: e.message, tone: TONE[e.kind] ?? null,
    }));

  return (
    <>
      <LoadOutView trucks={trucks} counts={counts} summary={summary} week={week} yards={yards} yardId={yardId} activity={activity} />
      <WarmOffline companyId={company.id} urls={rd.units.map((u) => `/app/units/${u.id}/scan`)} />
    </>
  );
}
