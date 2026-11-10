import type { UnitTile } from "./readiness";
import { stateLabel, type EquipRow } from "./equipment";
import { YARD_TZ, yardZone, zoneShort } from "./format";
import { outcomeOf, reasonsOf, type LoadoutRecord } from "./loadout-record";
import { TESTED_CATEGORIES } from "./taxonomy";
import { expectedLines, fillLines, shortLines, type LinePiece } from "./loadout-lines";
import { planShortInYard } from "./dispatch-check";
import { planTiming, type LoadoutPlan } from "./plans";
import { truckOut, daysOut, DEFAULT_OUT_ALERT_DAYS } from "./whereabouts";

/**
 * The Load out board: every truck as Blocked (today's load-out came back NOT
 * READY, or the records already show something red), Ready to load, or Out
 * on a job (a load-out rolled, READY or on a manager's override, and nobody
 * has checked it back in). Out longer than the company's limit is flagged.
 * Pure, so the home page and the marketing screenshot build it the same way.
 */

export type LoadoutScanRow = Pick<LoadoutRecord, "id" | "unit_id" | "finished_at" | "scanned_by" | "verdict" | "reasons" | "pieces" | "not_scanned">;
export type TruckStatus = "blocked" | "ready" | "out";
export interface LoadOutTruckRow {
  t: UnitTile;
  pieces: number;
  status: TruckStatus;
  /** The red or amber line under the truck's name, if any. */
  why: string | null;
  whyTone: "red" | "amber" | null;
  /** Already worded, in the yard's time zone: "Loaded out READY 5:40 AM by Ray Hinojosa". */
  loadoutLine: string | null;
  doneToday: boolean;
  /** The load-out record behind the status (today's, or the one it's out on), for the link. */
  loadoutId: string | null;
  overridden: boolean;
  /** Out on a job: since when, and whether that's past the limit. */
  outSince: string | null;
  outTooLong: boolean;
  /** Back from the job, but some of its iron didn't come back: "Still out on the job: Reel R-5". */
  stillOut: string | null;
}
export interface LoadOutWeek { loadouts: number; caught: number; overrides: number }
export interface LoadOutCounts { ready: number; blocked: number; out: number; outTooLong: number }

/**
 * This week's numbers for the owner: load-outs scanned, bad pieces caught at
 * load-out, trucks rolled on override. A bad piece on a load-out a manager
 * rolled anyway went to location, so it wasn't caught; and the same bad piece
 * on a second try the same day is one catch, not two.
 */
export function weekNumbers(
  scans: { id?: string; finished_at?: string; pieces?: { red?: boolean; asset_id?: string }[] | null }[],
  overrides: number,
  overridden: Set<string> = new Set(),
): LoadOutWeek {
  const seen = new Set<string>();
  let caught = 0;
  for (const s of scans) {
    if (s.id && overridden.has(s.id)) continue;
    for (const p of s.pieces ?? []) {
      if (!p.red) continue;
      if (p.asset_id) {
        const key = `${s.finished_at ? dayOf(s.finished_at) : ""}|${p.asset_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
      }
      caught++;
    }
  }
  return { loadouts: scans.length, caught, overrides };
}

const ORDER: Record<TruckStatus, number> = { blocked: 0, ready: 1, out: 2 };
const dayIn = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
const dayOf = (iso: string) => dayIn(iso, YARD_TZ);
const timeIn = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
const shortDayIn = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" });

/**
 * What each truck's kit is short of, going by what's logged on it now. A
 * heads-up on the board: the load-out will block unless it comes from the
 * yard. "Kit short: Lubricator, 2in 1502 pup joint (1 of 2 on it)".
 * lastBack: each truck's newest check-in. Iron marked still out at it is
 * still on the last job, not on the truck, so the load-out won't count it
 * (scan/actions.ts) and neither does this.
 */
export function kitShortByTruck(kits: Map<string, { label: string; qty: number }[]>, rows: EquipRow[], lastBack: Map<string, string> = new Map()): Map<string, string> {
  const out = new Map<string, string>();
  for (const [unitId, kit] of kits) {
    if (!kit.length) continue;
    const back = lastBack.get(unitId);
    const onIt = rows.filter((r) => r.unitId === unitId && r.state !== "retired" && !(back && r.outSince && r.outSince < back))
      .map((r) => ({ id: r.id, name: r.name, serial: r.identifier }));
    const short = shortLines(fillLines(kit.map((l) => ({ ...l, source: "kit" as const })), onIt));
    if (short.length) out.set(unitId, `Kit short: ${short.map((l) => (l.filled.length ? `${l.label} (${l.filled.length} of ${l.qty} on it)` : l.label)).join(", ")}. The load-out will block without it.`);
  }
  return out;
}

/**
 * What each truck's open plan takes from the yard that the yard can't give,
 * in the Paper check's own words (planShortInYard), going by the iron on the
 * board: the truck's own iron fills the kit and the plan first, then good
 * iron sitting free in the truck's yard. One line per truck: the first short
 * line, and how many more. A plan more than a day past its leave time no
 * longer locks the load-out, so it's left out. lastBack: as kitShortByTruck.
 */
export function planShortByTruck(
  plans: Map<string, Pick<LoadoutPlan, "packageIds" | "lines" | "leavesAt">>,
  packages: Map<string, { name: string; lines: { label: string; qty: number }[] }>,
  kits: Map<string, { label: string; qty: number }[]>,
  rows: EquipRow[],
  units: { id: string; yardId: string }[],
  now: number,
  lastBack: Map<string, string> = new Map(),
): Map<string, string> {
  const out = new Map<string, string>();
  const yardOf = new Map(units.map((u) => [u.id, u.yardId]));
  const piece = (r: EquipRow): LinePiece => ({ id: r.id, name: r.name, serial: r.identifier });
  // "red-tagged", "missing", "needs redress", "no paper", "no test on file", "out of test".
  const badWord = (r: EquipRow) => { const w = stateLabel(r); return w === "Overdue" ? "out of test" : w.toLowerCase(); };
  for (const [unitId, p] of plans) {
    const yardId = yardOf.get(unitId);
    if (!yardId || planTiming(p, now) === "old") continue;
    const pkgs = p.packageIds.map((id) => packages.get(id)).filter((x): x is { name: string; lines: { label: string; qty: number }[] } => Boolean(x));
    if (!pkgs.length && !p.lines.length) continue;
    const lines = expectedLines({ kit: kits.get(unitId) ?? [], packages: pkgs, planned: p.lines, quick: [] });
    const back = lastBack.get(unitId);
    const truck = rows.filter((r) => r.unitId === unitId && r.state !== "retired" && !(back && r.outSince && r.outSince < back)).map(piece);
    // Free in the yard: on no truck, not out on a job, not signed out to anyone.
    const yard = rows.filter((r) => !r.unitId && r.yardId === yardId && r.state !== "retired" && !r.outSince && !r.outWith)
      .map((r) => ({ ...piece(r), bad: r.state === "down" || r.state === "overdue" ? badWord(r) : null }));
    const short = planShortInYard({ lines, truck, yard });
    if (short.length) out.set(unitId, `Next job: ${short[0]}${short.length > 1 ? ` ${short.length - 1} more short too.` : ""}`);
  }
  return out;
}

export function buildLoadOutTrucks(
  units: UnitTile[],
  rows: EquipRow[],
  scans: LoadoutScanRow[],
  /** Load-outs a manager rolled anyway: a set of ids, or ids to when the override was made
   *  (the trip starts then, not when the NOT READY load-out was saved) and who made it. */
  overridden: Set<string> | Map<string, string | { at: string; by?: string | null }>,
  /** Today in Central (localToday()). A truck in another zone goes by its own day. */
  todayCentral: string,
  kitShort: Map<string, string> = new Map(),
  /** hand: the board is a hand's (crew on the job see it too), so out too long
   *  says how long without telling them to check it in.
   *  zones: each yard's time zone (yardZones() in loadout-record.ts). A Hobbs
   *  (Mountain) truck's times then read in Mountain, not an hour off. When the
   *  trucks on the board run on more than one zone, each time says which. */
  opts: { returns?: { unit_id: string | null; finished_at: string; returned_by?: string | null }[]; now?: number; alertDays?: number; hand?: boolean; zones?: Map<string, string>;
    /** The quick check: "checked", not "load-out". */
    quick?: boolean } = {},
): { trucks: LoadOutTruckRow[]; counts: LoadOutCounts; summary: string } {
  const now = opts.now ?? Date.now();
  const zoneOf = (t: UnitTile) => (opts.zones ? yardZone(opts.zones.get(t.yardId)) : YARD_TZ);
  const mixedZones = new Set(units.map(zoneOf)).size > 1;
  const alertDays = opts.alertDays ?? DEFAULT_OUT_ALERT_DAYS;
  const ov = (id: string) => (overridden.has(id) ? { loadout_id: id, by_name: "", reason: "", created_at: "" } : null);
  const last = new Map<string, LoadoutScanRow>();
  for (const r of [...scans].sort((a, b) => b.finished_at.localeCompare(a.finished_at))) {
    if (r.unit_id && !last.has(r.unit_id)) last.set(r.unit_id, r);
  }
  const ovOf = (id: string) => {
    const v = overridden instanceof Map ? overridden.get(id) : undefined;
    return typeof v === "string" ? { at: v, by: null } : v;
  };
  const ovAt = (id: string) => ovOf(id)?.at;
  const out = truckOut(scans.map((r) => {
    const outcome = outcomeOf(r, ov(r.id));
    return { id: r.id, unit_id: r.unit_id, finished_at: r.finished_at, rolled: outcome !== "blocked", since: outcome === "override" ? ovAt(r.id) : undefined };
  }), opts.returns ?? []);
  const pieces = new Map<string, number>();
  const outNames = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.unitId || r.state === "retired") continue;
    pieces.set(r.unitId, (pieces.get(r.unitId) ?? 0) + 1);
    if (r.outSince) outNames.set(r.unitId, [...(outNames.get(r.unitId) ?? []), r.name]);
  }
  // Iron on a truck the load-out will block that the truck's paper doesn't
  // show: a tool waiting on redress, or pressure iron with no test on file.
  const pieceWarn = new Map<string, string>();
  const label = (r: EquipRow) => `${r.name}${r.identifier ? ` ${r.identifier}` : ""}`;
  for (const r of rows) {
    if (!r.unitId || r.state === "retired" || r.outSince || pieceWarn.has(r.unitId)) continue;
    if (r.needsRedress) pieceWarn.set(r.unitId, `Needs redress before it goes: ${label(r)}. The load-out will block it.`);
    else if (r.itemCount === 0 && TESTED_CATEGORIES.has(r.category)) pieceWarn.set(r.unitId, `No test on file: ${label(r)}. The load-out will block it.`);
  }
  const lastBack = new Map<string, { finished_at: string; returned_by?: string | null }>();
  for (const r of [...(opts.returns ?? [])].sort((a, b) => b.finished_at.localeCompare(a.finished_at))) {
    if (r.unit_id && !lastBack.has(r.unit_id)) lastBack.set(r.unit_id, r);
  }

  const trucks = units.map((t): LoadOutTruckRow => {
    // This truck's yard clock: its day, its times, and the zone when the board mixes zones.
    const tz = zoneOf(t);
    const today = tz === YARD_TZ ? todayCentral : dayIn(new Date(now).toISOString(), tz);
    const dayOf = (iso: string) => dayIn(iso, tz);
    const timeOf = (iso: string) => `${timeIn(iso, tz)}${mixedZones ? ` ${zoneShort(tz)}` : ""}`;
    const shortDay = (iso: string) => shortDayIn(iso, tz);
    const s = last.get(t.id);
    const doneToday = Boolean(s && dayOf(s.finished_at) === today);
    const by = s?.scanned_by ? ` by ${s.scanned_by}` : "";
    const base = { t, pieces: pieces.get(t.id) ?? 0, doneToday, loadoutId: doneToday && s ? s.id : null, outSince: null, outTooLong: false, stillOut: null };
    const trip = out.get(t.id);
    if (trip && s && s.id === trip.loadoutId) {
      const days = daysOut(trip.since, now);
      const tooLong = days >= alertDays;
      const overrode = outcomeOf(s, ov(s.id)) === "override";
      const when = dayOf(trip.since) === today ? `today ${timeOf(trip.since)}` : `${shortDay(trip.since)} (${days === 0 ? "less than a day" : `${days} ${days === 1 ? "day" : "days"}`})`;
      // Out on a job doesn't hide what's on it: iron that went bad since it
      // rolled, or went on after it rolled, reads red here like on its page.
      const badNow = t.state === "not_ready";
      const ovBy = overrode ? ovOf(s.id)?.by?.trim() : null;
      return { ...base, loadoutId: s.id, status: "out", overridden: overrode, outSince: trip.since, outTooLong: tooLong,
        why: tooLong ? (opts.hand ? `Out ${days} days.` : `Out ${days} days. Check it in, or find out where it is.`) : badNow ? `Out on a job and NOT READY now: ${t.why}` : null,
        whyTone: tooLong || badNow ? "red" : null,
        loadoutLine: ovBy
          ? `Out on ${ovBy}'s override since ${when}${s.scanned_by ? `. Loaded by ${s.scanned_by}` : ""}`
          : `${overrode ? "Out on a manager's override" : "Out on a job"} since ${when}${by}` };
    }
    // Checked back in since its last load-out: say so, and name anything that didn't come back.
    const back = lastBack.get(t.id);
    const isBack = Boolean(back && (!s || back.finished_at > s.finished_at));
    // Its newest load-out was NOT READY and nobody rolled it: blocked until a
    // newer load-out (or a check-in), even when it was loaded last night.
    if (s && !isBack) {
      const outcome = outcomeOf(s, ov(s.id));
      if (outcome === "blocked") {
        const reasons = reasonsOf(s);
        const when = dayOf(s.finished_at) === today ? timeOf(s.finished_at) : `${shortDay(s.finished_at)} ${timeOf(s.finished_at)}`;
        // Blocked only on the truck's own paper, and that paper is good now:
        // say so, not the old date. It still takes a new load-out to roll.
        const paperFixed = reasons.length > 0 && reasons.every((x) => x.startsWith("Truck paper:")) && t.state !== "not_ready";
        return { ...base, loadoutId: s.id, status: "blocked", overridden: false, whyTone: paperFixed ? "amber" : "red",
          why: paperFixed ? `Blocked ${dayOf(s.finished_at) === today ? "today" : shortDay(s.finished_at)} on truck paper. That paper is good now. Scan it again to roll.`
            : reasons.length ? `${reasons[0]}${reasons.length > 1 ? ` (and ${reasons.length - 1} more)` : ""}` : "NOT READY at load-out",
          loadoutLine: `${opts.quick ? "NOT READY at its check" : "Blocked at load-out"} ${when}${by}` };
      }
    }
    const backBy = back?.returned_by ? ` by ${back.returned_by}` : "";
    const loadoutLine = isBack && back
      ? `${opts.quick ? "Back in the yard" : "Checked in"} ${dayOf(back.finished_at) === today ? `today ${timeOf(back.finished_at)}` : shortDay(back.finished_at)}${backBy}`
      : s ? `${opts.quick ? "Last checked" : "Last load-out"} ${shortDay(s.finished_at)}${by}` : null;
    const left = isBack ? outNames.get(t.id) ?? [] : [];
    const stillOut = left.length ? `Still out on the job: ${left.slice(0, 3).join(", ")}${left.length > 3 ? ` and ${left.length - 3} more` : ""}` : null;
    // A truck that's back starts fresh: its next scan is a new load-out, not "scan again".
    const rest = { ...base, ...(isBack ? { doneToday: false, loadoutId: null } : {}), loadoutLine, stillOut };
    if (t.state === "not_ready") return { ...rest, status: "blocked", overridden: false, why: t.why, whyTone: "red" };
    const short = kitShort.get(t.id);
    const why = short ?? pieceWarn.get(t.id) ?? (t.state === "due_soon" ? t.why : null);
    return { ...rest, status: "ready", overridden: false, why, whyTone: why ? "amber" : null };
  }).sort((a, b) => ORDER[a.status] - ORDER[b.status] || Number(b.outTooLong) - Number(a.outTooLong) || a.t.name.localeCompare(b.t.name));

  const counts: LoadOutCounts = {
    ready: trucks.filter((x) => x.status === "ready").length,
    blocked: trucks.filter((x) => x.status === "blocked").length,
    out: trucks.filter((x) => x.status === "out").length,
    outTooLong: trucks.filter((x) => x.outTooLong).length,
  };
  const summary = trucks.length
    ? `${trucks.length} ${trucks.length === 1 ? "truck" : "trucks"}. ${counts.out} out on jobs${counts.outTooLong ? ` (${counts.outTooLong} out too long)` : ""}. ${counts.blocked ? `${counts.blocked} blocked.` : "Nothing blocked."}`
    : "Pick a truck and scan every piece as it goes on.";
  return { trucks, counts, summary };
}
