import type { DashSnap, DashboardData } from "@/app/app/_components/dashboard-view";
import type { UnitTile } from "@/lib/saas/readiness";

/**
 * The marketing-photo dataset — a six-tile cut of the SAME cast as the
 * drive-it-yourself demo (lib/saas/demo-data.ts): Caprock Coil & Pressure
 * Control, Odessa. One yard, one cast, everywhere — the homepage hero, the
 * /shot camera stand, and the seeded demo a visitor drives can be
 * cross-referenced line by line and every name reconciles.
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
  { id: "u1", name: "CT-03", yardId: "y1", yardName: "Odessa Yard", state: "not_ready", why: "BOP pressure test (Quad BOP stack #3) — expired 6d ago", crewWorst: "valid" },
  { id: "u2", name: "P-02", yardId: "y1", yardName: "Odessa Yard", state: "not_ready", why: "Annual DOT inspection — expired 23d ago", crewWorst: "valid" },
  { id: "u3", name: "CT-01", yardId: "y1", yardName: "Odessa Yard", state: "due_soon", why: "Lubricator pressure test expires in 9d", crewWorst: "valid" },
  { id: "u4", name: "CT-02", yardId: "y1", yardName: "Odessa Yard", state: "ready", why: "All paper current", crewWorst: "valid" },
  { id: "u5", name: "CR-01 Crane", yardId: "y1", yardName: "Odessa Yard", state: "ready", why: "All paper current", crewWorst: "valid" },
  { id: "u6", name: "P-03", yardId: "y1", yardName: "Odessa Yard", state: "ready", why: "All paper current", crewWorst: "valid" },
] as UnitTile[];

const snaps: DashSnap[] = [
  { day: day(13), readiness: 68, misses_caught: 0 },
  { day: day(12), readiness: 68, misses_caught: 0 },
  { day: day(11), readiness: 71, misses_caught: 0 },
  { day: day(10), readiness: 74, misses_caught: 0 },
  { day: day(9), readiness: 74, misses_caught: 0 },
  { day: day(8), readiness: 78, misses_caught: 0 },
  { day: day(7), readiness: 81, misses_caught: 0 },
  { day: day(6), readiness: 79, misses_caught: 0 },
  { day: day(5), readiness: 83, misses_caught: 0 },
  { day: day(4), readiness: 83, misses_caught: 0 },
  { day: day(3), readiness: 80, misses_caught: 1 },
  { day: day(2), readiness: 84, misses_caught: 1 },
  { day: day(1), readiness: 87, misses_caught: 0 },
  { day: day(0), readiness: 88, misses_caught: 0 },
];

export function demoDashboardProps(): DashboardData {
  return {
    first: "Caden",
    companyName: "Caprock Coil & Pressure Control",
    nptDay: 10000,
    yardCount: 1,
    yards: [{ id: "y1", name: "Odessa Yard" }],
    activeYard: null,
    boardUnits: units,
    notReadyUnits: 2,
    readiness: 88,
    expiring30: 6,
    missesCaught: 2,
    missThisWk: 2,
    missLastWk: 0,
    warningsMonth: 4,
    notReadyMonth: 3,
    checksRunMonth: 8,
    hasSample: false,
    events: [
      { kind: "check_not_ready", message: "CT-03 checked NOT READY — BOP pressure test (Quad BOP stack #3) expired", actor: "Dale Wooten", created_at: at(0, 5) },
      { kind: "alert_sent", message: "Warning emailed: HS-01 Hotshot registration expires in 6 days", actor: null, created_at: at(0, 6) },
      { kind: "check_ready", message: "CT-02 checked READY for the Mabee Ranch pad", actor: "Ray Hinojosa", created_at: at(0, 4) },
      { kind: "renewed", message: "BOP pressure test renewed on Quad BOP stack #7 — shot the new chart, good for 12 months", actor: "Freddy Carrasco", created_at: at(3, 9) },
      { kind: "check_ready", message: "P-03 re-checked READY for the Diamondback pad — rolled at 4pm", actor: "Dale Wooten", created_at: at(3, 15) },
      { kind: "asset_seen", message: "Lubricator #2 found in the pipe shop — back on T-1", actor: "Kevin Odom", created_at: at(3, 7) },
      { kind: "renewed", message: "Sling quarterly inspection renewed — set A tagged", actor: "Cody Blackburn", created_at: at(6, 10) },
    ],
    actionList: [
      { id: "i1", title: "BOP pressure test", kind: "test", expiration_date: day(6), status: "expired", parent_type: "asset", parent_id: "a1" },
      { id: "i2", title: "Annual DOT inspection", kind: "inspection", expiration_date: day(23), status: "expired", parent_type: "unit", parent_id: "u2" },
      { id: "i3", title: "H2S Clear — Marcus Villarreal", kind: "cert", expiration_date: day(1), status: "expired", parent_type: "crew", parent_id: "c1" },
      { id: "i4", title: "Registration — HS-01 Hotshot", kind: "registration", expiration_date: day(-6), status: "expiring", parent_type: "unit", parent_id: "u7" },
      { id: "i5", title: "Lubricator pressure test", kind: "test", expiration_date: day(-9), status: "expiring", parent_type: "asset", parent_id: "a2" },
    ],
    spark: { readiness: snaps.map((s) => s.readiness), misses: snaps.map((s) => s.misses_caught) },
    snaps,
  };
}
