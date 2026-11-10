import { requireCompany } from "@/lib/saas/auth";
import { readAll } from "@/lib/saas/read-all";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { getEquipment } from "@/lib/saas/equipment";
import { localToday } from "@/lib/saas/status";
import { YARD_TZ, yardZone, zoneShort } from "@/lib/saas/format";
import { yardZones } from "@/lib/saas/loadout-record";
import { buildLoadOutTrucks, weekNumbers, kitShortByTruck, planShortByTruck, type LoadoutScanRow } from "@/lib/saas/loadout-board";
import { getYardRules } from "@/lib/saas/yard-rules";
import { daysOut } from "@/lib/saas/whereabouts";
import LoadOutView, { type ActivityLine, type PersonWeek } from "./_components/loadout-view";
import { WarmOffline } from "./_components/offline-support";
import { getOpenPlans, planSummary, lateLine } from "@/lib/saas/plans";
import LockedCard from "./_components/locked-card";
import WelcomeCard from "./_components/welcome-card";
import HandTips from "./_components/hand-tips";
import { cookies } from "next/headers";
import { pickMyTruck, myTruckCookie } from "./my-truck";
import { isBillableYard } from "@/lib/saas/billing-rules";
import { isWritable } from "@/lib/saas/entitlements";

export const metadata = { title: "Load out · RollReady" };

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

const QUICK_FEED = new Set(["loadout_ready", "loadout_blocked", "rolled_override", "returned", "yard_check", "signed_out", "tools_back", "vendor_visit", "plan_set"]);

const TONE: Record<string, ActivityLine["tone"]> = {
  loadout_blocked: "red", check_not_ready: "red", alert_failed: "red", asset_status: "red", unscanned_trip: "red",
  red_tagged: "red", bad_iron_out: "red",
  rolled_override: "amber", deleted_failing: "amber", yard_check: "amber",
  loadout_ready: "green", check_ready: "green", renewed: "green",
};

export default async function LoadOutHome({ searchParams }: { searchParams: Promise<{ yard?: string; welcome?: string; joined?: string; pick?: string }> }) {
  const { company, user } = await requireCompany();
  const { yard, welcome, joined, pick } = await searchParams;
  const db = await saasDb();
  const weekAgo = weekAgoIso();
  const today = localToday();
  const [rd, list, { data: scanRows }, { data: weekScans }, { data: overrideRows }, { data: eventRows }, { data: kitRows }, { data: returnRows }, { data: outRows }, { data: weekEvents }, rules, openPlans, { data: pkgNameRows }, { data: latestScanRows }, { data: latestBackRows }, zones] = await Promise.all([
    getCompanyReadiness(db, company.id),
    getEquipment(db, company.id),
    db.from("saas_loadout_scans").select("id, unit_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned")
      .eq("company_id", company.id).order("finished_at", { ascending: false }).limit(300),
    db.from("saas_loadout_scans").select("id, finished_at, pieces, unit_id, scanned_by").eq("company_id", company.id).gte("finished_at", weekAgo),
    // Every override, not just this week's: a truck that rolled on one 10 days
    // ago is still out on it, not blocked. Overrides are rare; 2,000 is years.
    db.from("saas_loadout_overrides").select("loadout_id, created_at, by_name").eq("company_id", company.id).order("created_at", { ascending: false }).limit(2000),
    // Today's feed: what people did. A load-out's piece-by-piece moves would
    // crowd that out on a busy day, so moves come in a short list of their own.
    Promise.all([
      db.from("saas_events").select("id, kind, actor, message, unit_id, created_at")
        .eq("company_id", company.id).gte("created_at", sinceIso()).neq("kind", "asset_moved").order("created_at", { ascending: false }).limit(200),
      db.from("saas_events").select("id, kind, actor, message, unit_id, created_at")
        .eq("company_id", company.id).gte("created_at", sinceIso()).eq("kind", "asset_moved").order("created_at", { ascending: false }).limit(15),
    ]).then(([a, b]) => ({ data: [...(a.data ?? []), ...(b.data ?? [])].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))) })),
    db.from("saas_packages").select("unit_id, saas_package_lines(label, qty, sort)").eq("company_id", company.id).not("unit_id", "is", null),
    db.from("saas_returns").select("unit_id, finished_at, returned_by").eq("company_id", company.id).order("finished_at", { ascending: false }).limit(400),
    db.from("saas_assets").select("id, unit_id, yard_id, out_since, out_with_name").eq("company_id", company.id).not("out_since", "is", null).not("status", "in", "(retired,missing)"),
    readAll<{ kind: string; actor: string; unit_id: string | null }>((a, b) => db.from("saas_events").select("id, kind, actor, unit_id", { count: "exact" }).eq("company_id", company.id)
      .gte("created_at", weekAgo).not("actor", "is", null).neq("kind", "asset_moved").order("id").range(a, b)).then((data) => ({ data })),
    getYardRules(db, company.id),
    getOpenPlans(db, company.id),
    db.from("saas_packages").select("id, name, saas_package_lines(label, qty, sort)").eq("company_id", company.id).is("unit_id", null),
    // Each truck's newest load-out and check-in, however old: the lists above
    // are the newest few hundred, and a truck out a week can be past them.
    db.from("saas_loadout_latest").select("id, unit_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned").eq("company_id", company.id),
    db.from("saas_return_latest").select("unit_id, finished_at, returned_by").eq("company_id", company.id),
    // Each yard's time zone: a Hobbs (Mountain) truck's times read in Mountain.
    db.from("saas_yards").select("id").eq("company_id", company.id).then(({ data }) => yardZones(db, ((data ?? []) as { id: string }[]).map((y) => y.id))),
  ]);
  // The recent load-outs plus each truck's newest one, once each, newest first.
  const allScans = [...new Map([...((latestScanRows ?? []) as LoadoutScanRow[]), ...((scanRows ?? []) as LoadoutScanRow[])].map((r) => [r.id, r])).values()]
    .sort((a, b) => b.finished_at.localeCompare(a.finished_at));
  const allReturns = [...((latestBackRows ?? []) as { unit_id: string | null; finished_at: string; returned_by: string | null }[]),
    ...((returnRows ?? []) as { unit_id: string | null; finished_at: string; returned_by: string | null }[])];
  // Each truck's planned next job, in words.
  const pkgRows = (pkgNameRows ?? []) as { id: string; name: string; saas_package_lines: { label: string; qty: number; sort: number }[] | null }[];
  const pkgNames = new Map(pkgRows.map((x) => [x.id, x.name]));
  const packages = new Map(pkgRows.map((x) => [x.id, { name: x.name, lines: [...(x.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty })) }]));
  // A planned job past its leave time with nothing rolled: nobody scanned it out.
  const latestScan = new Map<string, { finished_at: string; rolled: boolean }>();
  const overriddenIds = new Set(((overrideRows ?? []) as { loadout_id: string }[]).map((o) => o.loadout_id));
  for (const r of allScans) {
    if (r.unit_id && !latestScan.has(r.unit_id)) latestScan.set(r.unit_id, { finished_at: r.finished_at, rolled: r.verdict === "ready" || overriddenIds.has(r.id) });
  }
  const yards = list.yards.map((y) => ({ id: y.id, name: y.name }));
  const yardId = yard && yards.some((y) => y.id === yard) ? yard : null;
  const units = yardId ? rd.units.filter((u) => u.yardId === yardId) : rd.units;
  const unitIds = new Set(units.map((u) => u.id));

  // Times read on each truck's yard clock. When the trucks on screen run on
  // more than one zone, each time says which (the board does the same).
  const planNow = clock();
  const zoneOfUnit = new Map(rd.units.map((u) => [u.id, yardZone(zones.get(u.yardId))]));
  const companyZones = new Set(list.yards.map((y) => yardZone(zones.get(y.id))));
  const homeZone = companyZones.size === 1 ? [...companyZones][0] : YARD_TZ;
  const mixedZones = new Set(units.map((u) => zoneOfUnit.get(u.id) ?? YARD_TZ)).size > 1;
  const dayIn = (iso: string | number, tz: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
  const timeText = (tz: string) => (iso: string) => {
    const sameDay = dayIn(iso, tz) === (tz === YARD_TZ ? today : dayIn(planNow, tz));
    const s = new Date(iso).toLocaleString("en-US", { timeZone: tz, ...(sameDay ? {} : { weekday: "short" }), hour: "numeric", minute: "2-digit" });
    return mixedZones ? `${s} ${zoneShort(tz)}` : s;
  };
  const plans: Record<string, { text: string; by: string | null; note: string | null; late: string | null }> = {};
  for (const [unitId, p] of openPlans) {
    const clockText = timeText(zoneOfUnit.get(unitId) ?? homeZone);
    // The job or well and when it leaves come first: "University 7-12 #3H, leaves 6:00 AM: just the truck's kit".
    const head = [p.job?.trim() || null, p.leavesAt ? `leaves ${clockText(p.leavesAt)}` : null].filter(Boolean).join(", ");
    const summary = planSummary(p, pkgNames);
    plans[unitId] = { text: head ? `${head}: ${summary}` : summary, by: p.by, note: p.note, late: lateLine(p, latestScan.get(unitId) ?? null, planNow, clockText) };
  }

  const overrides = (overrideRows ?? []) as { loadout_id: string; created_at: string; by_name: string | null }[];
  // Which truck each recent load-out was, so a yard's week counts only its own overrides.
  const unitOfScan = new Map(allScans.map((r) => [r.id, r.unit_id ?? ""]));
  const kits = new Map(((kitRows ?? []) as { unit_id: string; saas_package_lines: { label: string; qty: number; sort: number }[] | null }[])
    .map((k) => [k.unit_id, [...(k.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }))]));
  const inYard = <T extends { unit_id: string | null }>(r: T) => !yardId || (r.unit_id !== null && unitIds.has(r.unit_id));
  const nowMs = clock();
  // Each truck's newest check-in: iron marked still out at it isn't on the truck for its kit.
  const lastBack = new Map<string, string>();
  for (const r of allReturns) if (r.unit_id && (lastBack.get(r.unit_id) ?? "") < r.finished_at) lastBack.set(r.unit_id, r.finished_at);
  // Heads-up on a truck that's ready to load: its kit is short, or its next
  // job's plan needs iron the yard has no good one of.
  const kitShort = kitShortByTruck(kits, list.rows, lastBack);
  for (const [id, line] of planShortByTruck(openPlans, packages, kits, list.rows, rd.units, nowMs, lastBack)) {
    kitShort.set(id, kitShort.has(id) ? `${kitShort.get(id)} ${line}` : line);
  }
  // The quick check goes by what the crew checked, not by the iron's tests and
  // paper: a truck reads by its last check (READY, NOT READY, out), nothing else.
  const quick = rules.quickCheck;
  const { trucks, counts, summary } = buildLoadOutTrucks(
    quick ? units.map((u) => ({ ...u, state: "ready" as const, why: "" })) : units,
    quick ? [] : list.rows, allScans, new Map(overrides.map((o) => [o.loadout_id, { at: o.created_at, by: o.by_name }])), today, quick ? new Map() : kitShort,
    { returns: allReturns, now: nowMs, alertDays: rules.outAlertDays, hand: company.role === "member", zones, quick });

  // The iron, for the manager: what's out, what's out too long, what's out of test.
  const inYardScope = (r: { yardId?: string | null; unitId?: string | null }) => !yardId || r.yardId === yardId || (r.unitId !== null && r.unitId !== undefined && unitIds.has(r.unitId));
  const outAll = (outRows ?? []) as { id: string; unit_id: string | null; yard_id: string | null; out_since: string; out_with_name: string | null }[];
  const outList = outAll.filter((r) => inYardScope({ yardId: r.yard_id, unitId: r.unit_id }));
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
  // Anyone who did anything this week, in any yard: never called idle. (On
  // one yard's view, a hand who worked another yard, or signed a tool out,
  // just isn't listed there.)
  // Moving iron counts as using it too (left out of the tallies, not out of "active").
  const { data: moverRows } = await db.from("saas_events").select("actor").eq("company_id", company.id).eq("kind", "asset_moved")
    .gte("created_at", weekAgo).not("actor", "is", null).order("created_at", { ascending: false }).limit(1000);
  // A hand who loaded out a truck that's still out on a job is on location
  // with nothing to scan, not skipping the app (the morning email's rule):
  // whoever loaded each such truck's newest load-out counts as active.
  // (Iron left on location at the truck's last check-in doesn't keep it out, the same as the email.)
  const leftOnLocation = (r: { unit_id: string | null; out_since: string | null }) => {
    const back = r.unit_id ? lastBack.get(r.unit_id) : undefined;
    return Boolean(back && r.out_since && Date.parse(r.out_since) < Date.parse(back));
  };
  const outTrucks = new Set(outAll.filter((r) => r.unit_id && !r.out_with_name && !leftOnLocation(r)).map((r) => r.unit_id as string));
  const loadedOut = new Map<string, string>();
  for (const sc of allScans) if (sc.unit_id && sc.scanned_by && outTrucks.has(sc.unit_id) && !loadedOut.has(sc.unit_id)) loadedOut.set(sc.unit_id, sc.scanned_by);
  const activeAnywhere = new Set([
    ...((moverRows ?? []) as { actor: string }[]).map((e) => e.actor),
    ...((weekEvents ?? []) as { actor: string | null }[]).map((e) => e.actor),
    ...((weekScans ?? []) as { scanned_by: string | null }[]).map((s) => s.scanned_by),
    // Check-ins count even if the feed line didn't land.
    ...allReturns.filter((r) => Date.parse(r.finished_at) >= Date.parse(weekAgo)).map((r) => r.returned_by),
    ...loadedOut.values(),
  ].filter(Boolean) as string[]);
  for (const e of (weekEvents ?? []) as { kind: string; actor: string; unit_id: string | null }[]) {
    if (!e.actor || !inYard({ unit_id: e.unit_id })) continue;
    const p = people.get(e.actor) ?? { name: e.actor, loadouts: 0, returns: 0, overrides: 0, other: 0 };
    if (e.kind.startsWith("loadout_")) p.loadouts++;
    else if (e.kind === "returned") p.returns++;
    else if (e.kind === "rolled_override") p.overrides++;
    else p.other++;
    people.set(e.actor, p);
  }
  // How each one checks pieces: scanned off a tag, or by hand.
  for (const sc of (weekScans ?? []) as { pieces: { how?: string }[] | null; unit_id: string | null; scanned_by: string | null }[]) {
    if (!sc.scanned_by || !inYard(sc)) continue;
    const p = people.get(sc.scanned_by) ?? { name: sc.scanned_by, loadouts: 0, returns: 0, overrides: 0, other: 0 };
    p.pieces = (p.pieces ?? 0) + (sc.pieces ?? []).length;
    p.byHand = (p.byHand ?? 0) + (sc.pieces ?? []).filter((x) => x.how === "hand").length;
    people.set(sc.scanned_by, p);
  }
  // Everyone on the crew shows, so a manager sees who hasn't used it at all.
  const managerView = company.role === "owner" || company.role === "admin";
  if (managerView) {
    const admin = saasAdmin();
    const { data: memberRows } = await db.from("saas_memberships").select("user_id, role").eq("company_id", company.id).eq("status", "active");
    // Idle means a hand who hasn't used it. A manager who only reads the board isn't idle.
    const names = admin ? await Promise.all(((memberRows ?? []) as { user_id: string; role: string }[]).filter((m) => m.role === "member").slice(0, 60).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return (data?.user?.user_metadata?.full_name as string | undefined)?.trim() || data?.user?.email?.split("@")[0] || null;
    })) : [];
    for (const n of names) if (n && !people.has(n) && !activeAnywhere.has(n)) people.set(n, { name: n, loadouts: 0, returns: 0, overrides: 0, other: 0, idle: true });
  }
  const total = (p: PersonWeek) => p.loadouts + p.returns + p.overrides + p.other;
  // The 25 busiest, then everyone idle (a big crew must never hide who hasn't used it).
  const everyone = [...people.values()];
  const byPerson = [...everyone.filter((p) => !p.idle).sort((a, b) => total(b) - total(a)).slice(0, 25), ...everyone.filter((p) => p.idle)];

  // A hand's own truck goes first: the one they picked on this phone, or the
  // one they last loaded out.
  const hand = company.role === "member";
  const picked = hand ? (await cookies()).get(await myTruckCookie(company.id))?.value ?? null : null;
  const { data: mine } = hand && !picked
    ? await db.from("saas_loadout_scans").select("unit_id").eq("company_id", company.id).eq("scanned_by_user", user.id).order("finished_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const myTruckId = (picked && units.some((u) => u.id === picked) ? picked : null) ?? (mine as { unit_id: string | null } | null)?.unit_id ?? null;
  const week = weekNumbers(((weekScans ?? []) as { id: string; finished_at: string; pieces: { red?: boolean; asset_id?: string }[]; unit_id: string | null }[]).filter(inYard), overrides.filter((o) => Date.parse(o.created_at) >= Date.parse(weekAgo) && (!yardId || unitIds.has(unitOfScan.get(o.loadout_id) ?? ""))).length, overriddenIds);

  // Today's feed, each line on its truck's yard clock.
  const zoneOfEvent = (e: { unit_id: string | null }) => (e.unit_id ? zoneOfUnit.get(e.unit_id) : undefined) ?? homeZone;
  const activity: ActivityLine[] = ((eventRows ?? []) as { id: string; kind: string; actor: string | null; message: string; unit_id: string | null; created_at: string }[])
    .filter((e) => { const tz = zoneOfEvent(e); return dayIn(e.created_at, tz) === (tz === YARD_TZ ? today : dayIn(planNow, tz)) && inYard(e); })
    // The quick check's feed: trucks checked, trucks back, overrides, and setting tools. No iron or paper.
    .filter((e) => !quick || QUICK_FEED.has(e.kind))
    .slice(0, 15)
    .map((e) => ({
      id: e.id,
      time: `${new Date(e.created_at).toLocaleTimeString("en-US", { timeZone: zoneOfEvent(e), hour: "numeric", minute: "2-digit" })}${mixedZones ? ` ${zoneShort(zoneOfEvent(e))}` : ""}`,
      // The message usually names the person already ("... by Dale Wooten").
      actor: e.actor && !e.message.includes(e.actor) ? e.actor : null, message: e.message, tone: TONE[e.kind] ?? null,
    }));

  return (
    <>
      {!isWritable(company.subscription_status, company.comped) ? <div className="mb-6"><LockedCard owner={company.role === "owner"} /></div> : null}

      {company.role !== "member" && !company.is_demo && isWritable(company.subscription_status, company.comped) && (welcome === "1" || (quick ? ![...kits.values()].some((l) => l.length) : list.rows.length === 0)) ? (
        <div className="mb-6">
          <WelcomeCard justPaid={welcome === "1"} yards={yards.map((y) => y.name).filter(isBillableYard)}
            manager={company.role === "owner" || company.role === "admin"} quick={quick} />
        </div>
      ) : null}
      <LoadOutView trucks={trucks} counts={counts} summary={summary} week={week} yards={yards} yardId={yardId} activity={activity}
        plans={plans} manager={company.role === "owner" || company.role === "admin"}
        hand={hand} picking={pick === "1"} pickAction={pickMyTruck}
        tips={hand && (joined === "1" || !myTruckId) ? <HandTips name={(user.user_metadata?.full_name as string | undefined)?.trim() || "there"} company={company.name} /> : null}
        iron={quick ? undefined : iron} byPerson={byPerson} myTruckId={myTruckId} alertDays={rules.outAlertDays} companyId={company.id} quick={quick} />
      <WarmOffline companyId={company.id} urls={["/app/return", ...rd.units.flatMap((u) => [`/app/units/${u.id}/scan`, `/app/units/${u.id}/return`])]} />
    </>
  );
}
