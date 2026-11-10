import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load-out rules on the server, round two (regressions, cross-crew
 * collisions, and the changes other areas asked for). Run against the REAL
 * finishLoadout on an in-memory database, plus the pure helpers:
 *   - A piece on another truck's open trip: the reason says how to clear it,
 *     and the phone hears it at the scan.
 *   - A piece scanned onto another truck after this phone scanned it blocks,
 *     and a fresh scan clears it.
 *   - A tool signed out for more than a shift and only tapped on by hand
 *     blocks, and nobody's sign-out closes.
 *   - A NOT READY try never puts a person's tool on the truck, and "Not going
 *     this trip" never takes it off their sign-out.
 *   - Taken-off iron stays in the yard the load-out started in.
 *   - The answer carries every package's lines and checks.
 *   - An old plan is used up when the truck rolls; a later one stays, and the
 *     feed says so.
 *   - A red tag taken off in the last day goes on the record.
 *   - Kit lines keep "15,000 psi" as typed, kits from a truck are by kind,
 *     and the marketing shot's kit is the demo's.
 *   - Migration 0050 changes only the two feed lines.
 */

vi.mock("../notify", () => ({
  sendEmail: vi.fn(async () => true),
  sendSms: vi.fn(async () => true),
  smsConfigured: () => false,
  notifyEvent: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
  logEventNow: vi.fn(async () => {}),
}));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Test Wireline", role: "member", subscription_status: "active", comped: false, is_demo: false, yard_quantity: 1, npt_day_estimate: 10000 },
  user: { id: "beau", email: "beau@example.com", user_metadata: { full_name: "Beau Slaughter" } },
}));
vi.mock("../auth", () => ({
  requireCompany: vi.fn(async () => authMock),
  requireBillableCompany: vi.fn(async () => authMock),
  assertCan: vi.fn(),
}));
const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({
  saasDb: async () => dbHolder.current,
  saasAdmin: () => dbHolder.current,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { finishLoadout } from "@/app/app/units/[unitId]/scan/actions";
import { kitFromTruck } from "@/app/app/packages/actions";
import { demoKitAndPackages } from "@/app/shot/fixtures";
import { logEvent } from "../notify";
import { pieceKind, kitLinesFrom, loadoutVerdict } from "../loadout-lines";
import { scanMessage, type ScanPiece } from "../loadout";
import { getScanPieces } from "../scan-pieces";
import { DEMO_UNITS } from "../demo-data";
import { demoKitLines } from "../demo-loadouts";

type Row = Record<string, unknown>;
interface Write { table: string; kind: "insert" | "update" | "delete"; payload: Row; filters: Record<string, unknown> }

/** Just enough PostgREST: filters filter, order and limit work, writes are captured. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let write: Write | null = null;
    let single = false;
    const f = (c: string, v: unknown) => { if (write) write.filters[c] = v; };
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { f(c, v); if (!write) rows = rows.filter((r) => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { if (!write) rows = rows.filter((r) => r[c] !== v); return q; },
      in: (c: string, v: unknown[]) => { f(c, v); if (!write) rows = rows.filter((r) => v.includes(r[c])); return q; },
      is: (c: string, v: unknown) => { f(c, v); if (!write) rows = rows.filter((r) => (r[c] ?? null) === v); return q; },
      not: (c: string, _op: string, v: unknown) => { if (!write) rows = rows.filter((r) => (r[c] ?? null) !== v); return q; },
      gt: (c: string, v: string) => { if (!write) rows = rows.filter((r) => String(r[c] ?? "") > v); return q; },
      lt: (c: string, v: string) => { if (!write) rows = rows.filter((r) => String(r[c] ?? "") < v); return q; },
      ilike: (c: string, v: string) => { const w = v.replace(/%/g, "").toLowerCase(); rows = rows.filter((r) => String(r[c] ?? "").toLowerCase().includes(w)); return q; },
      or: () => q,
      order: (c: string, o?: { ascending?: boolean }) => { rows.sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (o?.ascending === false ? -1 : 1)); return q; },
      limit: (n: number) => { rows = rows.slice(0, n); return q; },
      range: (a: number, b: number) => { rows = rows.slice(a, b + 1); return q; },
      maybeSingle: () => { single = true; return q; },
      single: () => { single = true; return q; },
      insert: (p: Row) => { write = { table, kind: "insert", payload: p, filters: {} }; writes.push(write); return q; },
      update: (p: Row) => { write = { table, kind: "update", payload: p, filters: {} }; writes.push(write); return q; },
      delete: () => { write = { table, kind: "delete", payload: {}, filters: {} }; writes.push(write); return q; },
      then: <T>(res: (v: { data: unknown; error: null }) => T) => res(write
        ? { data: single ? { id: "lo-new", proof_token: "tok-new", ...write.payload } : write.payload, error: null }
        : { data: single ? rows[0] ?? null : rows, error: null }),
    };
    return q;
  };
  return { client: { from, storage: { from: () => ({ createSignedUrl: async () => ({ error: { message: "none" } }) }) } }, writes };
}

const CO = "co-1";
const H = 3600e3;
const MIN = 60e3;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const piece = (id: string, name: string, serial: string, unit: string | null, extra: Row = {}): Row => ({
  id, company_id: CO, name, identifier: serial, unit_id: unit, yard_id: "y1", status: "in_service", category: "flow_iron", out_since: null,
  tag_token: `tag-${id}`, nfc_uid: null, out_loadout_id: null, out_with_user: null, out_with_name: null, redress_each_run: false, needs_redress_since: null,
  scanned_at: null, scanned_by: null, scanned_unit_id: null, last_seen_where: null, last_seen_by: null, last_seen_at: null, ...extra,
});
const test = (assetId: string): Row => ({
  id: `it-${assetId}`, company_id: CO, parent_type: "asset", parent_id: assetId, title: "UT + hydro recert",
  expiration_date: "2099-01-01", reminder_days: 30, pending_until: null, last_upload_id: `up-${assetId}`,
});
const silverFox = (id: string, serial: string, extra: Row = {}) => piece(id, "Silver Fox setting tool", serial, null, { category: "tools", ...extra });

/** CT-01 in Odessa with a kit of one plug valve and a valve on it; CT-06 parked next to it. */
function yard(extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    saas_units: [{ id: "ct1", company_id: CO, name: "CT-01", yard_id: "y1" }, { id: "ct5", company_id: CO, name: "CT-05", yard_id: "y1" }, { id: "ct6", company_id: CO, name: "CT-06", yard_id: "y1" }],
    saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }, { id: "y2", company_id: CO, name: "Hobbs Yard" }],
    saas_enforcement_settings: [{ company_id: CO, require_loadout_photo: false, require_tag_scan: false }],
    saas_packages: [{ id: "kit1", company_id: CO, unit_id: "ct1", name: "CT-01 kit", roll_checks: [] }],
    saas_package_lines: [{ package_id: "kit1", label: "2in 1502 plug valve", qty: 1, sort: 1 }],
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1")],
    saas_compliance_items: [test("pv1")],
    saas_loadout_scans: [], saas_returns: [], saas_loadout_overrides: [], saas_loadout_plans: [], saas_signouts: [], saas_events: [],
    ...extra,
  } as Record<string, Row[]>;
}
function run(tables: Record<string, Row[]>) {
  const db = fakeDb(tables);
  dbHolder.current = db.client;
  return db;
}
const assetUpdates = (w: Write[]) => w.filter((x) => x.table === "saas_assets" && x.kind === "update");
const touches = (w: Write, id: string) => JSON.stringify(w.filters).includes(`"${id}"`);
const record = (w: Write[]) => w.find((x) => x.table === "saas_loadout_scans" && x.kind === "insert")?.payload;
type Input = Parameters<typeof finishLoadout>[0];
const base = (over: Partial<Input> = {}): Input => ({
  unitId: "ct1", startedAt: ago(10 * MIN), scans: [{ assetId: "pv1", how: "hand", at: Date.now() - 5 * MIN }], notScanned: [], ...over,
});
const withPv1 = (...more: Input["scans"]): Input["scans"] => [{ assetId: "pv1", how: "hand", at: Date.now() - 5 * MIN }, ...more];

beforeEach(() => { vi.clearAllMocks(); });

describe("a piece on another truck's open trip (CT-05 came back without a check-in)", () => {
  const t = () => yard({
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
      piece("pv50", "2in 1502 plug valve", "PV-2250", "ct5", { out_since: ago(26 * H), out_loadout_id: "lo-ct5" })],
    saas_compliance_items: [test("pv1"), test("pv50")],
    saas_loadout_scans: [{ id: "lo-ct5", company_id: CO, unit_id: "ct5", unit_name: "CT-05", scanned_by: "Manuel Ortega", scanned_by_user: "manuel",
      started_at: ago(26.2 * H), finished_at: ago(26 * H), verdict: "ready", pieces: [], not_scanned: [] }],
  });
  it("blocks, and the reason says the one step that clears it", async () => {
    run(t());
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "pv50", how: "hand", at: Date.now() - 3 * MIN }) }));
    expect(res.verdict).toBe("not_ready");
    expect(res.reasons).toHaveLength(1);
    expect(res.reasons![0]).toMatch(/, and CT-05 hasn't been checked in\. If it's here, check CT-05 in or use Move it on the piece, then scan it again$/);
    expect(res.notMoved).toEqual(["pv50"]);
    expect(res.notMovedWhy).toEqual({ pv50: "out_on_job" });
  });
  it("the phone hears it at the scan, not 'it goes on when you finish'", () => {
    const p: ScanPiece = { id: "pv50", name: "2in 1502 plug valve", serial: "PV-2250", unitId: "ct5", where: "CT-05 · Odessa Yard", category: "flow_iron",
      tagKey: "k", extKey: null, problem: null, statusText: "ok", out: true, trip: { truck: "CT-05", sinceText: "Nov 8, 5:02 AM", by: "Manuel Ortega" } };
    const m = scanMessage({ kind: "match", piece: p, onTruck: false }, "CT-06", false);
    expect(m.tone).toBe("bad");
    expect(m.text).toBe("2in 1502 plug valve PV-2250 is on CT-05's job from Nov 8, 5:02 AM, and CT-05 hasn't been checked in. Check CT-05 in first, or use Move it on the piece. Until then it blocks CT-06.");
    // On its own truck, its trip is no problem.
    expect(scanMessage({ kind: "match", piece: { ...p, unitId: "ct6" }, onTruck: true }, "CT-06", false).tone).toBe("good");
  });
});

describe("the scan page knows a piece's open trip and its sign-out", () => {
  it("by the server's rule: the truck's newest load-out, no check-in since", async () => {
    run({
      saas_assets: [
        piece("pv50", "2in 1502 plug valve", "PV-2250", "ct5", { out_since: ago(26 * H), out_loadout_id: "lo-ct5" }),
        piece("pv60", "2in 1502 plug valve", "PV-2260", "ct6", { out_since: ago(50 * H), out_loadout_id: "lo-ct6" }),
        silverFox("sf2", "SF-102", { out_since: ago(9 * 24 * H), out_with_user: "dale", out_with_name: "Dale Wooten" }),
        silverFox("sf1", "SF-101", { out_since: ago(1 * H), out_with_user: "ray", out_with_name: "Ray Hinojosa" }),
      ],
      saas_units: [{ id: "ct5", company_id: CO, name: "CT-05", yard_id: "y1" }, { id: "ct6", company_id: CO, name: "CT-06", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_compliance_items: [],
      saas_loadout_latest: [{ id: "lo-ct5", company_id: CO, unit_id: "ct5", finished_at: ago(26 * H), scanned_by: "Manuel Ortega" },
        { id: "lo-ct6", company_id: CO, unit_id: "ct6", finished_at: ago(50 * H), scanned_by: "Ray" }],
      // CT-06 was checked in after it rolled: its trip is over.
      saas_return_latest: [{ company_id: CO, unit_id: "ct6", finished_at: ago(20 * H) }],
    });
    const { pieces } = await getScanPieces(dbHolder.current as never, CO);
    const by = new Map(pieces.map((p) => [p.id, p]));
    expect(by.get("pv50")!.trip).toMatchObject({ truck: "CT-05", by: "Manuel Ortega" });
    expect(by.get("pv60")!.trip).toBeNull();
    expect(by.get("sf2")!.outWith).toMatchObject({ name: "Dale Wooten", long: true });
    expect(by.get("sf1")!.outWith).toMatchObject({ name: "Ray Hinojosa", long: false });
  });
});

describe("a piece scanned onto another truck after this phone scanned it", () => {
  const t = () => yard({
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
      piece("pv9", "Pup joint 2in 10ft", "PJ-9", "ct6", { scanned_unit_id: "ct6", scanned_at: ago(3 * MIN), scanned_by: "Lupe Cardenas" })],
    saas_compliance_items: [test("pv1"), test("pv9")],
  });
  it("blocks with who scanned it where, and stays on that truck", async () => {
    const db = run(t());
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "pv9", how: "hand", at: Date.now() - 8 * MIN }) }));
    expect(res.verdict).toBe("not_ready");
    expect(res.reasons).toHaveLength(1);
    expect(res.reasons![0]).toMatch(/^Scanned onto another truck after you: Pup joint 2in 10ft PJ-9, onto CT-06 .+ by Lupe Cardenas\. If it's really on CT-01, scan it again$/);
    expect(res.badIds).toEqual(["pv9"]);
    expect(res.notMovedWhy).toEqual({ pv9: "scanned_since" });
    for (const w of assetUpdates(db.writes)) expect(touches(w, "pv9")).toBe(false);
  });
  it("a fresh scan after that clears it", async () => {
    const db = run(t());
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "pv9", how: "hand", at: Date.now() - 1 * MIN }) }));
    expect(res).toMatchObject({ verdict: "ready", reasons: [] });
    expect(assetUpdates(db.writes).some((w) => w.payload.unit_id === "ct1" && touches(w, "pv9"))).toBe(true);
  });
});

describe("a tool signed out to someone", () => {
  it("out 9 days with Dale and only tapped on by hand: blocks, and Dale's sign-out stays open", async () => {
    const db = run(yard({
      saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
        silverFox("sf2", "SF-102", { out_since: ago(9 * 24 * H), out_with_user: "dale", out_with_name: "Dale Wooten", redress_each_run: true })],
    }));
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "sf2", how: "hand", at: Date.now() - 3 * MIN }) }));
    expect(res.verdict).toBe("not_ready");
    expect(res.reasons).toEqual([expect.stringMatching(/^Signed out: Silver Fox setting tool SF-102, with Dale Wooten since .+\. If it's here, check it in or use Move it on the piece, then scan it again$/)]);
    expect(res.notMovedWhy).toEqual({ sf2: "signed_out" });
    expect(db.writes.filter((w) => w.table === "saas_signouts")).toEqual([]);
    for (const w of assetUpdates(db.writes)) expect(touches(w, "sf2")).toBe(false);
  });
  it("scanned off its own tag, it's back from its run (redress), not a signed-out block", async () => {
    run(yard({
      saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
        silverFox("sf2", "SF-102", { out_since: ago(9 * 24 * H), out_with_user: "dale", out_with_name: "Dale Wooten", redress_each_run: true })],
    }));
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "sf2", how: "nfc", proof: "tag-sf2", at: Date.now() - 3 * MIN }) }));
    expect(res.reasons).toEqual(["Needs redress: Silver Fox setting tool SF-102"]);
    expect(res.notMovedWhy).toEqual({});
  });
  const ray = () => yard({
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
      silverFox("sf1", "SF-101", { out_since: ago(1 * H), out_with_user: "ray", out_with_name: "Ray Hinojosa" })],
    saas_packages: [{ id: "kit1", company_id: CO, unit_id: "ct1", name: "CT-01 kit", roll_checks: ["BOP rams closed for travel"] }],
  });
  it("signed out this morning and touched by a NOT READY try: not put on the truck, still Ray's", async () => {
    const db = run(ray());
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "sf1", how: "hand", at: Date.now() - 3 * MIN }) }));
    expect(res.reasons).toEqual(["Not confirmed: BOP rams closed for travel"]);
    expect(res.notMoved).toEqual(["sf1"]);
    expect(res.notMovedWhy).toEqual({ sf1: "signed_out_until_ready" });
    expect(res.badIds).toEqual([]);
    for (const w of assetUpdates(db.writes)) expect(touches(w, "sf1")).toBe(false);
    expect(db.writes.filter((w) => w.table === "saas_signouts")).toEqual([]);
  });
  it("the same tool on a READY save goes on the truck and off Ray's sign-out", async () => {
    const db = run(ray());
    const res = await finishLoadout(base({ scans: withPv1({ assetId: "sf1", how: "hand", at: Date.now() - 3 * MIN }), checks: [{ label: "BOP rams closed for travel", at: Date.now() - MIN }] }));
    expect(res.verdict).toBe("ready");
    expect(res.notMoved).toEqual([]);
    expect(assetUpdates(db.writes).some((w) => w.payload.unit_id === "ct1" && touches(w, "sf1"))).toBe(true);
    expect(db.writes.find((w) => w.table === "saas_signouts")!.payload).toMatchObject({ back_note: "went out on CT-01" });
  });
  it("logged on the truck but answered Not going this trip: off the truck, the sign-out and its clock stay", async () => {
    const db = run(yard({
      saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
        silverFox("sf1", "SF-101", { unit_id: "ct1", out_since: ago(1 * H), out_with_user: "ray", out_with_name: "Ray Hinojosa" })],
    }));
    const res = await finishLoadout(base({ notScanned: [{ assetId: "sf1", outcome: "yard" }] }));
    expect(res.verdict).toBe("ready");
    expect(assetUpdates(db.writes).filter((w) => touches(w, "sf1")).map((w) => w.payload)).toEqual([{ unit_id: null }]);
    expect(db.writes.filter((w) => w.table === "saas_signouts")).toEqual([]);
  });
});

describe("iron taken off stays in the yard the load-out started in", () => {
  // A manager moved CT-01 to Hobbs while the hand was loading it in Odessa.
  const t = () => yard({
    saas_units: [{ id: "ct1", company_id: CO, name: "CT-01", yard_id: "y2" }],
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1", { yard_id: "y2" }), piece("pv7", "2in 1502 plug valve", "PV-2207", "ct1", { yard_id: "y2" })],
    saas_compliance_items: [test("pv1"), test("pv7")],
  });
  it("the phone's yard, when it's one of the company's", async () => {
    const db = run(t());
    await finishLoadout(base({ notScanned: [{ assetId: "pv7", outcome: "yard" }], yardId: "y1" }));
    expect(assetUpdates(db.writes).find((w) => touches(w, "pv7") && "yard_id" in w.payload)!.payload.yard_id).toBe("y1");
  });
  it("the truck's yard, when the phone sends someone else's", async () => {
    const db = run(t());
    await finishLoadout(base({ notScanned: [{ assetId: "pv7", outcome: "yard" }], yardId: "y-other-company" }));
    expect(assetUpdates(db.writes).find((w) => touches(w, "pv7") && "yard_id" in w.payload)!.payload.yard_id).toBe("y2");
  });
});

describe("the answer carries every package's list as the server checked it", () => {
  it("lines and checks, a package made after the screen opened too", async () => {
    run(yard({
      saas_packages: [{ id: "kit1", company_id: CO, unit_id: "ct1", name: "CT-01 kit", roll_checks: [] },
        { id: "pd", company_id: CO, unit_id: null, name: "Pump-down package", roll_checks: ["Everything strapped and padded"] }],
      saas_package_lines: [{ package_id: "kit1", label: "2in 1502 plug valve", qty: 1, sort: 1 }, { package_id: "pd", label: "Lubricator", qty: 1, sort: 1 }],
    }));
    const res = await finishLoadout(base({ packageIds: ["pd"] }));
    expect(res.packageLists).toEqual([{ id: "pd", name: "Pump-down package", lines: [{ label: "Lubricator", qty: 1 }], checks: ["Everything strapped and padded"] }]);
  });
});

describe("plans the load-out wasn't checked against", () => {
  const plan = (leaves: number) => ({ id: "plan9", company_id: CO, unit_id: "ct1", package_ids: [], lines: [], note: null, job: "University 7-12 #3H",
    planned_by: "Kevin Odom", created_at: ago(5 * 24 * H), leaves_at: new Date(Date.now() + leaves).toISOString(), used_at: null });
  it("an old one (more than a day past its leave time) is used up when the truck rolls", async () => {
    const db = run(yard({ saas_loadout_plans: [plan(-3 * 24 * H)] }));
    const res = await finishLoadout(base());
    expect(res.verdict).toBe("ready");
    const u = db.writes.find((w) => w.table === "saas_loadout_plans" && w.kind === "update")!;
    expect(u.filters.id).toEqual(["plan9"]);
    expect(u.payload).toMatchObject({ used_loadout_id: "lo-new" });
  });
  it("a later one stays open, and the feed says it wasn't part of it", async () => {
    const db = run(yard({ saas_loadout_plans: [plan(3 * 24 * H)] }));
    const res = await finishLoadout(base());
    expect(res.verdict).toBe("ready");
    expect(db.writes.filter((w) => w.table === "saas_loadout_plans")).toEqual([]);
    expect(vi.mocked(logEvent).mock.calls[0][0].message).toMatch(/^CT-01 loaded out READY by Beau Slaughter: 1 piece scanned\. The plan for .+ wasn't part of it and stays open$/);
  });
});

describe("a red tag taken off in the last day", () => {
  it("goes on the record with who took it off, when and why", async () => {
    const db = run(yard({ saas_events: [{ company_id: CO, kind: "asset_status", actor: "Kevin Odom", created_at: ago(2 * H),
      message: "Kevin Odom took the red tag off 2in 1502 plug valve PV-2201: \"Replaced the seals and retested to 15,000\"" }] }));
    const res = await finishLoadout(base());
    expect(res.verdict).toBe("ready");
    const p = (record(db.writes)!.pieces as Row[])[0];
    expect(p.red_tag_off).toMatchObject({ by: "Kevin Odom", note: "Replaced the seals and retested to 15,000" });
  });
  it("never from a piece's own note: anyone on the crew can type that, so it can't put a manager's name on the record", async () => {
    const tagged = (at: string) => yard({ saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1", { last_seen_where: "red tag off: New seats in the valve", last_seen_by: "Kevin Odom", last_seen_at: at })] });
    const db = run(tagged(ago(3 * H)));
    await finishLoadout(base());
    expect((record(db.writes)!.pieces as Row[])[0].red_tag_off).toBeUndefined();
  });
  it("only for a piece with a serial: a name alone could be any of four", async () => {
    const db = run(yard({
      saas_assets: [piece("sb2", "Sinker bar", "", "ct1", { identifier: null })],
      saas_events: [{ company_id: CO, kind: "asset_status", actor: "Kevin Odom", created_at: ago(2 * H), message: "Kevin Odom took the red tag off Sinker bar: \"replaced the fishing neck\"" }],
    }));
    await finishLoadout(base());
    const p = (record(db.writes)!.pieces as Row[]).find((x) => x.asset_id === "sb2");
    expect(p?.red_tag_off).toBeUndefined();
  });
});

describe("kit lines keep numbers as typed", () => {
  it("a thousands comma isn't a break between parts", () => {
    expect(pieceKind("Frac valve 4-1/16in 15,000 psi")).toBe("Frac valve 4-1/16in 15,000 psi");
    expect(pieceKind("Lubricator 10,000 psi")).toBe("Lubricator 10,000 psi");
    expect(pieceKind("Frac valve 7-1/16in 10,000 psi, CT-01", ["CT-01"])).toBe("Frac valve 7-1/16in 10,000 psi");
    // A reel still comes out by kind.
    expect(pieceKind("Reel R-1, 2-3/8in, 16,400 ft", ["R-1"])).toBe("Reel, 2-3/8in");
    expect(kitLinesFrom([{ name: "Lubricator 10,000 psi", serial: "LB-1" }], ["CT-01"])).toEqual([{ label: "Lubricator 10,000 psi", qty: 1 }]);
  });
  it("migration 0040 sets a number's comma aside and only rewrites a line something came out of", () => {
    const sql = readFileSync(join(__dirname, "../../../supabase/migrations/0040_loadout_record_paper_and_kit_kinds.sql"), "utf8");
    expect(sql).toContain("continue when cleaned = l.label;");
    expect(sql).toContain("'([0-9]),([0-9]{3})([^0-9]|$)'");
    expect(sql).toContain("position(lower(trim(a.identifier)) in lower(a.name)) > 0");
  });
});

describe("kits made from a truck are by kind", () => {
  it("kitFromTruck takes out the truck's name and each piece's serial", async () => {
    const db = run({
      saas_packages: [{ id: "kitp1", company_id: CO, unit_id: "p1", name: "P-01 kit" }],
      saas_units: [{ id: "p1", company_id: CO, name: "P-01", yard_id: "y1" }],
      saas_assets: [piece("fe1", "Fluid end, P-01", "FE-201", "p1"), piece("rl1", "Reel R-1, 2-3/8in, 16,400 ft", "R-1", "p1")],
    });
    const fd = new FormData();
    fd.set("unit_id", "p1");
    await kitFromTruck(fd);
    const ins = db.writes.find((w) => w.table === "saas_package_lines" && w.kind === "insert")!;
    expect((ins.payload as unknown as Row[]).map((l) => l.label)).toEqual(["Fluid end", "Reel, 2-3/8in"]);
  });
  it("the marketing shot's kit is the seeded demo kit", () => {
    for (const u of DEMO_UNITS) expect(demoKitAndPackages(u.key).kit).toEqual(demoKitLines(u));
  });
});

describe("new reasons read in plain words", () => {
  it("signed out, and scanned onto another truck after you", () => {
    const v = loadoutVerdict({ lines: [], cantFind: [], truckPaper: [], scanned: 2, bad: [
      { name: "Silver Fox setting tool", serial: "SF-102", why: "signed_out", detail: "with Dale Wooten since Nov 3, 6:10 AM" },
      { name: "Pup joint", serial: "PJ-9", why: "scanned_since", detail: "onto CT-06 Nov 9, 6:03 AM by Lupe Cardenas" },
    ] });
    expect(v.reasons).toEqual(["Signed out: Silver Fox setting tool SF-102, with Dale Wooten since Nov 3, 6:10 AM",
      "Scanned onto another truck after you: Pup joint PJ-9, onto CT-06 Nov 9, 6:03 AM by Lupe Cardenas"]);
  });
  it("the phone: a long sign-out tapped by hand is red, by its tag or a short one is a heads-up", () => {
    const p: ScanPiece = { id: "sf2", name: "Silver Fox setting tool", serial: "SF-102", unitId: null, where: "With Dale Wooten", category: "tools",
      tagKey: "k", extKey: null, problem: null, statusText: "ok", out: true, outWith: { name: "Dale Wooten", sinceText: "Nov 3, 6:10 AM", long: true } };
    expect(scanMessage({ kind: "match", piece: p, onTruck: false }, "CT-04", false)).toEqual({ tone: "bad",
      text: "Silver Fox setting tool SF-102 is signed out to Dale Wooten since Nov 3, 6:10 AM. If it's here, check it in or use Move it on the piece first. Until then it blocks CT-04." });
    expect(scanMessage({ kind: "match", piece: p, onTruck: false, proof: "tag" }, "CT-04", false).tone).toBe("warn");
    expect(scanMessage({ kind: "match", piece: { ...p, outWith: { ...p.outWith!, long: false } }, onTruck: false }, "CT-04", false)).toEqual({ tone: "warn",
      text: "Silver Fox setting tool SF-102 is signed out to Dale Wooten. It goes on CT-04, and off Dale Wooten's sign-out, once CT-04 rolls READY." });
  });
});

describe("migration 0050 changes only the two feed lines", () => {
  const fn = (file: string) => {
    const sql = readFileSync(join(__dirname, "../../../supabase/migrations", file), "utf8");
    const start = sql.indexOf("create or replace function saas_assets_guard()");
    return sql.slice(start, sql.indexOf("end $$;", start) + "end $$;".length);
  };
  it("the serial on a status line, and a missing piece reads as missing, nothing else", () => {
    const before = fn("0024_redress_signouts_roll_checks.sql");
    const after = fn("0050_feed_names_the_piece.sql");
    expect(after).toContain("format('%s%s marked %s (was %s)', new.name, coalesce(' ' || new.identifier, ''),");
    expect(after).toContain("didn''t come back on %s (flagged missing)");
    expect(after).toContain("wasn''t found for the %s load-out (flagged missing)");
    const lines = (s: string) => s.split("\n");
    const removed = lines(before).filter((l) => !lines(after).includes(l));
    expect(removed).toEqual([
      "      format('%s marked %s (was %s)', new.name,",
      "      format('%s moved from %s to %s', new.name, coalesce(old_unit, 'the yard'), coalesce(new_unit, 'the yard')),",
    ]);
  });
});
