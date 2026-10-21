import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { getEquipment } from "@/lib/saas/equipment";
import { localToday } from "@/lib/saas/status";
import { YARD_TZ } from "@/lib/saas/format";
import { buildLoadOutTrucks, weekNumbers, kitShortByTruck, type LoadoutScanRow } from "@/lib/saas/loadout-board";
import { getYardRules } from "@/lib/saas/yard-rules";
import { daysOut } from "@/lib/saas/whereabouts";
import LoadOutView, { type ActivityLine, type PersonWeek } from "./_components/loadout-view";
import { WarmOffline } from "./_components/offline-support";
import LockedCard from "./_components/locked-card";
import WelcomeCard from "./_components/welcome-card";
import HandTips from "./_components/hand-tips";
import { isBillableYard } from "@/lib/saas/billing-rules";
import { isWritable } from "@/lib/saas/entitlements";

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
const clock = () => Date.now();

const TONE: Record<string, ActivityLine["tone"]> = {
  loadout_blocked: "red", check_not_ready: "red", alert_failed: "red", asset_status: "red",
  rolled_override: "amber",
  loadout_ready: "green", check_ready: "green", renewed: "green",
};

export default async function LoadOutHome({ searchParams }: { searchParams: Promise<{ yard?: string; welcome?: string; joined?: string }> }) {
  const { company, user } = await requireCompany();
  const { yard, welcome, joined } = await searchParams;
  const db = await saasDb();
  const weekAgo = weekAgoIso();
  const today = localToday();
  const [rd, list, { data: scanRows }, { data: weekScans }, { count: oldOverrides }, { data: overrideRows }, { data: eventRows }, { data: kitRows }, { data: returnRows }, { data: outRows }, { data: weekEvents }, rules] = await Promise.all([
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
    db.from("saas_packages").select("unit_id, saas_package_lines(label, qty, sort)").eq("company_id", company.id).not("unit_id", "is", null),
    db.from("saas_returns").select("unit_id, finished_at, returned_by").eq("company_id", company.id).order("finished_at", { ascending: false }).limit(400),
    db.from("saas_assets").select("id, unit_id, yard_id, out_since").eq("company_id", company.id).not("out_since", "is", null).not("status", "in", "(retired,missing)"),
    db.from("saas_events").select("kind, actor, unit_id").eq("company_id", company.id).gte("created_at", weekAgo).not("actor", "is", null).limit(2000),
    getYardRules(db, company.id),
  ]);

  const yards = list.yards.map((y) => ({ id: y.id, name: y.name }));
  const yardId = yard && yards.some((y) => y.id === yard) ? yard : null;
  const units = yardId ? rd.units.filter((u) => u.yardId === yardId) : rd.units;
  const unitIds = new Set(units.map((u) => u.id));

  const overrides = (overrideRows ?? []) as { loadout_id: string; created_at: string }[];
  const kits = new Map(((kitRows ?? []) as { unit_id: string; saas_package_lines: { label: string; qty: number; sort: number }[] | null }[])
    .map((k) => [k.unit_id, [...(k.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }))]));
  const inYard = <T extends { unit_id: string | null }>(r: T) => !yardId || (r.unit_id !== null && unitIds.has(r.unit_id));
  const nowMs = clock();
  const { trucks, counts, summary } = buildLoadOutTrucks(units, list.rows, (scanRows ?? []) as LoadoutScanRow[], new Set(overrides.map((o) => o.loadout_id)), today, kitShortByTruck(kits, list.rows),
    { returns: (returnRows ?? []) as { unit_id: string | null; finished_at: string; returned_by: string | null }[], now: nowMs, alertDays: rules.outAlertDays });

  // The iron, for the manager: what's out, what's out too long, what's out of test.
  const inYardScope = (r: { yardId?: string | null; unitId?: string | null }) => !yardId || r.yardId === yardId || (r.unitId !== null && r.unitId !== undefined && unitIds.has(r.unitId));
  const outList = ((outRows ?? []) as { id: string; unit_id: string | null; yard_id: string | null; out_since: string }[])
    .filter((r) => inYardScope({ yardId: r.yard_id, unitId: r.unit_id }));
  const rowsInScope = list.rows.filter((r) => r.state !== "retired" && (!yardId || r.yardOf === yardId));
  const iron = {
    out: outList.length,
    outTooLong: outList.filter((r) => daysOut(r.out_since, nowMs) >= rules.outAlertDays).length,
    outOfTest: rowsInScope.filter((r) => r.state === "overdue").length,
    dueSoon: rowsInScope.filter((r) => r.state === "due").length,
    down: rowsInScope.filter((r) => r.state === "down").length,
  };

  // Last 7 days, by person: what each one did.
  const people = new Map<string, PersonWeek>();
  for (const e of (weekEvents ?? []) as { kind: string; actor: string; unit_id: string | null }[]) {
    if (!e.actor || !inYard({ unit_id: e.unit_id })) continue;
    const p = people.get(e.actor) ?? { name: e.actor, loadouts: 0, returns: 0, overrides: 0, other: 0 };
    if (e.kind.startsWith("loadout_")) p.loadouts++;
    else if (e.kind === "returned") p.returns++;
    else if (e.kind === "rolled_override") p.overrides++;
    else p.other++;
    people.set(e.actor, p);
  }
  const byPerson = [...people.values()].sort((a, b) => (b.loadouts + b.returns + b.overrides + b.other) - (a.loadouts + a.returns + a.overrides + a.other)).slice(0, 10);

  // A hand's own truck (the one they last loaded out) goes first.
  const { data: mine } = company.role === "member"
    ? await db.from("saas_loadout_scans").select("unit_id").eq("company_id", company.id).eq("scanned_by_user", user.id).order("finished_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const myTruckId = (mine as { unit_id: string | null } | null)?.unit_id ?? null;
  const week = weekNumbers(((weekScans ?? []) as { pieces: { red?: boolean }[]; unit_id: string | null }[]).filter(inYard), overrides.length + (yardId ? 0 : oldOverrides ?? 0));

  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: YARD_TZ });
  const activity: ActivityLine[] = ((eventRows ?? []) as { id: string; kind: string; actor: string | null; message: string; unit_id: string | null; created_at: string }[])
    .filter((e) => dayOf(e.created_at) === today && inYard(e))
    .slice(0, 15)
    .map((e) => ({
      id: e.id,
      time: new Date(e.created_at).toLocaleTimeString("en-US", { timeZone: YARD_TZ, hour: "numeric", minute: "2-digit" }),
      // The message usually names the person already ("... by Dale Wooten").
      actor: e.actor && !e.message.includes(e.actor) ? e.actor : null, message: e.message, tone: TONE[e.kind] ?? null,
    }));

  return (
    <>
      {!isWritable(company.subscription_status, company.comped) ? <div className="mb-6"><LockedCard owner={company.role === "owner"} /></div> : null}
      {company.role === "member" && (joined === "1" || !myTruckId) ? (
        <div className="mb-6">
          <HandTips name={(user.user_metadata?.full_name as string | undefined)?.trim() || "there"} company={company.name} />
        </div>
      ) : null}
      {company.role !== "member" && !company.is_demo && isWritable(company.subscription_status, company.comped) && (welcome === "1" || list.rows.length === 0) ? (
        <div className="mb-6">
          <WelcomeCard justPaid={welcome === "1"} yards={yards.map((y) => y.name).filter(isBillableYard)}
            manager={company.role === "owner" || company.role === "admin"} />
        </div>
      ) : null}
      <LoadOutView trucks={trucks} counts={counts} summary={summary} week={week} yards={yards} yardId={yardId} activity={activity}
        iron={iron} byPerson={byPerson} myTruckId={myTruckId} alertDays={rules.outAlertDays} />
      <WarmOffline companyId={company.id} urls={["/app/return", ...rd.units.flatMap((u) => [`/app/units/${u.id}/scan`, `/app/units/${u.id}/return`])]} />
    </>
  );
}
