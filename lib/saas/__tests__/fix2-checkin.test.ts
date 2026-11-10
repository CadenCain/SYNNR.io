import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Check-in, round two, run against the REAL finishReturn
 * (app/app/return/actions.ts) on an in-memory database:
 *   1. A yard check (the hand says the truck never left) still reaches the
 *      managers, softer, and the phone's not-back answers aren't lost when
 *      the server doesn't take the yard check.
 *   2. A stale check-in (too old, or the truck loaded out again since it
 *      started) can't save over the new trip. Another hand's check-in, or a
 *      NOT READY try nobody rolled, doesn't make it stale.
 *   3. A piece still out on the job says where it is: left on location.
 *   4. A yard check-in carried into another company is refused, with why.
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
  user: { id: "user-1", email: "manuel@example.com", user_metadata: { full_name: "Manuel Ortega" } },
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

import { logEvent } from "../notify";
import { YARD_TZ } from "../format";
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
const piece = (id: string, name: string, serial: string, unit: string | null, extra: Row = {}): Row => ({
  id, company_id: CO, name, identifier: serial, unit_id: unit, yard_id: "y1", status: "in_service", out_since: null, tag_token: `tag-${id}`,
  nfc_uid: null, out_loadout_id: null, out_with_name: null, redress_each_run: false, ...extra,
});
const events = (kind: string) => vi.mocked(logEvent).mock.calls.map((c) => c[0]).filter((e) => e.kind === kind);
const record = (db: ReturnType<typeof fakeDb>) => db.writes.find((w) => w.table === "saas_returns" && w.kind === "insert");

beforeEach(() => { vi.mocked(logEvent).mockClear(); });

describe("A yard check still reaches the managers", () => {
  // CR-01 went out Monday on a READY load-out and was checked in 22 hours ago.
  function cr01(extraLoadouts: Row[] = []) {
    return fakeDb({
      saas_units: [{ id: "u1", company_id: CO, name: "CR-01", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [
        piece("a-sl", "Wire rope slings, set A", "SL-A", "u1"),
        piece("a-bm", "Boom extension", "BX-0101", "u1"),
      ],
      saas_loadout_scans: [{ id: "lo-0", company_id: CO, unit_id: "u1", unit_name: "CR-01", scanned_by: "Cody Blackburn", finished_at: ago(3 * 24 * H), verdict: "ready" }, ...extraLoadouts],
      saas_returns: [{ id: "r-0", company_id: CO, unit_id: "u1", returned_by_user: "user-0", started_at: ago(23 * H), finished_at: ago(22 * H) }],
      saas_compliance_items: [], saas_loadout_overrides: [], saas_signouts: [],
    });
  }
  // The phone always sends what wasn't scanned now, yard check or not.
  const yardCheck = (startedAt = new Date().toISOString()) => finishReturn({
    unitId: "u1", yardId: "y1", startedAt, yardCheck: true,
    scans: [{ assetId: "a-sl", how: "hand", to: "truck" }],
    notReturned: [{ assetId: "a-bm", outcome: "still_out" }],
  });

  it("the hand says it stayed: no red flag, but an amber yard_check line names who said so and since when", async () => {
    const db = cr01();
    dbHolder.current = db.client;
    const res = await yardCheck();
    expect(res.ok).toBe(true);
    expect(events("unscanned_trip")).toEqual([]);
    const yc = events("yard_check");
    expect(yc).toHaveLength(1);
    expect(yc[0].unitId).toBe("u1");
    expect(yc[0].message).toContain("CR-01 checked in by Manuel Ortega, who said it didn't leave the yard since it was checked in");
    expect(yc[0].message).toContain("No load-out since then.");
    expect(yc[0].message).not.toContain("\u2014");
    // The server drops the not-back list on a yard check it takes.
    expect(record(db)!.payload.not_returned).toEqual([]);
  });

  it("the server doesn't take the yard check (it loaded out since the screen opened): the not-back answers are kept", async () => {
    const started = ago(2 * H);
    const db = cr01([{ id: "lo-1", company_id: CO, unit_id: "u1", unit_name: "CR-01", scanned_by: "Cody Blackburn", finished_at: ago(3 * H), verdict: "ready" }]);
    dbHolder.current = db.client;
    const res = await yardCheck(started);
    expect(res.ok).toBe(true);
    expect(events("yard_check")).toEqual([]);
    expect(res.summary).not.toContain("didn't leave the yard");
    const nr = record(db)!.payload.not_returned as { asset_id: string; outcome: string }[];
    expect(nr).toEqual([expect.objectContaining({ asset_id: "a-bm", outcome: "still_out" })]);
  });

  it("a truck with no load-out ever says so", async () => {
    const db = fakeDb({
      saas_units: [{ id: "u1", company_id: CO, name: "CR-01", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [piece("a-sl", "Wire rope slings, set A", "SL-A", "u1")],
      saas_loadout_scans: [], saas_returns: [], saas_compliance_items: [], saas_loadout_overrides: [], saas_signouts: [],
    });
    dbHolder.current = db.client;
    const res = await finishReturn({ unitId: "u1", yardId: "y1", startedAt: new Date().toISOString(), yardCheck: true,
      scans: [{ assetId: "a-sl", how: "hand", to: "truck" }], notReturned: [] });
    expect(res.ok).toBe(true);
    expect(events("yard_check")[0].message).toContain("It has no load-out on record.");
  });
});

describe("A stale check-in can't save over a newer trip", () => {
  // CT-02 came back at 14:00 (out since a READY load-out yesterday).
  function ct02({ loadouts = [], returns = [], overrides = [] }: { loadouts?: Row[]; returns?: Row[]; overrides?: Row[] } = {}) {
    const out = ago(26 * H);
    return fakeDb({
      saas_units: [{ id: "u2", company_id: CO, name: "CT-02", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [
        piece("a-1", "2in 1502 plug valve", "PV-3019", "u2", { out_since: out, out_loadout_id: "lo-0" }),
        piece("a-2", "2in 1502 Chiksan swivel", "SW-1107", "u2", { out_since: out, out_loadout_id: "lo-0" }),
      ],
      saas_loadout_scans: [{ id: "lo-0", company_id: CO, unit_id: "u2", unit_name: "CT-02", scanned_by: "Dale Wooten", scanned_by_user: "user-2", finished_at: out, verdict: "ready", pieces: [], not_scanned: [] }, ...loadouts],
      saas_returns: returns, saas_compliance_items: [], saas_loadout_overrides: overrides, saas_signouts: [],
    });
  }
  const manuel = (startedAt: string) => finishReturn({
    unitId: "u2", yardId: "y1", startedAt,
    scans: [{ assetId: "a-1", how: "hand", to: "truck" }],
    notReturned: [{ assetId: "a-2", outcome: "still_out" }],
  });

  it("Ray loaded CT-02 out READY after Manuel started: refused, stale, Ray named, nothing written", async () => {
    const db = ct02({ loadouts: [{ id: "lo-1", company_id: CO, unit_id: "u2", unit_name: "CT-02", scanned_by: "Ray Hinojosa", scanned_by_user: "user-3", finished_at: ago(2 * H), verdict: "ready", pieces: [], not_scanned: [] }] });
    dbHolder.current = db.client;
    const res = await manuel(ago(4 * H));
    expect(res).toMatchObject({ ok: false, stale: true });
    expect(res.error).toContain("Ray Hinojosa loaded CT-02 out again");
    expect(res.error).toContain("It can't be saved.");
    expect(res.error).not.toContain("\u2014");
    expect(db.writes).toEqual([]);
  });

  it("a NOT READY try rolled on a manager's override counts as loaded out", async () => {
    const db = ct02({
      loadouts: [{ id: "lo-1", company_id: CO, unit_id: "u2", unit_name: "CT-02", scanned_by: "Ray Hinojosa", scanned_by_user: "user-3", finished_at: ago(2 * H), verdict: "not_ready", pieces: [], not_scanned: [] }],
      overrides: [{ loadout_id: "lo-1", company_id: CO, created_at: ago(1.5 * H) }],
    });
    dbHolder.current = db.client;
    const res = await manuel(ago(4 * H));
    expect(res).toMatchObject({ ok: false, stale: true });
    expect(db.writes).toEqual([]);
  });

  it("a NOT READY try nobody rolled never left: the check-in saves", async () => {
    const db = ct02({ loadouts: [{ id: "lo-1", company_id: CO, unit_id: "u2", unit_name: "CT-02", scanned_by: "Ray Hinojosa", scanned_by_user: "user-3", finished_at: ago(2 * H), verdict: "not_ready", pieces: [], not_scanned: [] }] });
    dbHolder.current = db.client;
    const res = await manuel(ago(4 * H));
    expect(res.ok).toBe(true);
    expect(res.stale).toBeUndefined();
  });

  it("another hand's check-in since doesn't make it stale (two phones, one truck)", async () => {
    const db = ct02({ returns: [{ id: "r-1", company_id: CO, unit_id: "u2", returned_by_user: "user-4", started_at: ago(3.5 * H), finished_at: ago(3 * H) }] });
    dbHolder.current = db.client;
    const res = await manuel(ago(4 * H));
    expect(res.ok).toBe(true);
  });

  it("started more than 20 hours ago (or in the future): refused, stale", async () => {
    for (const started of [ago(21 * H), new Date(Date.now() + 30 * 60e3).toISOString()]) {
      const db = ct02();
      dbHolder.current = db.client;
      const res = await manuel(started);
      expect(res).toMatchObject({ ok: false, stale: true });
      expect(res.error).toContain("started too long ago");
      expect(db.writes).toEqual([]);
    }
  });

  it("a resend of a check-in that already saved still gets its record back, old or not", async () => {
    const started = ago(21 * H);
    const db = ct02({ returns: [{ id: "r-mine", company_id: CO, unit_id: "u2", unit_name: "CT-02", returned_by: "Manuel Ortega", returned_by_user: "user-1", started_at: new Date(Date.parse(started)).toISOString(), finished_at: ago(20.5 * H), pieces: [{}], not_returned: [] }] });
    dbHolder.current = db.client;
    const res = await manuel(started);
    expect(res).toMatchObject({ ok: true, id: "r-mine" });
  });
});

describe("Still out on the job says where it is", () => {
  it("the swivel left on location gets a note with the truck, the trip's day, and who said so, and stays on the truck", async () => {
    const out = ago(26 * H);
    const db = fakeDb({
      saas_units: [{ id: "u2", company_id: CO, name: "CT-02", yard_id: "y1" }],
      saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [
        piece("a-1", "2in 1502 plug valve", "PV-3019", "u2", { out_since: out, out_loadout_id: "lo-0" }),
        piece("a-2", "2in 1502 Chiksan swivel", "SW-1107", "u2", { out_since: out, out_loadout_id: "lo-0" }),
      ],
      saas_loadout_scans: [{ id: "lo-0", company_id: CO, unit_id: "u2", unit_name: "CT-02", scanned_by: "Dale Wooten", finished_at: out, verdict: "ready", pieces: [], not_scanned: [] }],
      saas_returns: [], saas_compliance_items: [], saas_loadout_overrides: [], saas_signouts: [],
    });
    dbHolder.current = db.client;
    const res = await finishReturn({ unitId: "u2", yardId: "y1", startedAt: new Date().toISOString(),
      scans: [{ assetId: "a-1", how: "hand", to: "truck" }], notReturned: [{ assetId: "a-2", outcome: "still_out" }] });
    expect(res.ok).toBe(true);
    const note = db.writes.find((w) => w.table === "saas_assets" && w.kind === "update" && Array.isArray(w.filters.id) && (w.filters.id as string[]).includes("a-2"));
    const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });
    expect(note?.payload).toMatchObject({ last_seen_by: "Manuel Ortega", last_seen_where: `left on location from CT-02's ${day(out)} job, per Manuel Ortega, ${day(new Date().toISOString())}` });
    // Its clock keeps running and it stays logged on the truck.
    expect(note?.payload).not.toHaveProperty("out_since");
    expect(note?.payload).not.toHaveProperty("unit_id");
    expect(db.writes.some((w) => w.table === "saas_assets" && Array.isArray(w.filters.id) && (w.filters.id as string[]).includes("a-2") && "out_since" in w.payload)).toBe(false);
  });
});

describe("A yard check-in carried into another company", () => {
  it("none of the pieces are this company's: refused with why, nothing written", async () => {
    const db = fakeDb({
      saas_units: [], saas_yards: [{ id: "y1", company_id: CO, name: "Odessa Yard" }],
      saas_assets: [piece("a-1", "2in 1502 plug valve", "PV-3019", null)],
      saas_loadout_scans: [], saas_returns: [], saas_compliance_items: [], saas_loadout_overrides: [], saas_signouts: [],
    });
    dbHolder.current = db.client;
    const res = await finishReturn({ unitId: null, yardId: "y1", startedAt: new Date().toISOString(),
      scans: [{ assetId: "other-co-sf101", how: "hand", to: "yard" }], notReturned: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("None of these pieces are in this company. Switch back to the company you checked them in for, then save.");
    expect(db.writes).toEqual([]);
  });
});

describe("The check-in phone", () => {
  const src = readFileSync(path.resolve(__dirname, "../../../app/app/return/return-scanner.tsx"), "utf8");
  const truckPage = readFileSync(path.resolve(__dirname, "../../../app/app/units/[unitId]/return/page.tsx"), "utf8");
  const yardPage = readFileSync(path.resolve(__dirname, "../../../app/app/return/page.tsx"), "utf8");

  it("always sends the not-back list for a truck, yard check or not", () => {
    expect(src).toContain('notReturned: truck ? expected.filter((p) => !scans[p.id])');
    expect(src).not.toContain("truck && !yardCheck ? expected");
  });

  it("keys a yard check-in's draft by company, and both pages pass the company", () => {
    expect(src).toContain("const key = truck?.id ?? `yard-${companyId}`;");
    expect(yardPage).toContain("companyId={company.id}");
    expect(truckPage).toContain("companyId={company.id}");
  });

  it("finds a typed serial with the same helper as load-out", () => {
    expect(src).toContain("findBySerial(pieces, serialText)");
    expect(src).toContain("serialMiss(serialText, hit)");
    expect(src).not.toContain("endsWith(want)");
  });

  it("drops a stale draft and stops retrying", () => {
    const block = src.slice(src.indexOf("if (res.stale)"), src.indexOf("if (!res.ok)"));
    expect(block).toContain("forgetDraft(key)");
    expect(block).toContain("setWaiting(false)");
    expect(block).toContain("setDead(true)");
  });

  it("asks if a truck that's out on a job is back before the check-in ends its trip", () => {
    expect(src).toContain("A check-in ends its trip.");
    expect(src).toContain("(askBack && back !== true)");
    expect(truckPage).toContain("outNow={outSince ? { since: outSince } : null}");
  });
});
