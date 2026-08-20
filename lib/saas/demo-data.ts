/**
 * The demo yard, declared pure — "Caprock Coil & Pressure Control", a
 * fictional Odessa coil tubing outfit every /demo visitor gets a private
 * copy of. All dates are DAY OFFSETS from seed time (positive = future), so
 * the yard is forever mid-week, never stale.
 *
 * The board is deliberately not all green (spec):
 *   14 rolling units READY · 3 NOT READY with named reasons · 3 due-soon
 *   (+ the shop building, cert-book only — ready).
 * Red reasons: CT-03 BOP pressure test expired 6d ago · P-02 annual DOT
 * lapsed · CT-06's operator's H2S expired yesterday.
 *
 * Invariant the tests pin: crew with expiring/expired cards are only ever
 * assigned to units already red/amber (or ride the bench) — otherwise their
 * cards would flip a "ready" unit and break the seeded spread.
 */

export const DEMO_COMPANY_NAME = "Caprock Coil & Pressure Control";
export const DEMO_YARD_NAME = "Odessa Yard";

export interface DemoItem { title: string; kind: string; exp: number | null; issued?: number }
export interface DemoAsset { name: string; category: string; status?: string; items?: DemoItem[] }
export interface DemoUnit {
  key: string; name: string; type: string; identifier?: string;
  expect: "ready" | "not_ready" | "due_soon";
  items?: DemoItem[]; assets?: DemoAsset[]; crew?: string[];
}
export interface DemoCrew { key: string; name: string; role: string; cards: DemoItem[] }
export interface DemoEvent { kind: string; message: string; actor: string | null; daysAgo: number; hour: number; minute: number }
export interface DemoCheck { unitKey: string; status: "ready" | "not_ready"; by: string; daysAgo: number; hour: number; minute: number }

const H2S = (exp: number): DemoItem => ({ title: "H2S Clear", kind: "cert", exp, issued: exp - 365 });
const WC = (exp: number): DemoItem => ({ title: "Well Control (IADC WellSharp)", kind: "cert", exp, issued: exp - 730 });
const CDL = (exp: number): DemoItem => ({ title: "CDL — Class A", kind: "document", exp, issued: exp - 1460 });
const MED = (exp: number): DemoItem => ({ title: "DOT medical card", kind: "cert", exp, issued: exp - 730 });
const SAFE = (exp: number): DemoItem => ({ title: "SafeLandUSA", kind: "cert", exp, issued: exp - 365 });
const AID = (exp: number): DemoItem => ({ title: "First aid / CPR", kind: "cert", exp, issued: exp - 730 });

export const DEMO_CREW: DemoCrew[] = [
  // supervisors
  { key: "c1", name: "Dale Wooten", role: "Supervisor", cards: [H2S(212), WC(388), SAFE(150), AID(301)] },
  { key: "c2", name: "Ray Hinojosa", role: "Supervisor", cards: [H2S(178), WC(255), SAFE(97), AID(140)] },
  { key: "c3", name: "Cody Blackburn", role: "Supervisor", cards: [H2S(324), WC(451), SAFE(203), AID(88)] },
  { key: "c4", name: "Manuel Ortega", role: "Supervisor", cards: [H2S(145), WC(298), SAFE(266), AID(190)] },
  { key: "c5", name: "Travis Keough", role: "Supervisor", cards: [H2S(233), WC(340), SAFE(121), AID(260)] },
  { key: "c6", name: "Lupe Cardenas", role: "Supervisor", cards: [H2S(190), WC(410), SAFE(178), AID(95)] },
  // operators
  { key: "c7", name: "Marcus Villarreal", role: "Coil operator", cards: [H2S(-1), WC(220), SAFE(140), MED(310)] }, // ← the red H2S on CT-06
  { key: "c8", name: "Jerry Boles", role: "Coil operator", cards: [H2S(348), WC(190), SAFE(88), MED(240)] },
  { key: "c9", name: "Logan McAfee", role: "Coil operator", cards: [H2S(156), WC(277), SAFE(199), MED(120)] },
  { key: "c10", name: "Esteban Fuentes", role: "Coil operator", cards: [H2S(288), WC(133), SAFE(310), MED(178)] },
  { key: "c11", name: "Wyatt Sikes", role: "Coil operator", cards: [H2S(97), WC(365), SAFE(155), MED(266)] },
  { key: "c12", name: "Aaron Pruett", role: "Coil operator", cards: [H2S(203), WC(244), SAFE(133), MED(300)] },
  { key: "c13", name: "Domingo Salas", role: "Coil operator", cards: [H2S(178), WC(310), SAFE(240), MED(90)] },
  { key: "c14", name: "Blake Turnbow", role: "Coil operator", cards: [H2S(255), WC(160), SAFE(288), MED(200)] },
  { key: "c15", name: "Chris Ledoux Jr.", role: "Coil operator", cards: [H2S(140), WC(410), SAFE(110), MED(330)] },
  { key: "c16", name: "Hector Bustamante", role: "Coil operator", cards: [H2S(310), WC(199), SAFE(178), MED(150)] },
  // pump operators
  { key: "c17", name: "Freddy Carrasco", role: "Pump operator", cards: [H2S(220), SAFE(140), MED(255), AID(97)] },
  { key: "c18", name: "J.R. Stanton", role: "Pump operator", cards: [H2S(133), SAFE(266), MED(190), AID(310)] },
  { key: "c19", name: "Miguel Zamora", role: "Pump operator", cards: [H2S(288), SAFE(97), MED(140), AID(203)] },
  { key: "c20", name: "Tanner Whitfield", role: "Pump operator", cards: [H2S(178), SAFE(330), MED(120), AID(255)] },
  { key: "c21", name: "Oscar Renteria", role: "Pump operator", cards: [H2S(245), SAFE(155), MED(299), AID(133)] },
  { key: "c22", name: "Dusty Copeland", role: "Pump operator", cards: [H2S(97), SAFE(203), MED(178), AID(288)] },
  { key: "c23", name: "Ramiro Cavazos", role: "Pump operator", cards: [H2S(320), SAFE(120), MED(240), AID(178)] },
  { key: "c24", name: "Colt Menefee", role: "Pump operator", cards: [H2S(160), SAFE(277), MED(340), AID(110)] },
  // riggers
  { key: "c25", name: "Beau Slaughter", role: "Rigger", cards: [H2S(190), SAFE(133), AID(255)] },
  { key: "c26", name: "Ismael Duran", role: "Rigger", cards: [H2S(266), SAFE(310), AID(140)] },
  { key: "c27", name: "Kevin Odom", role: "Rigger", cards: [H2S(120), SAFE(97), AID(203)] },
  { key: "c28", name: "Noe Villanueva", role: "Rigger", cards: [H2S(299), SAFE(188), AID(330)] },
  { key: "c29", name: "Garrett Pool", role: "Rigger", cards: [H2S(140), SAFE(240), AID(97)] },
  { key: "c30", name: "Ruben Holguin", role: "Rigger", cards: [H2S(203), SAFE(155), AID(266)] },
  { key: "c31", name: "Trey Bighorse", role: "Rigger", cards: [H2S(310), SAFE(120), AID(178)] },
  { key: "c32", name: "Sammy Arredondo", role: "Rigger", cards: [H2S(178), SAFE(288), AID(140)] },
  // CDL drivers
  { key: "c33", name: "Bobby Ray Culpepper", role: "CDL driver", cards: [CDL(720), MED(140), H2S(203), SAFE(97)] },
  { key: "c34", name: "Felix Armendariz", role: "CDL driver", cards: [CDL(1100), MED(255), H2S(178), SAFE(266)] },
  { key: "c35", name: "Dewayne Sparks", role: "CDL driver", cards: [CDL(540), MED(97), H2S(310), SAFE(190)] },
  { key: "c36", name: "Adan Quintanilla", role: "CDL driver", cards: [CDL(900), MED(190), H2S(133), SAFE(320)] },
  { key: "c37", name: "Cooper Lindley", role: "CDL driver", cards: [CDL(660), MED(310), H2S(240), SAFE(140)] },
  { key: "c38", name: "Gilbert Saenz", role: "CDL driver", cards: [CDL(810), MED(178), H2S(97), SAFE(255)] },
  { key: "c39", name: "Marshall Tice", role: "CDL driver", cards: [CDL(450), MED(203), H2S(288), SAFE(110)] },
  { key: "c40", name: "Ezequiel Barraza", role: "CDL driver", cards: [CDL(990), MED(133), H2S(190), SAFE(299)] },
  // floorhands — the bench: expiring cards live HERE (unassigned) so alerts
  // have data without flipping a ready unit's tile.
  { key: "c41", name: "Ty Hollabaugh", role: "Floorhand", cards: [H2S(7), SAFE(190), AID(240)] },
  { key: "c42", name: "Rene Galvan", role: "Floorhand", cards: [H2S(155), SAFE(11), AID(120)] },
  { key: "c43", name: "Dakota Pfeiffer", role: "Floorhand", cards: [H2S(97), SAFE(266), AID(14)] },
  { key: "c44", name: "Abel Contreras", role: "Floorhand", cards: [MED(19), H2S(203), SAFE(140)] },
  { key: "c45", name: "Junior Applewhite", role: "Floorhand", cards: [H2S(240), SAFE(178), AID(310)] },
];

const bop = (n: number, exp: number): DemoAsset => ({
  name: `Quad BOP stack #${n}`, category: "pressure_control",
  items: [{ title: "BOP pressure test", kind: "test", exp, issued: exp - 365 }],
});
const injector = (n: number, exp: number): DemoAsset => ({
  name: `Injector head #${n}`, category: "equipment",
  items: [{ title: "Injector service & inspection", kind: "inspection", exp, issued: exp - 365 }],
});
const reel = (n: number, size: string, len: string, exp: number): DemoAsset => ({
  name: `Reel R-${n} — ${size} · ${len}`, category: "equipment",
  items: [{ title: "Coil string fatigue inspection", kind: "inspection", exp, issued: exp - 180 }],
});
const lube = (n: number, exp: number, status?: string): DemoAsset => ({
  name: `Lubricator #${n}`, category: "pressure_control", status,
  items: [{ title: "Lubricator pressure test", kind: "test", exp, issued: exp - 365 }],
});

export const DEMO_UNITS: DemoUnit[] = [
  // ── NOT READY (3), each with its named reason ──
  { key: "ct3", name: "CT-03", type: "coil_tubing_unit", identifier: "1403", expect: "not_ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 140 }],
    assets: [bop(3, -6) /* ← THE red: BOP pressure test expired 6 days ago */, injector(3, 200), reel(3, "2-3/8\"", "15,800 ft", 90)],
    crew: ["c9", "c27", "c35"] },
  { key: "p2", name: "P-02", type: "pump_truck", identifier: "2302", expect: "not_ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: -23 /* ← THE red: DOT lapsed */ }],
    assets: [{ name: "Fluid end — P-02", category: "tool", items: [{ title: "Fluid end inspection", kind: "inspection", exp: 160 }] }],
    crew: ["c18", "c29"] },
  { key: "ct6", name: "CT-06", type: "coil_tubing_unit", identifier: "1406", expect: "not_ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 200 }],
    assets: [bop(6, 240), injector(6, 150), reel(6, "2\"", "18,200 ft", 120)],
    crew: ["c7" /* ← THE red: Marcus Villarreal's H2S expired yesterday */, "c30", "c38"] },

  // ── DUE SOON (3) — inside the 30-day window ──
  { key: "ct1", name: "CT-01", type: "coil_tubing_unit", identifier: "1401", expect: "due_soon",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 180 }],
    assets: [bop(1, 210), lube(1, 9 /* due in 9d */), reel(1, "2-3/8\"", "16,400 ft", 75)],
    crew: ["c8", "c25", "c33"] },
  { key: "n2a", name: "N2-01", type: "nitrogen_unit", identifier: "3101", expect: "due_soon",
    items: [{ title: "DOT sticker", kind: "dot_sticker", exp: 12 }],
    assets: [{ name: "N2 pump & vaporizer", category: "equipment", items: [{ title: "Pressure vessel inspection", kind: "test", exp: 300 }] }],
    crew: ["c19"] },
  { key: "hs1", name: "HS-01 Hotshot", type: "pickup", identifier: "77", expect: "due_soon",
    items: [{ title: "Registration", kind: "registration", exp: 6 }],
    crew: ["c39"] },

  // ── READY (14) ──
  { key: "ct2", name: "CT-02", type: "coil_tubing_unit", identifier: "1402", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 220 }],
    assets: [bop(2, 180), injector(2, 260), reel(2, "2\"", "17,000 ft", 140)], crew: ["c10", "c26", "c34"] },
  { key: "ct4", name: "CT-04", type: "coil_tubing_unit", identifier: "1404", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 190 }],
    assets: [bop(4, 320), injector(4, 90), reel(4, "2-7/8\"", "14,600 ft", 200)], crew: ["c11", "c28", "c36"] },
  { key: "ct5", name: "CT-05", type: "coil_tubing_unit", identifier: "1405", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 260 }],
    assets: [bop(5, 150), injector(5, 210), reel(5, "2\"", "19,500 ft", 95)], crew: ["c12", "c31"] },
  { key: "ct7", name: "CT-07", type: "coil_tubing_unit", identifier: "1407", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 300 }],
    assets: [bop(7, 280), injector(7, 170), reel(7, "2-3/8\"", "15,100 ft", 240)],
    crew: ["c13"] /* short-handed on purpose */ },
  { key: "ct8", name: "CT-08", type: "coil_tubing_unit", identifier: "1408", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 170 }],
    assets: [bop(8, 190), injector(8, 310), reel(8, "2\"", "16,800 ft", 130)],
    crew: [] /* no crew assigned — the check calls that out loud */ },
  { key: "p1", name: "P-01", type: "pump_truck", identifier: "2301", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 240 }],
    assets: [{ name: "Fluid end — P-01", category: "tool", items: [{ title: "Fluid end inspection", kind: "inspection", exp: 200 }] }],
    crew: ["c17", "c32"] },
  { key: "p3", name: "P-03", type: "pump_truck", identifier: "2303", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 210 }],
    assets: [{ name: "Quad BOP stack #7", category: "pressure_control",
      items: [{ title: "BOP pressure test", kind: "test", exp: 362, issued: -3 /* renewed 3 days ago — the win story */ }] }],
    crew: ["c20", "c37"] },
  { key: "n2b", name: "N2-02", type: "nitrogen_unit", identifier: "3102", expect: "ready",
    items: [{ title: "DOT sticker", kind: "dot_sticker", exp: 250 }],
    assets: [{ name: "N2 transport skid", category: "equipment", items: [{ title: "Pressure vessel inspection", kind: "test", exp: 280 }] }],
    crew: ["c21"] },
  { key: "cr1", name: "CR-01 Crane", type: "crane_truck", identifier: "5501", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 230 }],
    assets: [{ name: "Boom & block", category: "lifting", items: [{ title: "Crane annual inspection", kind: "inspection", exp: 210 }] },
             { name: "Wire rope slings — set A", category: "lifting", items: [{ title: "Sling quarterly inspection", kind: "inspection", exp: 45 }] }],
    crew: ["c22", "c40"] },
  { key: "fp1", name: "FP-01 Fluid Pump", type: "cement_pump_unit", identifier: "4201", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 280 }], crew: ["c23"] },
  { key: "bt1", name: "BOP Trailer T-1", type: "trailer", identifier: "T1", expect: "ready",
    items: [{ title: "Trailer registration", kind: "registration", exp: 320 }],
    assets: [{ name: "Dual BOP stack — spare", category: "pressure_control", items: [{ title: "BOP pressure test", kind: "test", exp: 75 }] },
             lube(2, 220), { name: "Crossover subs — basket", category: "tool" }],
    crew: [] },
  { key: "st2", name: "Service Trailer T-2", type: "trailer", identifier: "T2", expect: "ready",
    items: [{ title: "Trailer registration", kind: "registration", exp: 290 }],
    assets: [{ name: "Iron basket — 2\" 1502", category: "tool" }], crew: [] },
  { key: "cw1", name: "Crew Truck 1", type: "truck", identifier: "101", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 200 }], crew: ["c24"] },
  { key: "cw2", name: "Crew Truck 2", type: "truck", identifier: "102", expect: "ready",
    items: [{ title: "Annual DOT inspection", kind: "inspection", exp: 185 }], crew: ["c14", "c15"] },

  // ── The shop — cert book only (buildings don't roll out) ──
  { key: "shop", name: "Main Shop", type: "shop", expect: "ready",
    items: [
      { title: "Fire extinguisher inspection", kind: "inspection", exp: 160 },
      { title: "Overhead crane annual", kind: "inspection", exp: 230 },
      { title: "Air compressor pressure test", kind: "test", exp: 120 },
    ] },
];

/** Activity feed — ten days of a working yard, hours a yard actually keeps. */
export const DEMO_EVENTS: DemoEvent[] = [
  { kind: "check_not_ready", message: "CT-03 checked NOT READY — BOP pressure test (Quad BOP stack #3) expired", actor: "Dale Wooten", daysAgo: 0, hour: 5, minute: 5 },
  { kind: "alert_sent", message: "Warning emailed: HS-01 Hotshot registration expires in 6 days", actor: null, daysAgo: 0, hour: 6, minute: 32 },
  { kind: "check_ready", message: "CT-02 checked READY for the Mabee Ranch pad", actor: "Ray Hinojosa", daysAgo: 0, hour: 4, minute: 50 },
  { kind: "asset_seen", message: "Lubricator #2 last seen: BOP Trailer T-1, rack 2 — per Beau Slaughter", actor: "Beau Slaughter", daysAgo: 1, hour: 19, minute: 30 },
  { kind: "renewed", message: "H2S Clear renewed for Wyatt Sikes — good through next summer", actor: "Wyatt Sikes", daysAgo: 1, hour: 9, minute: 15 },
  { kind: "check_ready", message: "CR-01 Crane checked READY — slings current", actor: "Cody Blackburn", daysAgo: 1, hour: 6, minute: 15 },
  { kind: "alert_sent", message: "Warning emailed: Marcus Villarreal's H2S Clear expires tomorrow", actor: null, daysAgo: 2, hour: 6, minute: 30 },
  { kind: "check_not_ready", message: "Card caught before the job: CT-06 held — operator H2S lapsing", actor: "Lupe Cardenas", daysAgo: 2, hour: 5, minute: 20 },
  // ── the win story: fail → fix → re-check, all in one working day ──
  { kind: "check_not_ready", message: "P-03 checked NOT READY — BOP pressure test (Quad BOP stack #7) expired", actor: "Dale Wooten", daysAgo: 3, hour: 4, minute: 50 },
  { kind: "renewed", message: "BOP pressure test renewed on Quad BOP stack #7 — shot the new chart, good for 12 months", actor: "Freddy Carrasco", daysAgo: 3, hour: 9, minute: 40 },
  { kind: "check_ready", message: "P-03 re-checked READY for the Diamondback pad — rolled at 4pm", actor: "Dale Wooten", daysAgo: 3, hour: 15, minute: 20 },
  { kind: "asset_flagged", message: "Lubricator #2 flagged MISSING at rig-down — last seen on 12", actor: "Kevin Odom", daysAgo: 4, hour: 18, minute: 45 },
  { kind: "asset_seen", message: "Lubricator #2 found in the pipe shop — back on T-1", actor: "Kevin Odom", daysAgo: 3, hour: 7, minute: 10 },
  { kind: "check_ready", message: "P-01 checked READY", actor: "J.R. Stanton", daysAgo: 5, hour: 6, minute: 15 },
  { kind: "renewed", message: "Sling quarterly inspection renewed — set A tagged", actor: "Cody Blackburn", daysAgo: 6, hour: 10, minute: 5 },
  { kind: "check_ready", message: "CT-05 checked READY for the Sale Ranch workover", actor: "Manuel Ortega", daysAgo: 8, hour: 4, minute: 55 },
];

/** The two misses the KPI card counts this month (both visible in the feed). */
export const DEMO_MISSES: { message: string; daysAgo: number; hour: number }[] = [
  { message: "Miss caught: P-03 BOP cert dead before the Diamondback pad", daysAgo: 3, hour: 4 },
  { message: "Miss caught: CT-06 operator card lapsing before rollout", daysAgo: 2, hour: 5 },
];

/** Immutable check records — powers dispatch history + the month tape. */
export const DEMO_CHECKS: DemoCheck[] = [
  { unitKey: "ct3", status: "not_ready", by: "Dale Wooten", daysAgo: 0, hour: 5, minute: 5 },
  { unitKey: "ct2", status: "ready", by: "Ray Hinojosa", daysAgo: 0, hour: 4, minute: 50 },
  { unitKey: "cr1", status: "ready", by: "Cody Blackburn", daysAgo: 1, hour: 6, minute: 15 },
  { unitKey: "ct6", status: "not_ready", by: "Lupe Cardenas", daysAgo: 2, hour: 5, minute: 20 },
  { unitKey: "p3", status: "not_ready", by: "Dale Wooten", daysAgo: 3, hour: 4, minute: 50 },
  { unitKey: "p3", status: "ready", by: "Dale Wooten", daysAgo: 3, hour: 15, minute: 20 },
  { unitKey: "p1", status: "ready", by: "J.R. Stanton", daysAgo: 5, hour: 6, minute: 15 },
  { unitKey: "ct5", status: "ready", by: "Manuel Ortega", daysAgo: 8, hour: 4, minute: 55 },
];

/** 14 days for the trend chart — a yard tightening up, with miss markers. */
export const DEMO_SNAPSHOTS: { daysAgo: number; readiness: number; misses: number }[] = [
  { daysAgo: 13, readiness: 68, misses: 0 }, { daysAgo: 12, readiness: 68, misses: 0 },
  { daysAgo: 11, readiness: 71, misses: 0 }, { daysAgo: 10, readiness: 74, misses: 0 },
  { daysAgo: 9, readiness: 74, misses: 0 }, { daysAgo: 8, readiness: 78, misses: 0 },
  { daysAgo: 7, readiness: 81, misses: 0 }, { daysAgo: 6, readiness: 79, misses: 0 },
  { daysAgo: 5, readiness: 83, misses: 0 }, { daysAgo: 4, readiness: 83, misses: 0 },
  { daysAgo: 3, readiness: 80, misses: 1 }, { daysAgo: 2, readiness: 84, misses: 1 },
  { daysAgo: 1, readiness: 87, misses: 0 }, { daysAgo: 0, readiness: 88, misses: 0 },
];

/** Sent-alert ledger rows so Compliance & Logs shows real receipts. */
export const DEMO_ALERTS_SENT: { itemTitle: string; unitKey?: string; crewKey?: string; daysAgo: number }[] = [
  { itemTitle: "Registration", unitKey: "hs1", daysAgo: 0 },
  { itemTitle: "H2S Clear", crewKey: "c7", daysAgo: 2 },
  { itemTitle: "DOT sticker", unitKey: "n2a", daysAgo: 4 },
  { itemTitle: "Lubricator pressure test", unitKey: "ct1", daysAgo: 5 },
];
