import type { UnitTile } from "./readiness";
import type { EquipRow } from "./equipment";
import type { UnitState } from "./status";
import { YARD_TZ } from "./format";

/**
 * The Load out board's rows from trucks, iron, and load-out scans. Pure, so
 * the home page and the marketing screenshot build it the same way.
 */

export interface LoadoutScanRow { unit_id: string | null; finished_at: string; scanned_by: string | null; scanned: number; expected: number }
export interface LoadOutTruckRow { t: UnitTile; pieces: number; loadoutLine: string | null; doneToday: boolean }

const ORDER: Record<UnitState, number> = { not_ready: 0, due_soon: 1, not_setup: 2, ready: 3 };
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: YARD_TZ });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: YARD_TZ, hour: "numeric", minute: "2-digit" });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

export function buildLoadOutTrucks(units: UnitTile[], rows: EquipRow[], scans: LoadoutScanRow[], today: string): { trucks: LoadOutTruckRow[]; summary: string } {
  const last = new Map<string, LoadoutScanRow>();
  for (const r of [...scans].sort((a, b) => b.finished_at.localeCompare(a.finished_at))) {
    if (r.unit_id && !last.has(r.unit_id)) last.set(r.unit_id, r);
  }
  const pieces = new Map<string, number>();
  for (const r of rows) if (r.unitId && r.state !== "retired") pieces.set(r.unitId, (pieces.get(r.unitId) ?? 0) + 1);

  const trucks = units.map((t) => {
    const s = last.get(t.id);
    const doneToday = Boolean(s && dayOf(s.finished_at) === today);
    const loadoutLine = s
      ? `${doneToday ? `Loaded out today ${timeOf(s.finished_at)}` : `Last load-out ${shortDay(s.finished_at)}`}${s.scanned_by ? ` by ${s.scanned_by}` : ""}, ${s.scanned} of ${s.expected} scanned`
      : null;
    return { t, pieces: pieces.get(t.id) ?? 0, loadoutLine, doneToday };
  }).sort((a, b) => ORDER[a.t.state] - ORDER[b.t.state] || Number(a.doneToday) - Number(b.doneToday) || a.t.name.localeCompare(b.t.name));

  const notReady = trucks.filter((x) => x.t.state === "not_ready").length;
  const done = trucks.filter((x) => x.doneToday).length;
  const summary = trucks.length
    ? `${trucks.length} ${trucks.length === 1 ? "truck" : "trucks"}. ${done} loaded out today. ${notReady ? `${notReady} not ready.` : "None held up."}`
    : "Pick a truck and scan every piece as it goes on.";
  return { trucks, summary };
}
