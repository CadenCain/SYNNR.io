import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Check-in fixes, run against the REAL finishReturn (app/app/return/actions.ts)
 * on an in-memory database:
 *   1. A piece marked "Can't find it" at check-in comes off the truck, stays
 *      flagged missing, and the managers hear about it right away with the
 *      piece, its serial, whose trip it went out on, and who checked it in.
 *   2. Only iron on this truck can be flagged from its check-in.
 *   3. A truck the hand says never left the yard (a yard check) raises no
 *      "never scanned out" flag and calls nothing "still out". Its word is
 *      only taken when there's no load-out since its last check-in.
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
  user: { id: "user-1", email: "tito@example.com", user_metadata: { full_name: "Tito Ramos" } },
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

import { logEvent, notifyEvent } from "../notify";
import { finishReturn } from "@/app/app/return/actions";

type Row = Record<string, unknown>;
interface Write { table: string; kind: "insert" | "update"; payload: Row; filters: Record<string, unknown> }

/** Just enough PostgREST for finishReturn: filters filter, order and limit work, writes are captured. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let write: Write | null = null;
    let single = false;
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { if (write) write.filters[c] = v; else rows = rows.filter((r) => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { if (!write) rows = rows.filter((r) => r[c] !== v); return q; },
      in: (c: string, v: unknown[]) => { if (write) write.filters[c] = v; else rows = rows.filter((r) => v.includes(r[c])); return q; },
      is: (c: string, v: unknown) => { if (write) write.filters[c] = v; else rows = rows.filter((r) => (r[c] ?? null) === v); return q; },
      lt: (c: string, v: string) => { rows = rows.filter((r) => String(r[c] ?? "") < v); return q; },
      gt: (c: string, v: string) => { rows = rows.filter((r) => String(r[c] ?? "") > v); return q; },
      order: (c: string, o?: { ascending?: boolean }) => { rows.sort((a, b) => String(a[c]).localeCompare(String(b[c])) * (o?.ascending === false ? -1 : 1)); return q; },
      limit: (n: number) => { rows = rows.slice(0, n); return q; },
      maybeSingle: () => { single = true; return q; },
      single: () => { single = true; return q; },
      insert: (p: Row) => { write = { table, kind: "insert", payload: p, filters: {} }; writes.push(write); return q; },
      update: (p: Row) => { write = { table, kind: "update", payload: p, filters: {} }; writes.push(write); return q; },
      then: <T>(res: (v: { data: unknown; error: null }) => T) => res(write
        ? { data: single ? { id: "ret-new", ...write.payload } : write.payload, error: null }
        : { data: single ? rows[0] ?? null : rows, error: null }),
    };
    return q;
  };
  return { client: { from }, writes };
}

const CO = "co-1";
const H = 3600e3;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const piece = (id: string, name: string, serial: string, unit: string, extra: Row = {}): Row => ({
  id, company_id: CO, name, identifier: serial, unit_id: unit, yard_id: "y1", status: "in_service", out_since: null, tag_token: `tag-${id}`,
  nfc_uid: null, out_loadout_id: null, out_with_name: null, redress_each_run: false, ...extra,
});

beforeEach(() => {
  vi.mocked(logEvent).mockClear();
  vi.mocked(notifyEvent).mockClear();
});

describe("Can't find it at check-in", () => {
  function ct07() {
    const loaded = ago(3 * 24 * H);
    return fakeDb({
      saas_units: [{ id: "u7", company_id: CO, name: "CT-07", yard_id: "y1" }, { id: "u9", company_id: CO, name: "CT-09", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [
        piece("a-pv", "2in 1502 plug valve", "PV-2207", "u7", { out_since: loaded, out_loadout_id: "lo-1" }),
        piece("a-sw", "2in 1502 Chiksan swivel", "SW-1107", "u7", { out_since: loaded, out_loadout_id: "lo-1" }),
        // A look-alike valve on another truck.
        piece("a-x", "2in 1502 plug valve", "PV-2209", "u9"),
      ],
      saas_loadout_scans: [{ id: "lo-1", company_id: CO, unit_id: "u7", unit_name: "CT-07", scanned_by: "Dale Wooten", finished_at: loaded, verdict: "ready" }],
      saas_returns: [], saas_compliance_items: [], saas_loadout_overrides: [], saas_signouts: [],
    });
  }

  it("takes the lost valve off the truck, keeps it flagged missing, and tells the managers now", async () => {
    const db = ct07();
    dbHolder.current = db.client;
    const res = await finishReturn({
      unitId: "u7", yardId: "y1", startedAt: new Date().toISOString(),
      scans: [{ assetId: "a-sw", how: "hand", to: "truck" }],
      notReturned: [{ assetId: "a-pv", outcome: "missing" }],
    });
    expect(res.ok).toBe(true);

    // Off CT-07, flagged missing, with where it was last.
    const flagged = db.writes.find((w) => w.table === "saas_assets" && w.kind === "update" && w.filters.id === "a-pv");
    expect(flagged?.payload).toMatchObject({ status: "missing", unit_id: null });
    expect(String(flagged?.payload.last_seen_where)).toContain("didn't come back on CT-07");

    // The feed line names it with its serial.
    expect(res.summary).toContain("1 can't be found (2in 1502 plug valve PV-2207)");

    // The alert: piece and serial, the trip it went out on and who loaded it, who checked it in.
    expect(notifyEvent).toHaveBeenCalledTimes(1);
    const alert = vi.mocked(notifyEvent).mock.calls[0][0];
    expect(alert.yardId).toBe("y1");
    expect(alert.href).toBe("/app/assets/a-pv");
    expect(alert.message).toContain("2in 1502 plug valve PV-2207");
    expect(alert.message).toContain("went out on CT-07");
    expect(alert.message).toContain("loaded by Dale Wooten");
    expect(alert.message).toContain("Checked in by Tito Ramos");

    // The record keeps whose trip it went out on, for the morning email.
    const rec = db.writes.find((w) => w.table === "saas_returns" && w.kind === "insert")!;
    const nr = rec.payload.not_returned as { asset_id: string; outcome: string; went_out: { truck?: string; by?: string } | null }[];
    expect(nr).toEqual([expect.objectContaining({ asset_id: "a-pv", outcome: "missing", went_out: expect.objectContaining({ truck: "CT-07", by: "Dale Wooten" }) })]);
  });

  it("only flags iron on this truck: a valve on CT-09 is left alone", async () => {
    const db = ct07();
    dbHolder.current = db.client;
    const res = await finishReturn({
      unitId: "u7", yardId: "y1", startedAt: new Date().toISOString(),
      scans: [{ assetId: "a-sw", how: "hand", to: "truck" }],
      notReturned: [{ assetId: "a-x", outcome: "missing" }],
    });
    expect(res.ok).toBe(true);
    expect(db.writes.some((w) => w.table === "saas_assets" && w.filters.id === "a-x")).toBe(false);
    expect(notifyEvent).not.toHaveBeenCalled();
    const rec = db.writes.find((w) => w.table === "saas_returns" && w.kind === "insert")!;
    expect(rec.payload.not_returned).toEqual([]);
  });

  it("still out on the job sends no alert (the out-too-long clock keeps running)", async () => {
    const db = ct07();
    dbHolder.current = db.client;
    await finishReturn({
      unitId: "u7", yardId: "y1", startedAt: new Date().toISOString(),
      scans: [{ assetId: "a-sw", how: "hand", to: "truck" }],
      notReturned: [{ assetId: "a-pv", outcome: "still_out" }],
    });
    expect(notifyEvent).not.toHaveBeenCalled();
    expect(db.writes.some((w) => w.table === "saas_assets" && w.filters.id === "a-pv" && "unit_id" in w.payload)).toBe(false);
  });
});

describe("A truck that never left the yard", () => {
  // CR-01 went out Monday on a READY load-out and was checked in 22 hours ago.
  function cr01(extraLoadouts: Row[] = []) {
    return fakeDb({
      saas_units: [{ id: "u1", company_id: CO, name: "CR-01", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [
        piece("a-sl", "Wire rope slings, set A", "SL-A", "u1"),
        piece("a-bm", "Boom extension", "BX-0101", "u1"),
        piece("a-hk", "Hook block", "HK-0202", "u1"),
      ],
      saas_loadout_scans: [{ id: "lo-0", company_id: CO, unit_id: "u1", unit_name: "CR-01", scanned_by: "Cody Blackburn", finished_at: ago(3 * 24 * H), verdict: "ready" }, ...extraLoadouts],
      saas_returns: [{ id: "r-0", company_id: CO, unit_id: "u1", returned_by_user: "user-0", started_at: ago(23 * H), finished_at: ago(22 * H) }],
      saas_compliance_items: [], saas_loadout_overrides: [], saas_signouts: [],
    });
  }
  const redTagSling = (yardCheck: boolean) => finishReturn({
    unitId: "u1", yardId: "y1", startedAt: new Date().toISOString(), yardCheck,
    scans: [{ assetId: "a-sl", how: "hand", to: "truck", redTag: "cut near the eye" }],
    notReturned: [{ assetId: "a-bm", outcome: "still_out" }, { assetId: "a-hk", outcome: "still_out" }],
  });
  const unscannedFlags = () => vi.mocked(logEvent).mock.calls.map((c) => c[0]).filter((e) => e.kind === "unscanned_trip");

  it("the hand says it stayed: no 'never scanned out' flag, and the boom and hooks aren't 'still out'", async () => {
    const db = cr01();
    dbHolder.current = db.client;
    const res = await redTagSling(true);
    expect(res.ok).toBe(true);
    expect(unscannedFlags()).toEqual([]);
    expect(res.summary).toContain("(it didn't leave the yard)");
    expect(res.summary).not.toContain("still out");
    const rec = db.writes.find((w) => w.table === "saas_returns" && w.kind === "insert")!;
    expect(rec.payload.not_returned).toEqual([]);
  });

  it("control: the hand says it went out, so the unscanned trip is still flagged", async () => {
    const db = cr01();
    dbHolder.current = db.client;
    const res = await redTagSling(false);
    expect(res.ok).toBe(true);
    expect(unscannedFlags().map((e) => e.message)).toEqual([expect.stringContaining("never scanned out")]);
    const rec = db.writes.find((w) => w.table === "saas_returns" && w.kind === "insert")!;
    expect(rec.payload.not_returned).toHaveLength(2);
  });

  it("a load-out since the last check-in means it left: its word isn't taken, and NOT READY is still flagged", async () => {
    const db = cr01([{ id: "lo-2", company_id: CO, unit_id: "u1", unit_name: "CR-01", scanned_by: "Cody Blackburn", finished_at: ago(10 * H), verdict: "not_ready" }]);
    dbHolder.current = db.client;
    const res = await redTagSling(true);
    expect(res.ok).toBe(true);
    expect(res.summary).not.toContain("didn't leave the yard");
    expect(unscannedFlags().map((e) => e.message)).toEqual([expect.stringContaining("NOT READY")]);
    const rec = db.writes.find((w) => w.table === "saas_returns" && w.kind === "insert")!;
    expect(rec.payload.not_returned).toHaveLength(2);
  });

  it("a yard check with nothing scanned saves nothing", async () => {
    const db = cr01();
    dbHolder.current = db.client;
    const res = await finishReturn({
      unitId: "u1", yardId: "y1", startedAt: new Date().toISOString(), yardCheck: true,
      scans: [], notReturned: [{ assetId: "a-bm", outcome: "missing" }],
    });
    expect(res.ok).toBe(false);
    expect(db.writes).toEqual([]);
  });
});
