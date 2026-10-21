import type { UnitTile } from "./readiness";
import type { EquipRow } from "./equipment";
import { YARD_TZ } from "./format";
import { outcomeOf, reasonsOf, type LoadoutRecord } from "./loadout-record";
import { fillLines, shortLines } from "./loadout-lines";
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

/** This week's numbers for the owner: load-outs scanned, bad pieces caught at load-out, trucks rolled on override. */
export function weekNumbers(scans: { pieces?: { red?: boolean }[] | null }[], overrides: number): LoadOutWeek {
  return {
    loadouts: scans.length,
    caught: scans.reduce((n, s) => n + (s.pieces ?? []).filter((p) => p.red).length, 0),
    overrides,
  };
}

const ORDER: Record<TruckStatus, number> = { blocked: 0, ready: 1, out: 2 };
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: YARD_TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: YARD_TZ, hour: "numeric", minute: "2-digit" });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

/**
 * What each truck's kit is short of, going by what's logged on it now. A
 * heads-up on the board: the load-out will block unless it comes from the
 * yard. "Kit short: Lubricator, 2in 1502 pup joint (1 of 2 on it)".
 */
export function kitShortByTruck(kits: Map<string, { label: string; qty: number }[]>, rows: EquipRow[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const [unitId, kit] of kits) {
    if (!kit.length) continue;
    const onIt = rows.filter((r) => r.unitId === unitId && r.state !== "retired").map((r) => ({ id: r.id, name: r.name, serial: r.identifier }));
    const short = shortLines(fillLines(kit.map((l) => ({ ...l, source: "kit" as const })), onIt));
    if (short.length) out.set(unitId, `Kit short: ${short.map((l) => (l.filled.length ? `${l.label} (${l.filled.length} of ${l.qty} on it)` : l.label)).join(", ")}. The load-out will block without it.`);
  }
  return out;
}

export function buildLoadOutTrucks(
  units: UnitTile[],
  rows: EquipRow[],
  scans: LoadoutScanRow[],
  overridden: Set<string>,
  today: string,
  kitShort: Map<string, string> = new Map(),
  opts: { returns?: { unit_id: string | null; finished_at: string; returned_by?: string | null }[]; now?: number; alertDays?: number } = {},
): { trucks: LoadOutTruckRow[]; counts: LoadOutCounts; summary: string } {
  const now = opts.now ?? Date.now();
  const alertDays = opts.alertDays ?? DEFAULT_OUT_ALERT_DAYS;
  const ov = (id: string) => (overridden.has(id) ? { loadout_id: id, by_name: "", reason: "", created_at: "" } : null);
  const last = new Map<string, LoadoutScanRow>();
  for (const r of [...scans].sort((a, b) => b.finished_at.localeCompare(a.finished_at))) {
    if (r.unit_id && !last.has(r.unit_id)) last.set(r.unit_id, r);
  }
  const out = truckOut(scans.map((r) => ({ id: r.id, unit_id: r.unit_id, finished_at: r.finished_at, rolled: outcomeOf(r, ov(r.id)) !== "blocked" })), opts.returns ?? []);
  const pieces = new Map<string, number>();
  const outNames = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.unitId || r.state === "retired") continue;
    pieces.set(r.unitId, (pieces.get(r.unitId) ?? 0) + 1);
    if (r.outSince) outNames.set(r.unitId, [...(outNames.get(r.unitId) ?? []), r.name]);
  }
  const lastBack = new Map<string, { finished_at: string; returned_by?: string | null }>();
  for (const r of [...(opts.returns ?? [])].sort((a, b) => b.finished_at.localeCompare(a.finished_at))) {
    if (r.unit_id && !lastBack.has(r.unit_id)) lastBack.set(r.unit_id, r);
  }

  const trucks = units.map((t): LoadOutTruckRow => {
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
      return { ...base, loadoutId: s.id, status: "out", overridden: overrode, outSince: trip.since, outTooLong: tooLong,
        why: tooLong ? `Out ${days} days. Check it in, or find out where it is.` : null, whyTone: tooLong ? "red" : null,
        loadoutLine: `${overrode ? "Out on a manager's override" : "Out on a job"} since ${when}${by}` };
    }
    if (s && doneToday) {
      const outcome = outcomeOf(s, ov(s.id));
      if (outcome === "blocked") {
        const reasons = reasonsOf(s);
        return { ...base, status: "blocked", overridden: false, whyTone: "red",
          why: reasons.length ? `${reasons[0]}${reasons.length > 1 ? ` (and ${reasons.length - 1} more)` : ""}` : "NOT READY at load-out",
          loadoutLine: `Blocked at load-out ${timeOf(s.finished_at)}${by}` };
      }
    }
    // Checked back in since its last load-out: say so, and name anything that didn't come back.
    const back = lastBack.get(t.id);
    const isBack = Boolean(back && (!s || back.finished_at > s.finished_at));
    const backBy = back?.returned_by ? ` by ${back.returned_by}` : "";
    const loadoutLine = isBack && back
      ? `Checked in ${dayOf(back.finished_at) === today ? `today ${timeOf(back.finished_at)}` : shortDay(back.finished_at)}${backBy}`
      : s ? `Last load-out ${shortDay(s.finished_at)}${by}` : null;
    const left = isBack ? outNames.get(t.id) ?? [] : [];
    const stillOut = left.length ? `Still out on the job: ${left.slice(0, 3).join(", ")}${left.length > 3 ? ` and ${left.length - 3} more` : ""}` : null;
    // A truck that's back starts fresh: its next scan is a new load-out, not "scan again".
    const rest = { ...base, ...(isBack ? { doneToday: false, loadoutId: null } : {}), loadoutLine, stillOut };
    if (t.state === "not_ready") return { ...rest, status: "blocked", overridden: false, why: t.why, whyTone: "red" };
    const short = kitShort.get(t.id);
    const why = short ?? (t.state === "due_soon" ? t.why : null);
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
