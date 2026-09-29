/**
 * The demo yard, declared pure: "Caprock Coil & Pressure Control", a
 * fictional Odessa coil tubing outfit every /demo visitor gets a private
 * copy of. Equipment only. All dates are DAY OFFSETS from seed time
 * (positive = future), so the yard is forever mid-week, never stale.
 *
 * The equipment list is deliberately not all green:
 *   2 overdue   · Quad BOP stack #3 on CT-03 (6 days) and a swivel in the
 *                 yard waiting on recert (12 days)
 *   2 down      · plug valve PV-2231 red-tagged on CT-06 (failed UT), and
 *                 PV-3019 missing since a rig-down
 *   4 due soon  · Lubricator #1, PV-2205, PV-2250, a pup joint
 *   2 no paper  · two baskets nobody has tested (they don't need it, but
 *                 the list says so out loud)
 *   1 retired   · PV-1977, scrapped after UT
 * Trucks: 10 ready · 3 not ready (CT-03, CT-06, P-02's lapsed DOT) · 3 due soon.
 */

export const DEMO_COMPANY_NAME = "Caprock Coil & Pressure Control";
export const DEMO_YARD_NAME = "Odessa Yard";

export interface DemoItem { title: string; kind: string; exp: number | null; issued?: number }
export interface DemoAsset {
  name: string; category: string; identifier?: string; status?: string; items?: DemoItem[];
  /** Where-it-is note ("rack 2"). */
  note?: string;
}
export interface DemoUnit {
  key: string; name: string; type: string; identifier?: string;
  expect: "ready" | "not_ready" | "due_soon";
  items?: DemoItem[]; assets?: DemoAsset[];
}
export interface DemoEvent { kind: string; message: string; actor: string | null; daysAgo: number; hour: number; minute: number }
export interface DemoCheck { unitKey: string; status: "ready" | "not_ready"; by: string; daysAgo: number; hour: number; minute: number }
/** One move in a piece's history. `from`/`to` are unit keys, or "yard". */
export interface DemoMove { serial: string; from: string; to: string; note?: string; by: string; daysAgo: number; hour: number }

const annual = (title: string, kind: string, exp: number, issued?: number): DemoItem =>
  ({ title, kind, exp, issued: issued ?? exp - 365 });
const RECERT = "Iron recert (UT + hydro)";

const bop = (n: number, exp: number): DemoAsset => ({
  name: `Quad BOP stack #${n}`, category: "pressure_control", identifier: `QB-${4468 + n}`,
  items: [annual("BOP pressure test", "test", exp)],
});
const injector = (n: number, exp: number): DemoAsset => ({
  name: `Injector head #${n}`, category: "equipment", identifier: `IH-${700 + n}`,
  items: [annual("Injector service & inspection", "inspection", exp)],
});
const reel = (n: number, size: string, len: string, exp: number): DemoAsset => ({
  name: `Reel R-${n}, ${size}, ${len}`, category: "equipment", identifier: `R-${n}`,
  items: [{ title: "Coil string fatigue inspection", kind: "inspection", exp, issued: exp - 180 }],
});
const lube = (n: number, exp: number): DemoAsset => ({
  name: `Lubricator #${n}`, category: "pressure_control", identifier: `LB-${810 + n}`,
  items: [annual("Lubricator pressure test", "test", exp)],
});
const valve = (serial: string, exp: number, opts: { size?: string; status?: string; issued?: number; note?: string } = {}): DemoAsset => ({
  name: `${opts.size ?? "2in"} 1502 plug valve`, category: "flow_iron", identifier: serial, status: opts.status, note: opts.note,
  items: [annual(RECERT, "test", exp, opts.issued)],
});
const swivel = (serial: string, exp: number, opts: { issued?: number; note?: string } = {}): DemoAsset => ({
  name: "2in 1502 Chiksan swivel", category: "flow_iron", identifier: serial, note: opts.note,
  items: [annual(RECERT, "test", exp, opts.issued)],
});

export const DEMO_UNITS: DemoUnit[] = [
  // ── NOT READY (3), each with its named reason ──
  { key: "ct3", name: "CT-03", type: "coil_tubing_unit", identifier: "1403", expect: "not_ready",
    items: [annual("Annual DOT inspection", "inspection", 140)],
    assets: [bop(3, -6) /* ← the red: BOP pressure test expired 6 days ago */, injector(3, 200), reel(3, "2-3/8in", "15,800 ft", 90),
      valve("PV-2203", 150), swivel("SW-1103", 170)] },
  { key: "p2", name: "P-02", type: "pump_truck", identifier: "2302", expect: "not_ready",
    items: [annual("Annual DOT inspection", "inspection", -23 /* ← the red: DOT lapsed */)],
    assets: [{ name: "Fluid end, P-02", category: "tool", identifier: "FE-202", items: [annual("Fluid end inspection", "inspection", 160)] },
      valve("PV-2212", 200)] },
  { key: "ct6", name: "CT-06", type: "coil_tubing_unit", identifier: "1406", expect: "not_ready",
    items: [annual("Annual DOT inspection", "inspection", 200)],
    assets: [bop(6, 240), injector(6, 150), reel(6, "2in", "18,200 ft", 120),
      valve("PV-2231", 60, { status: "out_of_service", note: "tagged on the truck, waiting on a replacement" }) /* ← the red: failed UT */,
      swivel("SW-1106", 190)] },

  // ── DUE SOON (3), inside the 30-day window ──
  { key: "ct1", name: "CT-01", type: "coil_tubing_unit", identifier: "1401", expect: "due_soon",
    items: [annual("Annual DOT inspection", "inspection", 180)],
    assets: [bop(1, 210), lube(1, 9 /* due in 9d */), reel(1, "2-3/8in", "16,400 ft", 75), valve("PV-2201", 120), swivel("SW-1101", 140)] },
  { key: "n2a", name: "N2-01", type: "nitrogen_unit", identifier: "3101", expect: "due_soon",
    items: [annual("DOT sticker", "dot_sticker", 12)],
    assets: [{ name: "N2 pump & vaporizer", category: "equipment", identifier: "N2P-31", items: [annual("Pressure vessel inspection", "test", 300)] }] },
  { key: "ct5", name: "CT-05", type: "coil_tubing_unit", identifier: "1405", expect: "due_soon",
    items: [annual("Annual DOT inspection", "inspection", 260)],
    assets: [bop(5, 150), injector(5, 210), reel(5, "2in", "19,500 ft", 95), valve("PV-2205", 25 /* due in 25d */), swivel("SW-1105", 180)] },

  // ── READY (10) ──
  { key: "ct2", name: "CT-02", type: "coil_tubing_unit", identifier: "1402", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 220)],
    assets: [bop(2, 180), injector(2, 260), reel(2, "2in", "17,000 ft", 140), valve("PV-2202", 210), swivel("SW-1102", 230)] },
  { key: "ct4", name: "CT-04", type: "coil_tubing_unit", identifier: "1404", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 190)],
    assets: [bop(4, 320), injector(4, 90), reel(4, "2-7/8in", "14,600 ft", 200), valve("PV-2204", 160),
      swivel("SW-1104", 362, { issued: -3 }) /* renewed 3 days ago: the win story */] },
  { key: "ct7", name: "CT-07", type: "coil_tubing_unit", identifier: "1407", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 300)],
    assets: [bop(7, 280), injector(7, 170), reel(7, "2-3/8in", "15,100 ft", 240), valve("PV-2207", 130), swivel("SW-1107", 250)] },
  { key: "ct8", name: "CT-08", type: "coil_tubing_unit", identifier: "1408", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 170)],
    assets: [bop(8, 190), injector(8, 310), reel(8, "2in", "16,800 ft", 130), valve("PV-2208", 220), swivel("SW-1108", 145)] },
  { key: "p1", name: "P-01", type: "pump_truck", identifier: "2301", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 240)],
    assets: [{ name: "Fluid end, P-01", category: "tool", identifier: "FE-201", items: [annual("Fluid end inspection", "inspection", 200)] },
      valve("PV-2211", 175)] },
  { key: "p3", name: "P-03", type: "pump_truck", identifier: "2303", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 210)],
    assets: [{ name: "Fluid end, P-03", category: "tool", identifier: "FE-203", items: [annual("Fluid end inspection", "inspection", 185)] },
      valve("PV-2213", 358, { issued: -7 }) /* renewed a week ago */] },
  { key: "n2b", name: "N2-02", type: "nitrogen_unit", identifier: "3102", expect: "ready",
    items: [annual("DOT sticker", "dot_sticker", 250)],
    assets: [{ name: "N2 transport skid", category: "equipment", identifier: "N2S-32", items: [annual("Pressure vessel inspection", "test", 280)] }] },
  { key: "cr1", name: "CR-01 Crane", type: "crane_truck", identifier: "5501", expect: "ready",
    items: [annual("Annual DOT inspection", "inspection", 230)],
    assets: [{ name: "Boom & block", category: "lifting", identifier: "CR1-BB", items: [annual("Crane annual inspection", "inspection", 210)] },
             { name: "Wire rope slings, set A", category: "lifting", identifier: "SL-A", items: [{ title: "Sling quarterly inspection", kind: "inspection", exp: 45, issued: -45 }] },
             { name: "Hooks & shackles, set A", category: "lifting", identifier: "HS-A", items: [annual("Hook & shackle inspection", "inspection", 120)] }] },
  { key: "bt1", name: "BOP Trailer T-1", type: "trailer", identifier: "T1", expect: "ready",
    items: [annual("Trailer registration", "registration", 320)],
    assets: [{ name: "Spare dual BOP stack", category: "pressure_control", identifier: "DB-2210", items: [annual("BOP pressure test", "test", 75)] },
             { ...lube(2, 220), note: "rack 2" }, { name: "Crossover subs basket", category: "tool" }] },
  { key: "st2", name: "Service Trailer T-2", type: "trailer", identifier: "T2", expect: "ready",
    items: [annual("Trailer registration", "registration", 290)],
    assets: [{ name: "Iron basket, 2in 1502", category: "tool" }] },
];

/** Iron sitting in the yard, on no truck. */
export const DEMO_YARD_IRON: DemoAsset[] = [
  swivel("SW-1180", -12, { note: "recert rack by the wash bay" }) /* overdue, pulled for recert */,
  valve("PV-2250", 20),
  valve("PV-3019", 140, { size: "3in", status: "missing", note: "came off CT-07 at rig-down, not seen since" }),
  valve("PV-1977", -40, { status: "retired", note: "failed UT, cut up for scrap" }),
  { ...lube(3, 260), name: "Spare lubricator #3" },
  { name: "2in 1502 pup joint, 10 ft", category: "flow_iron", identifier: "PJ-3312", items: [annual(RECERT, "test", 200)] },
  { name: "2in 1502 pup joint, 6 ft", category: "flow_iron", identifier: "PJ-3318", items: [annual(RECERT, "test", 28)] },
  { name: "Test pump & chart recorder", category: "equipment", identifier: "TP-01", items: [{ title: "Chart recorder calibration", kind: "inspection", exp: 50, issued: -130 }] },
];

/** Where some of it has been. Every other piece starts where it sits now. */
export const DEMO_MOVES: DemoMove[] = [
  { serial: "QB-4471", from: "yard", to: "ct3", by: "Dale Wooten", daysAgo: 40, hour: 7 },
  { serial: "LB-812", from: "ct1", to: "yard", note: "back from CT-01 for its test", by: "Kevin Odom", daysAgo: 20, hour: 16 },
  { serial: "LB-812", from: "yard", to: "bt1", note: "rack 2", by: "Beau Slaughter", daysAgo: 3, hour: 7 },
  { serial: "SW-1180", from: "ct2", to: "yard", note: "recert rack by the wash bay", by: "Dale Wooten", daysAgo: 15, hour: 17 },
  { serial: "PV-3019", from: "ct7", to: "yard", note: "came off CT-07 at rig-down, not seen since", by: "Kevin Odom", daysAgo: 6, hour: 18 },
  { serial: "SW-1104", from: "ct4", to: "yard", note: "out for recert", by: "Freddy Carrasco", daysAgo: 5, hour: 15 },
  { serial: "SW-1104", from: "yard", to: "ct4", note: "back from recert", by: "Freddy Carrasco", daysAgo: 3, hour: 10 },
];

/**
 * One upload waiting on the manager, so the demo shows the rule that matters
 * most: nobody can clear a test with a date that isn't on the paper. Logan
 * sent the real BOP cert for CT-03 (lib/saas/demo-assets/bop-cert-ct03.jpg)
 * but typed a date a year out; the paper says something else, so CT-03
 * stays red and the upload sits on the Review page.
 */
export const DEMO_WAITING_UPLOAD = {
  unitKey: "ct3",
  assetName: "Quad BOP stack #3",
  itemTitle: "BOP pressure test",
  by: "Logan McAfee",
  typedExpirationDays: 365,
  image: "lib/saas/demo-assets/bop-cert-ct03.jpg",
  /** What the server reads off that image (checked in demo-data.test.ts against the reader). */
  paperText: `PERMIAN PRESSURE TESTING LLC
Odessa, TX · (432) 555-0142
CERTIFICATE OF PRESSURE TEST
Equipment: Quad BOP stack #3
Serial No: QB-4471
Test pressure: 10,000 psi Held: 15 min Result: PASS
Date tested: 09/15/2026
Expires: 03/15/2027
Tested by: R. Salinas Cert #88213`,
  hour: 5, minute: 40,
};

/** Activity feed: ten days of a working yard, hours a yard actually keeps. */
export const DEMO_EVENTS: DemoEvent[] = [
  { kind: "check_not_ready", message: "CT-03 checked NOT READY: BOP pressure test (Quad BOP stack #3) expired", actor: "Dale Wooten", daysAgo: 0, hour: 5, minute: 5 },
  { kind: "check_ready", message: "CT-02 checked READY for the Mabee Ranch pad", actor: "Ray Hinojosa", daysAgo: 0, hour: 4, minute: 50 },
  { kind: "alert_sent", message: "Warning emailed: Lubricator #1 pressure test due in 9 days", actor: null, daysAgo: 0, hour: 6, minute: 32 },
  { kind: "check_ready", message: "CR-01 Crane checked READY, slings current", actor: "Cody Blackburn", daysAgo: 1, hour: 6, minute: 15 },
  { kind: "check_not_ready", message: "CT-06 held: 2in plug valve PV-2231 red-tagged", actor: "Lupe Cardenas", daysAgo: 2, hour: 5, minute: 20 },
  { kind: "asset_status", message: "2in 1502 plug valve PV-2231 red-tagged: UT wall under minimum", actor: "Manuel Ortega", daysAgo: 2, hour: 14, minute: 10 },
  // ── the win story: fail → fix → re-check, all in one working day ──
  { kind: "check_not_ready", message: "CT-04 checked NOT READY: iron recert on swivel SW-1104 expired", actor: "Dale Wooten", daysAgo: 3, hour: 4, minute: 50 },
  { kind: "renewed", message: "Iron recert renewed on swivel SW-1104 with a photo of the test company's cert, good for 12 months", actor: "Freddy Carrasco", daysAgo: 3, hour: 9, minute: 40 },
  { kind: "check_ready", message: "CT-04 re-checked READY for the Diamondback pad and rolled at 4pm", actor: "Dale Wooten", daysAgo: 3, hour: 15, minute: 20 },
  { kind: "asset_moved", message: "Lubricator #2 moved from the yard to BOP Trailer T-1, rack 2", actor: "Beau Slaughter", daysAgo: 3, hour: 7, minute: 10 },
  { kind: "check_ready", message: "P-01 checked READY", actor: "J.R. Stanton", daysAgo: 5, hour: 6, minute: 15 },
  { kind: "asset_status", message: "3in 1502 plug valve PV-3019 flagged MISSING after rig-down on CT-07", actor: "Kevin Odom", daysAgo: 6, hour: 18, minute: 45 },
  { kind: "renewed", message: "Iron recert renewed on plug valve PV-2213 (P-03), good for 12 months", actor: "Cody Blackburn", daysAgo: 7, hour: 10, minute: 5 },
  { kind: "check_ready", message: "CT-05 checked READY for the Sale Ranch workover", actor: "Manuel Ortega", daysAgo: 8, hour: 4, minute: 55 },
];

/** The two misses caught this month (both visible in the feed). */
export const DEMO_MISSES: { message: string; daysAgo: number; hour: number }[] = [
  { message: "Miss caught: CT-04 swivel recert dead before the Diamondback pad", daysAgo: 3, hour: 4 },
  { message: "Miss caught: CT-06 red-tagged plug valve caught before rollout", daysAgo: 2, hour: 5 },
];

/** Immutable check records for the trucks' history. */
export const DEMO_CHECKS: DemoCheck[] = [
  { unitKey: "ct3", status: "not_ready", by: "Dale Wooten", daysAgo: 0, hour: 5, minute: 5 },
  { unitKey: "ct2", status: "ready", by: "Ray Hinojosa", daysAgo: 0, hour: 4, minute: 50 },
  { unitKey: "cr1", status: "ready", by: "Cody Blackburn", daysAgo: 1, hour: 6, minute: 15 },
  { unitKey: "ct6", status: "not_ready", by: "Lupe Cardenas", daysAgo: 2, hour: 5, minute: 20 },
  { unitKey: "ct4", status: "not_ready", by: "Dale Wooten", daysAgo: 3, hour: 4, minute: 50 },
  { unitKey: "ct4", status: "ready", by: "Dale Wooten", daysAgo: 3, hour: 15, minute: 20 },
  { unitKey: "p1", status: "ready", by: "J.R. Stanton", daysAgo: 5, hour: 6, minute: 15 },
  { unitKey: "ct5", status: "ready", by: "Manuel Ortega", daysAgo: 8, hour: 4, minute: 55 },
];

/** Sent-alert ledger rows so Tests due shows real receipts. By serial or truck. */
export const DEMO_ALERTS_SENT: { itemTitle: string; serial?: string; unitKey?: string; daysAgo: number }[] = [
  { itemTitle: "Lubricator pressure test", serial: "LB-811", daysAgo: 0 },
  { itemTitle: "DOT sticker", unitKey: "n2a", daysAgo: 4 },
  { itemTitle: RECERT, serial: "PV-2250", daysAgo: 6 },
  { itemTitle: RECERT, serial: "SW-1180", daysAgo: 41 },
];
