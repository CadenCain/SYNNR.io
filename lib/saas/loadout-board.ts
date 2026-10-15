import type { UnitTile } from "./readiness";
import type { EquipRow } from "./equipment";
import { YARD_TZ } from "./format";
import { outcomeOf, reasonsOf, type LoadoutRecord } from "./loadout-record";
import { fillLines, shortLines } from "./loadout-lines";

/**
 * The Load out board: every truck as Ready (nothing red, not loaded out yet
 * today), Blocked (today's load-out came back NOT READY, or the records
 * already show something red), or Loaded out (today's load-out came back
 * READY, or a manager rolled it on an override). Pure, so the home page and
 * the marketing screenshot build it the same way.
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
  /** Today's load-out record, for the link. */
  loadoutId: string | null;
  overridden: boolean;
}
export interface LoadOutWeek { loadouts: number; caught: number; overrides: number }
export interface LoadOutCounts { ready: number; blocked: number; out: number }

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
): { trucks: LoadOutTruckRow[]; counts: LoadOutCounts; summary: string } {
  const last = new Map<string, LoadoutScanRow>();
  for (const r of [...scans].sort((a, b) => b.finished_at.localeCompare(a.finished_at))) {
    if (r.unit_id && !last.has(r.unit_id)) last.set(r.unit_id, r);
  }
  const pieces = new Map<string, number>();
  for (const r of rows) if (r.unitId && r.state !== "retired") pieces.set(r.unitId, (pieces.get(r.unitId) ?? 0) + 1);

  const trucks = units.map((t): LoadOutTruckRow => {
    const s = last.get(t.id);
    const doneToday = Boolean(s && dayOf(s.finished_at) === today);
    const by = s?.scanned_by ? ` by ${s.scanned_by}` : "";
    const base = { t, pieces: pieces.get(t.id) ?? 0, doneToday, loadoutId: doneToday && s ? s.id : null };
    if (s && doneToday) {
      const outcome = outcomeOf(s, overridden.has(s.id) ? { loadout_id: s.id, by_name: "", reason: "", created_at: "" } : null);
      if (outcome === "blocked") {
        const reasons = reasonsOf(s);
        return { ...base, status: "blocked", overridden: false, whyTone: "red",
          why: reasons.length ? `${reasons[0]}${reasons.length > 1 ? ` (and ${reasons.length - 1} more)` : ""}` : "NOT READY at load-out",
          loadoutLine: `Blocked at load-out ${timeOf(s.finished_at)}${by}` };
      }
      return { ...base, status: "out", overridden: outcome === "override", why: null, whyTone: null,
        loadoutLine: outcome === "override" ? `Rolled on a manager's override ${timeOf(s.finished_at)}${by}` : `Loaded out READY ${timeOf(s.finished_at)}${by}` };
    }
    const loadoutLine = s ? `Last load-out ${shortDay(s.finished_at)}${by}` : null;
    if (t.state === "not_ready") return { ...base, status: "blocked", overridden: false, why: t.why, whyTone: "red", loadoutLine };
    const short = kitShort.get(t.id);
    const why = short ?? (t.state === "due_soon" ? t.why : null);
    return { ...base, status: "ready", overridden: false, why, whyTone: why ? "amber" : null, loadoutLine };
  }).sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.t.name.localeCompare(b.t.name));

  const counts: LoadOutCounts = {
    ready: trucks.filter((x) => x.status === "ready").length,
    blocked: trucks.filter((x) => x.status === "blocked").length,
    out: trucks.filter((x) => x.status === "out").length,
  };
  const summary = trucks.length
    ? `${trucks.length} ${trucks.length === 1 ? "truck" : "trucks"}. ${counts.out} loaded out today. ${counts.blocked ? `${counts.blocked} blocked.` : "Nothing blocked."}`
    : "Pick a truck and scan every piece as it goes on.";
  return { trucks, counts, summary };
}
