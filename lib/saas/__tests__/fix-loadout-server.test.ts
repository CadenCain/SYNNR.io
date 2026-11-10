import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Load-out rules on the server, from the busy-week findings. Run against the
 * REAL finishLoadout (app/app/units/[unitId]/scan/actions.ts) on an in-memory
 * database, plus the pure kit and demo helpers:
 *   - A draft picked back up off a dead phone after someone else loaded the
 *     truck out (or after it rolled) is refused as stale, and so is one too
 *     old to ever save.
 *   - A load-out on a truck that's out on a job is refused until the hand
 *     says it's back in the yard.
 *   - A piece flagged missing comes off the truck: the honest answer doesn't
 *     block every retry, and an old flag never turns into "stays in the yard".
 *   - A piece out on another truck's open trip blocks this truck and isn't
 *     moved onto it.
 *   - The record keeps all of the truck's own paper, and when the hand tapped
 *     Save on the phone; the out clock starts then.
 *   - The answer carries the plan, kit and checks as the server checked them.
 *   - Kit lines name the kind of piece, not the one piece or its truck.
 *   - Demo records carry the roll checks their kits ask for.
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
}));
const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({
  saasDb: async () => dbHolder.current,
  saasAdmin: () => dbHolder.current,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { finishLoadout } from "@/app/app/units/[unitId]/scan/actions";
import { kitLinesFrom, pieceKind, lineMatches, fillLines, expectedLines, shortLines, loadoutVerdict } from "../loadout-lines";
import { DEMO_LOADOUTS, DEMO_UNITS } from "../demo-data";
import { demoLoadoutRecord, demoKitLines } from "../demo-loadouts";

type Row = Record<string, unknown>;
interface Write { table: string; kind: "insert" | "update" | "delete"; payload: Row; filters: Record<string, unknown> }

/** Just enough PostgREST for finishLoadout: filters filter, order and limit work, writes are captured. */
function fakeDb(tables: Record<string, Row[]>, opts: { noNewCols?: boolean } = {}) {
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
      then: <T>(res: (v: { data: unknown; error: { code: string; message: string } | null }) => T) => {
        if (write?.kind === "insert" && opts.noNewCols && ("truck_paper" in write.payload || "phone_saved_at" in write.payload)) {
          return res({ data: null, error: { code: "PGRST204", message: "Could not find the 'truck_paper' column" } });
        }
        return res(write
          ? { data: single ? { id: "lo-new", proof_token: "tok-new", ...write.payload } : write.payload, error: null }
          : { data: single ? rows[0] ?? null : rows, error: null });
      },
    };
    return q;
  };
  return { client: { from, storage: { from: () => ({ createSignedUrl: async () => ({ error: { message: "none" } }) }) } }, writes };
}

const CO = "co-1";
const H = 3600e3;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const piece = (id: string, name: string, serial: string, unit: string | null, extra: Row = {}): Row => ({
  id, company_id: CO, name, identifier: serial, unit_id: unit, yard_id: "y1", status: "in_service", category: "flow_iron", out_since: null,
  tag_token: `tag-${id}`, nfc_uid: null, out_loadout_id: null, out_with_user: null, out_with_name: null, redress_each_run: false, needs_redress_since: null, ...extra,
});
const test = (assetId: string, extra: Row = {}): Row => ({
  id: `it-${assetId}`, company_id: CO, parent_type: "asset", parent_id: assetId, title: "UT + hydro recert",
  expiration_date: "2099-01-01", reminder_days: 30, pending_until: null, last_upload_id: `up-${assetId}`, ...extra,
});

/** CT-01 in Odessa, a kit of one plug valve, and a valve on it. Photo rule off so the reasons are only the ones under test. */
function yard(extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    saas_units: [{ id: "ct1", company_id: CO, name: "CT-01", yard_id: "y1" }, { id: "ct5", company_id: CO, name: "CT-05", yard_id: "y1" }],
    saas_enforcement_settings: [{ company_id: CO, require_loadout_photo: false, require_tag_scan: false }],
    saas_packages: [{ id: "kit1", company_id: CO, unit_id: "ct1", name: "CT-01 kit", roll_checks: [] }],
    saas_package_lines: [{ package_id: "kit1", label: "2in 1502 plug valve", qty: 1, sort: 1 }],
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1")],
    saas_compliance_items: [test("pv1")],
    saas_loadout_scans: [], saas_returns: [], saas_loadout_overrides: [], saas_loadout_plans: [], saas_signouts: [],
    ...extra,
  } as Record<string, Row[]>;
}
function run(tables: Record<string, Row[]>, opts?: { noNewCols?: boolean }) {
  const db = fakeDb(tables, opts);
  dbHolder.current = db.client;
  return db;
}
const assetUpdates = (w: Write[]) => w.filter((x) => x.table === "saas_assets" && x.kind === "update");
const record = (w: Write[]) => w.find((x) => x.table === "saas_loadout_scans" && x.kind === "insert")?.payload;
const base = (over: Partial<Parameters<typeof finishLoadout>[0]> = {}) => ({
  unitId: "ct1", startedAt: ago(10 * 60e3), scans: [{ assetId: "pv1", how: "hand" as const, at: Date.now() - 5 * 60e3 }], notScanned: [], ...over,
});

beforeEach(() => { vi.clearAllMocks(); });

describe("a dead phone's old draft", () => {
  it("is refused as stale after someone else loaded the truck out, and nothing moves", async () => {
    const db = run(yard({ saas_loadout_scans: [{ id: "lo-m", company_id: CO, unit_id: "ct1", scanned_by: "Manuel Ortega", scanned_by_user: "manuel",
      started_at: ago(13 * H), finished_at: ago(12.6 * H), verdict: "ready", pieces: [], not_scanned: [] }] }));
    const res = await finishLoadout(base({ startedAt: ago(13.25 * H) }));
    expect(res.ok).toBe(false);
    expect(res.stale).toBe(true);
    expect(res.error).toMatch(/^Manuel Ortega already loaded CT-01 out .+\. This one can't be saved\./);
    expect(record(db.writes)).toBeUndefined();
    expect(assetUpdates(db.writes)).toEqual([]);
  });
  it("is refused as stale when it's too old to ever save, so the phone stops retrying", async () => {
    run(yard());
    const res = await finishLoadout(base({ startedAt: ago(21 * H) }));
    expect(res).toMatchObject({ ok: false, stale: true });
  });
  it("still saves over the hand's own NOT READY try since (same hand, same truck, not rolled)", async () => {
    const db = run(yard({ saas_loadout_scans: [{ id: "lo-b", company_id: CO, unit_id: "ct1", scanned_by: "Beau Slaughter", scanned_by_user: "beau",
      started_at: ago(9 * 60e3), finished_at: ago(2 * 60e3), verdict: "not_ready", pieces: [], not_scanned: [] }] }));
    const res = await finishLoadout(base());
    expect(res.ok).toBe(true);
    expect(record(db.writes)).toBeDefined();
  });
  it("still saves when the only thing since it started is a check-in by a helper", async () => {
    const db = run(yard({ saas_returns: [{ id: "r1", company_id: CO, unit_id: "ct1", finished_at: ago(5 * 60e3) }] }));
    const res = await finishLoadout(base());
    expect(res.ok).toBe(true);
    expect(record(db.writes)).toBeDefined();
  });
});

describe("a truck that's out on a job", () => {
  const outTruck = () => yard({ saas_loadout_scans: [{ id: "lo-oct31", company_id: CO, unit_id: "ct1", scanned_by: "Manuel Ortega", scanned_by_user: "manuel",
    started_at: ago(11 * 24 * H + 600e3), finished_at: ago(11 * 24 * H), verdict: "ready", pieces: [], not_scanned: [] }] });
  it("isn't loaded out until the hand says it's back in the yard", async () => {
    const db = run(outTruck());
    const res = await finishLoadout(base());
    expect(res.ok).toBe(false);
    expect(res.stale).toBeFalsy();
    expect(res.truckOut).toMatchObject({ by: "Manuel Ortega" });
    expect(res.error).toMatch(/^CT-01 is out on a job since .+, loaded by Manuel Ortega\. Only load it out once it's back in the yard\.$/);
    expect(record(db.writes)).toBeUndefined();
    expect(assetUpdates(db.writes)).toEqual([]);
  });
  it("loads out once the hand says it's back", async () => {
    const db = run(outTruck());
    const res = await finishLoadout(base({ backInYard: true }));
    expect(res).toMatchObject({ ok: true, verdict: "ready" });
    expect(record(db.writes)).toBeDefined();
  });
  it("is out on a manager's override too, and back once it's checked in", async () => {
    const t = yard({
      saas_loadout_scans: [{ id: "lo-nr", company_id: CO, unit_id: "ct1", scanned_by: "Ray", scanned_by_user: "ray", started_at: ago(30 * H), finished_at: ago(29 * H), verdict: "not_ready", pieces: [], not_scanned: [] }],
      saas_loadout_overrides: [{ company_id: CO, loadout_id: "lo-nr", created_at: ago(28.5 * H) }],
    });
    run(t);
    expect((await finishLoadout(base())).truckOut).toBeTruthy();
    run({ ...t, saas_returns: [{ id: "r1", company_id: CO, unit_id: "ct1", finished_at: ago(2 * H) }] });
    expect((await finishLoadout(base())).ok).toBe(true);
  });
});

describe("a piece nobody can find", () => {
  it("answered Can't find: blocks this save, and comes off the truck so the next one doesn't ask", async () => {
    const t = yard({ saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"), piece("pv7", "2in 1502 plug valve", "PV-2207", "ct1")],
      saas_compliance_items: [test("pv1"), test("pv7")] });
    const db = run(t);
    const res = await finishLoadout(base({ notScanned: [{ assetId: "pv7", outcome: "missing" }] }));
    expect(res.verdict).toBe("not_ready");
    expect(res.reasons).toEqual(["Can't find: 2in 1502 plug valve PV-2207"]);
    const u = assetUpdates(db.writes).find((w) => w.filters.id === "pv7")!;
    expect(u.payload).toMatchObject({ status: "missing", unit_id: null });
    expect(String(u.payload.last_seen_where)).toMatch(/^not found for CT-01 load-out/);
  });
  it("already flagged missing (at a check-in): no false 'stays in the yard', no block, off the truck", async () => {
    const t = yard({ saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
      piece("pv7", "2in 1502 plug valve", "PV-2207", "ct1", { status: "missing", last_seen_where: "didn't come back on CT-07, Nov 13" })],
      saas_compliance_items: [test("pv1"), test("pv7")] });
    for (const outcome of ["yard", "missing"] as const) {
      const db = run(t);
      const res = await finishLoadout(base({ notScanned: [{ assetId: "pv7", outcome }] }));
      expect(res).toMatchObject({ ok: true, verdict: "ready", reasons: [] });
      const u = assetUpdates(db.writes).filter((w) => w.filters.id === "pv7");
      expect(u.map((w) => w.payload)).toEqual([{ unit_id: null }]);
      expect((record(db.writes)!.not_scanned as Row[])).toEqual([{ asset_id: "pv7", name: "2in 1502 plug valve", serial: "PV-2207", outcome: "missing" }]);
    }
  });
});

describe("a piece out on another truck's job", () => {
  const t = (back = false) => yard({
    saas_assets: [piece("pv1", "2in 1502 plug valve", "PV-2201", "ct1"),
      piece("pv50", "2in 1502 plug valve", "PV-2250", "ct5", { out_since: ago(13 * 60e3), out_loadout_id: "lo-ct5" })],
    saas_compliance_items: [test("pv1"), test("pv50")],
    saas_loadout_scans: [{ id: "lo-ct5", company_id: CO, unit_id: "ct5", unit_name: "CT-05", scanned_by: "Manuel Ortega", scanned_by_user: "manuel",
      started_at: ago(20 * 60e3), finished_at: ago(13 * 60e3), verdict: "ready", pieces: [], not_scanned: [] }],
    saas_returns: back ? [{ id: "r5", company_id: CO, unit_id: "ct5", finished_at: ago(60e3) }] : [],
  });
  it("blocks this truck, names the trip, and stays on that truck", async () => {
    const db = run(t());
    const res = await finishLoadout(base({ startedAt: ago(8 * 60e3), scans: [{ assetId: "pv1", how: "hand", at: Date.now() - 4 * 60e3 }, { assetId: "pv50", how: "hand", at: Date.now() - 3 * 60e3 }] }));
    expect(res.verdict).toBe("not_ready");
    expect(res.reasons).toHaveLength(1);
    expect(res.reasons![0]).toMatch(/^Out on another truck's job: 2in 1502 plug valve PV-2250, went out on CT-05 .+, loaded by Manuel Ortega, and CT-05 hasn't been checked in\. If it's here, check CT-05 in or use Move it on the piece, then scan it again$/);
    expect(res.badIds).toEqual(["pv50"]);
    expect(res.notMoved).toEqual(["pv50"]);
    // Neither moved onto CT-01 nor taken off CT-05's trip.
    expect(assetUpdates(db.writes).length).toBeGreaterThan(0);
    for (const w of assetUpdates(db.writes)) expect(JSON.stringify(w.filters)).not.toContain("pv50");
  });
  it("is fine once that truck has been checked in (it came back some other way)", async () => {
    run(t(true));
    const res = await finishLoadout(base({ startedAt: ago(8 * 60e3), scans: [{ assetId: "pv1", how: "hand", at: Date.now() - 4 * 60e3 }, { assetId: "pv50", how: "hand", at: Date.now() - 3 * 60e3 }] }));
    expect(res.reasons).toEqual([]);
  });
});

describe("what the record keeps", () => {
  const paper = (extra: Row = {}): Row => ({ id: "dot", company_id: CO, parent_type: "unit", parent_id: "ct1", title: "Annual DOT inspection",
    expiration_date: "2099-11-10", reminder_days: 30, pending_until: null, last_upload_id: "up-dot", ...extra });
  it("all of the truck's own paper, and a DOT on 'cert on the way' says so", async () => {
    const db = run(yard({ saas_compliance_items: [test("pv1"), paper({ expiration_date: "2020-01-01", pending_until: "2099-01-01" })] }));
    const res = await finishLoadout(base());
    expect(res.verdict).toBe("ready");
    expect(record(db.writes)!.truck_paper).toEqual([{ title: "Annual DOT inspection", good_until: "2020-01-01", result: "pending", paper: "up-dot" }]);
  });
  it("when the hand tapped Save, and the out clock starts then", async () => {
    const db = run(yard());
    const savedAt = Date.now() - 4.5 * H;
    const res = await finishLoadout(base({ startedAt: ago(5 * H), scans: [{ assetId: "pv1", how: "hand", at: Date.now() - 4.7 * H }], savedAt }));
    expect(res.verdict).toBe("ready");
    expect(record(db.writes)!.phone_saved_at).toBe(new Date(savedAt).toISOString());
    const out = assetUpdates(db.writes).find((w) => w.payload.out_loadout_id === "lo-new")!;
    expect(out.payload.out_since).toBe(new Date(savedAt).toISOString());
  });
  it("a save time from before the load-out started doesn't count", async () => {
    const db = run(yard());
    await finishLoadout(base({ savedAt: Date.now() - 3 * H }));
    expect(record(db.writes)!.phone_saved_at).toBeNull();
  });
  it("saves without the new columns until migration 0040 is in", async () => {
    const db = run(yard(), { noNewCols: true });
    const res = await finishLoadout(base());
    expect(res.ok).toBe(true);
    const inserts = db.writes.filter((w) => w.table === "saas_loadout_scans" && w.kind === "insert");
    expect(inserts).toHaveLength(2);
    expect("truck_paper" in inserts[1].payload).toBe(false);
  });
});

describe("the answer carries the list as the server checked it", () => {
  it("the current plan (after a re-plan), the kit, and the checks", async () => {
    run(yard({
      saas_packages: [{ id: "kit1", company_id: CO, unit_id: "ct1", name: "CT-01 kit", roll_checks: ["BOP rams closed for travel"] },
        { id: "std", company_id: CO, unit_id: null, name: "Standard Coil Package", roll_checks: ["Everything strapped and padded"] },
        { id: "pd", company_id: CO, unit_id: null, name: "Pump-down package", roll_checks: [] }],
      saas_package_lines: [{ package_id: "kit1", label: "2in 1502 plug valve", qty: 1, sort: 1 }, { package_id: "std", label: "Lubricator", qty: 1, sort: 1 }],
      saas_loadout_plans: [{ id: "plan1", company_id: CO, unit_id: "ct1", package_ids: ["std"], lines: [{ label: "Crossover", qty: 1 }], note: null, job: "Mesa 14-2H",
        planned_by: "Kevin Odom", created_at: ago(15 * 60e3), leaves_at: null, used_at: null }],
    }));
    // The phone still has the old plan's package locked on.
    const res = await finishLoadout(base({ packageIds: ["pd"] }));
    expect(res.verdict).toBe("not_ready");
    expect(res.plan).toMatchObject({ id: "plan1", by: "Kevin Odom", job: "Mesa 14-2H", packageIds: ["std"], lines: [{ label: "Crossover", qty: 1 }] });
    expect(res.plan!.atText).toMatch(/\d:\d\d [AP]M$/);
    expect(res.kit).toEqual([{ label: "2in 1502 plug valve", qty: 1 }]);
    expect(res.checks).toEqual(["BOP rams closed for travel", "Everything strapped and padded"]);
  });
});

describe("kit lines name the kind of piece", () => {
  it("not the truck it was on: any good fluid end fills P-01's kit", () => {
    const kit = kitLinesFrom([{ name: "Fluid end, P-01", serial: "FE-201" }], ["P-01"]);
    expect(kit).toEqual([{ label: "Fluid end", qty: 1 }]);
    const filled = fillLines(expectedLines({ kit, packages: [], quick: [] }), [{ id: "fe2", name: "Fluid end, P-02", serial: "FE-202" }]);
    expect(shortLines(filled)).toEqual([]);
  });
  it("not the one reel or what's left on it, but the size stays", () => {
    expect(pieceKind("Reel R-1, 2-3/8in, 16,400 ft", ["R-1"])).toBe("Reel, 2-3/8in");
    expect(lineMatches("Reel, 2-3/8in", "Reel R-2, 2-3/8in, 15,900 ft")).toBe(true);
    expect(lineMatches("Reel, 2-3/8in", "Reel R-4, 2in, 18,000 ft")).toBe(false);
  });
  it("keeps what's part of the kind: a pup joint's length, and a 1502 that happens to be a serial", () => {
    expect(pieceKind("2in 1502 pup joint, 10 ft", ["PJ-3312"])).toBe("2in 1502 pup joint, 10 ft");
    expect(pieceKind("2in 1502 plug valve", ["1502", "2"])).toBe("2in 1502 plug valve");
    expect(pieceKind("Quad BOP stack #3", ["QB-4471", "CT-03"])).toBe("Quad BOP stack");
    expect(pieceKind("P-01", ["P-01"])).toBe("P-01");
  });
  it("plain names with no serials or trucks read as before", () => {
    expect(kitLinesFrom(["Quad BOP stack #3", "Lubricator #1", "Lubricator #2", "Reel R-3"])).toEqual([
      { label: "Quad BOP stack", qty: 1 }, { label: "Lubricator", qty: 2 }, { label: "Reel R-3", qty: 1 },
    ]);
  });
  it("the demo's kits come out by kind", () => {
    expect(demoKitLines(DEMO_UNITS.find((u) => u.name === "P-01")!).map((l) => l.label)).toContain("Fluid end");
    for (const u of DEMO_UNITS) for (const l of demoKitLines(u)) for (const x of DEMO_UNITS) expect(l.label).not.toContain(x.name);
  });
});

describe("a piece out on another truck's job, in plain words", () => {
  it("reads as its own reason", () => {
    const v = loadoutVerdict({ lines: [], bad: [{ name: "2in 1502 plug valve", serial: "PV-2250", why: "out_on_job", detail: "went out on CT-05 Nov 9, 5:02 AM, loaded by Manuel Ortega" }], cantFind: [], truckPaper: [], scanned: 1 });
    expect(v.reasons).toEqual(["Out on another truck's job: 2in 1502 plug valve PV-2250, went out on CT-05 Nov 9, 5:02 AM, loaded by Manuel Ortega"]);
  });
});

describe("demo records carry the roll checks their kits ask for", () => {
  it("every BOP truck's record has the rams check; the verdicts don't change", () => {
    const rec = (key: string) => demoLoadoutRecord(DEMO_LOADOUTS.find((l) => l.unitKey === key)!, "2026-10-14");
    expect(rec("ct2").checks).toEqual(["BOP rams closed for travel"]);
    expect(rec("ct3").checks).toEqual(["BOP rams closed for travel"]);
    expect(rec("p1").checks).toEqual([]);
    expect(rec("ct2").verdict).toBe("ready");
    expect(rec("ct3").verdict).toBe("not_ready");
  });
});
