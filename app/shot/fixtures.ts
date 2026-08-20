import type { DashSnap, DashboardData } from "@/app/app/_components/dashboard-view";
import type { UnitTile } from "@/lib/saas/readiness";

/**
 * The demo dataset — one fictional two-yard shop, shared by the screenshot
 * harness (/shot) and the public demo tour (/demo) so the marketing pictures,
 * the live demo, and the shipping component can never tell three different
 * stories. Same rule as the in-app sample yard: representative data, real UI,
 * nothing the product can't do.
 */

export const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const at = (n: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n); d.setHours(h, 24, 0, 0);
  return d.toISOString();
};

const units: UnitTile[] = [
  { id: "u1", name: "Rig 4", yardId: "y1", yardName: "Odessa yard", state: "not_ready", why: "BOP #3 flagged missing · annual DOT expired", crewWorst: "expired" },
  { id: "u2", name: "Truck 12", yardId: "y1", yardName: "Odessa yard", state: "due_soon", why: "DOT sticker expires in 12 days", crewWorst: "valid" },
  { id: "u3", name: "Pump 7", yardId: "y2", yardName: "Andrews yard", state: "ready", why: "All paper current", crewWorst: "valid" },
  { id: "u4", name: "Hot Oil 2", yardId: "y2", yardName: "Andrews yard", state: "ready", why: "All paper current", crewWorst: "valid" },
  { id: "u5", name: "Wireline 9", yardId: "y1", yardName: "Odessa yard", state: "ready", why: "All paper current", crewWorst: "expiring" },
  { id: "u6", name: "Vac 3", yardId: "y2", yardName: "Andrews yard", state: "due_soon", why: "Tank inspection due in 21 days", crewWorst: "valid" },
] as UnitTile[];

const snaps: DashSnap[] = [
  { day: day(13), readiness: 71, misses_caught: 0 },
  { day: day(12), readiness: 71, misses_caught: 0 },
  { day: day(11), readiness: 74, misses_caught: 1 },
  { day: day(10), readiness: 78, misses_caught: 0 },
  { day: day(9), readiness: 78, misses_caught: 0 },
  { day: day(8), readiness: 83, misses_caught: 0 },
  { day: day(7), readiness: 83, misses_caught: 1 },
  { day: day(6), readiness: 79, misses_caught: 0 },
  { day: day(5), readiness: 86, misses_caught: 0 },
  { day: day(4), readiness: 88, misses_caught: 0 },
  { day: day(3), readiness: 91, misses_caught: 1 },
  { day: day(2), readiness: 91, misses_caught: 0 },
  { day: day(1), readiness: 89, misses_caught: 0 },
  { day: day(0), readiness: 92, misses_caught: 0 },
];

export function demoDashboardProps(): DashboardData {
  return {
    first: "Cade",
    companyName: "WILDCAT Well Service",
    nptDay: 10000,
    yardCount: 2,
    yards: [{ id: "y1", name: "Odessa yard" }, { id: "y2", name: "Andrews yard" }],
    activeYard: null,
    boardUnits: units,
    notReadyUnits: 1,
    readiness: 74,
    expiring30: 3,
    missesCaught: 3,
    missThisWk: 1,
    missLastWk: 2,
    warningsMonth: 9,
    notReadyMonth: 2,
    checksRunMonth: 41,
    hasSample: false,
    events: [
      { kind: "check_not_ready", message: "Rig 4 checked NOT READY — BOP #3 missing, annual DOT expired", actor: "Logan", created_at: at(0, 5) },
      { kind: "alert_sent", message: "Warning emailed: Truck 12 DOT sticker expires in 12 days", actor: null, created_at: at(0, 6) },
      { kind: "renewed", message: "H2S Clear renewed for Jerry Boles — good through next Aug", actor: "Jerry", created_at: at(1, 15) },
      { kind: "asset_seen", message: "PH6 crossover last seen: Andrews yard, on 12 — per Logan", actor: "Logan", created_at: at(1, 11) },
      { kind: "check_ready", message: "Pump 7 checked READY for Friday's job", actor: "Cade", created_at: at(2, 7) },
      { kind: "renewed", message: "Tank inspection renewed on Vac 3", actor: "Dale", created_at: at(3, 13) },
      { kind: "alert_sent", message: "Warning emailed: wireline operator card expires in 30 days", actor: null, created_at: at(4, 6) },
    ],
    actionList: [
      { id: "i1", title: "Annual DOT inspection", kind: "inspection", expiration_date: day(18), status: "expired", parent_type: "unit", parent_id: "u1" },
      { id: "i2", title: "BOP test", kind: "test", expiration_date: null, status: "none", parent_type: "asset", parent_id: "a1" },
      { id: "i3", title: "DOT sticker", kind: "dot_sticker", expiration_date: day(-12), status: "expiring", parent_type: "unit", parent_id: "u2" },
      { id: "i4", title: "H2S Clear — M. Torres", kind: "cert", expiration_date: day(-19), status: "expiring", parent_type: "crew", parent_id: "c1" },
      { id: "i5", title: "Tank inspection", kind: "inspection", expiration_date: day(-21), status: "expiring", parent_type: "unit", parent_id: "u6" },
    ],
    spark: { readiness: snaps.map((s) => s.readiness), misses: snaps.map((s) => s.misses_caught) },
    snaps,
  };
}
