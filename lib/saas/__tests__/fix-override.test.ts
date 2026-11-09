import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { localToday, addDaysIso } from "../status";

/**
 * Overrides and the Paper check, from the busy-week findings:
 *  - Paper check's "Roll anyway" is the load-out override: it rolls the
 *    truck's NOT READY load-out from this shift (an override row, the same
 *    checks), or nothing at all. No second kind of override that the board,
 *    check-in and the morning email never hear about.
 *  - Paper check never reads green for a truck blocked at load-out.
 *  - A NOT READY load-out from yesterday can't be rolled: scan it again.
 *  - A plan that takes iron from the yard the yard can't give is said now,
 *    not at 5 AM.
 */

vi.mock("../notify", () => ({
  sendEmail: vi.fn(async () => true),
  sendSms: vi.fn(async () => true),
  smsConfigured: () => false,
  notifyEvent: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
}));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Renegade Wireline", role: "owner", subscription_status: "active", comped: false, yard_quantity: 1 },
  user: { id: "user-kevin", email: "kevin@example.com", user_metadata: { full_name: "Kevin Odom" } },
}));
vi.mock("../auth", () => ({
  requireCompany: vi.fn(async () => authMock),
  requireBillableCompany: vi.fn(async () => authMock),
  requireWritableCompany: vi.fn(async () => ({ ok: true, ...authMock })),
  assertCan: () => {},
}));
const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({
  saasDb: async () => dbHolder.current,
  saasAdmin: () => dbHolder.current,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }) }));

import { computeDispatchCheck, truckLoadout, canStillRoll, planShortInYard, ROLL_WINDOW_MS } from "../dispatch-check";

const CO = "co-1";
const H = 3600e3;
const ago = (h: number) => new Date(Date.now() - h * H).toISOString();
const TODAY = localToday();
const FUTURE = addDaysIso(TODAY, 300);

// ------------------------------------------------------------- a small db
type Row = Record<string, unknown>;
type Write = { table: string; kind: "insert" | "update" | "delete"; payload?: Row; filters: [string, string, unknown][] };

function fakeDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  let seq = 0;
  class Q {
    private filters: [string, string, unknown][] = [];
    private sort: { col: string; asc: boolean } | null = null;
    private max = Infinity;
    private one = false;
    private write: Write | null = null;
    constructor(private table: string) {}
    select() { return this; }
    or() { return this; }
    eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
    neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
    is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
    in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
    gt(c: string, v: unknown) { this.filters.push([c, "gt", v]); return this; }
    gte(c: string, v: unknown) { this.filters.push([c, "gte", v]); return this; }
    order(col: string, o?: { ascending?: boolean }) { if (!this.sort) this.sort = { col, asc: o?.ascending !== false }; return this; }
    limit(n: number) { this.max = n; return this; }
    range(a: number, b: number) { this.max = b - a + 1; return this; }
    maybeSingle() { this.one = true; return this; }
    single() { this.one = true; return this; }
    insert(payload: Row) { this.write = { table: this.table, kind: "insert", payload, filters: [] }; return this; }
    update(payload: Row) { this.write = { table: this.table, kind: "update", payload, filters: [] }; return this; }
    delete() { this.write = { table: this.table, kind: "delete", filters: [] }; return this; }
    private match(r: Row) {
      return this.filters.every(([c, op, v]) =>
        op === "eq" ? r[c] === v
        : op === "neq" ? r[c] !== v
        : op === "is" ? (r[c] ?? null) === v
        : op === "in" ? (v as unknown[]).includes(r[c])
        : op === "gt" ? String(r[c] ?? "") > String(v)
        : String(r[c] ?? "") >= String(v));
    }
    then<T>(resolve: (v: { data: unknown; error: null; count?: number }) => T): T {
      const rows = (tables[this.table] ??= []);
      if (this.write) {
        this.write.filters = this.filters;
        writes.push(this.write);
        if (this.write.kind === "insert") { rows.push({ id: `new-${++seq}`, ...this.write.payload }); return resolve({ data: null, error: null }); }
        const hit = rows.filter((r) => this.match(r));
        if (this.write.kind === "update") hit.forEach((r) => Object.assign(r, this.write!.payload));
        else tables[this.table] = rows.filter((r) => !hit.includes(r));
        return resolve({ data: hit.map((r) => ({ id: r.id })), error: null, count: hit.length });
      }
      let out = rows.filter((r) => this.match(r));
      if (this.sort) { const { col, asc } = this.sort; out = [...out].sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (asc ? 1 : -1)); }
      out = out.slice(0, this.max);
      return resolve({ data: this.one ? (out[0] ?? null) : out, error: null });
    }
  }
  const client = { from: (t: string) => new Q(t), storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) } };
  return { client: client as unknown as SupabaseClient, tables, writes };
}

/** CT-06: all its paper current, one valve on it. */
function ct6(extra: Record<string, Row[]> = {}) {
  return {
    saas_units: [{ id: "u6", name: "CT-06", type: "coil", yard_id: "ody", company_id: CO }],
    saas_packages: [],
    saas_package_lines: [],
    saas_assets: [{ id: "pv1", name: "2in 1502 plug valve", identifier: "PV-2231", status: "in_service", category: "flow_iron", needs_redress_since: null, unit_id: "u6", yard_id: "ody", company_id: CO }],
    saas_compliance_items_with_status: [
      { id: "c-dot", title: "Annual DOT inspection", expiration_date: FUTURE, parent_type: "unit", parent_id: "u6", company_id: CO, last_upload_id: "up1" },
      { id: "c-pv1", title: "Iron recert", expiration_date: FUTURE, parent_type: "asset", parent_id: "pv1", company_id: CO, last_upload_id: "up2" },
    ],
    saas_loadout_overrides: [],
    saas_returns: [],
    saas_loadout_plans: [],
    ...extra,
  };
}
const blockedLoadout = (hoursAgo: number, over: Row = {}): Row => ({
  id: "lo1", company_id: CO, unit_id: "u6", unit_name: "CT-06", yard_id: "ody", scanned_by: "Ray Hinojosa",
  started_at: ago(hoursAgo + 0.3), finished_at: ago(hoursAgo), expected: 2, scanned: 1, verdict: "not_ready",
  reasons: ["Short: 2in 1502 plug valve, 0 of 1 scanned"], lines: [], packages: [], pieces: [], not_scanned: [],
  proof_token: "tok", plan: null, photo_path: null, roll_checks: null, job: null, ...over,
});

beforeEach(() => { dbHolder.current = null; });

describe("the roll window: an override covers a load-out from this shift", () => {
  it("19 hours old can still roll; 21 hours old can't", () => {
    expect(ROLL_WINDOW_MS).toBe(20 * H);
    expect(canStillRoll(ago(19))).toBe(true);
    expect(canStillRoll(ago(21))).toBe(false);
  });
});

describe("truckLoadout reads the newest load-out the way the board does", () => {
  it("NOT READY, nobody rolled it, not checked in: blocked, and rollable this shift", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)] }));
    const lo = await truckLoadout(client, CO, "u6");
    expect(lo).toMatchObject({ id: "lo1", state: "blocked", rollable: true, scannedBy: "Ray Hinojosa" });
  });
  it("a manager rolled it: out", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)], saas_loadout_overrides: [{ loadout_id: "lo1", company_id: CO }] }));
    expect((await truckLoadout(client, CO, "u6"))?.state).toBe("out");
  });
  it("checked back in since: back, and nothing to roll", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(5)], saas_returns: [{ id: "r1", unit_id: "u6", company_id: CO, finished_at: ago(1) }] }));
    expect(await truckLoadout(client, CO, "u6")).toMatchObject({ state: "back", rollable: false });
  });
  it("yesterday's blocked load-out is still blocked, but too old to roll", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(30)] }));
    expect(await truckLoadout(client, CO, "u6")).toMatchObject({ state: "blocked", rollable: false });
  });
  it("another company's truck: nothing", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)] }));
    expect(await truckLoadout(client, "co-other", "u6")).toBeNull();
  });
});

describe("Paper check never reads green for a truck blocked at load-out", () => {
  it("paper all current, newest load-out NOT READY: NOT READY, and it says why", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)] }));
    const r = await computeDispatchCheck(client, CO, "u6");
    expect(r?.verdict).toBe("not_ready");
    expect(r?.failures[0]).toMatch(/^Blocked at load-out .*: Short: 2in 1502 plug valve, 0 of 1 scanned\. Fix it and scan again, or a manager rolls it from the load-out record\.$/);
    expect(r?.lines[0]).toMatchObject({ source_type: "loadout_item", source_id: "lo1", result: "missing" });
    expect(r?.lines[0].label).toMatch(/^Load-out .* by Ray Hinojosa$/);
    expect(r?.loadout?.rollable).toBe(true);
    // It already says scan it again; no second "nobody scanned it" line.
    expect(r?.warnings.some((w) => w.startsWith("Nobody has scanned"))).toBe(false);
  });
  it("an old blocked one says scan it again (no roll offered)", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(30)] }));
    const r = await computeDispatchCheck(client, CO, "u6");
    expect(r?.verdict).toBe("not_ready");
    expect(r?.failures[0]).toMatch(/Scan it again\.$/);
  });
  it("rolled on a manager's override: the paper decides again (READY here)", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)], saas_loadout_overrides: [{ loadout_id: "lo1", company_id: CO }] }));
    const r = await computeDispatchCheck(client, CO, "u6");
    expect(r?.verdict).toBe("ready");
    expect(r?.lines.some((l) => l.source_id === "lo1")).toBe(false);
  });
  it("checked in since: not blocked", async () => {
    const { client } = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(5)], saas_returns: [{ id: "r1", unit_id: "u6", company_id: CO, finished_at: ago(1) }] }));
    expect((await computeDispatchCheck(client, CO, "u6"))?.verdict).toBe("ready");
  });
  it("a truck with no paper set up but a blocked load-out is NOT READY, not 'nothing to check'", async () => {
    const { client } = fakeDb(ct6({ saas_compliance_items_with_status: [], saas_assets: [], saas_loadout_scans: [blockedLoadout(1)] }));
    expect((await computeDispatchCheck(client, CO, "u6"))?.verdict).toBe("not_ready");
  });
});

describe("Paper check's Roll anyway is the load-out override", () => {
  it("rolls the truck's blocked load-out: one load-out override row, no paper override, lands on the record", async () => {
    const fake = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)] }));
    dbHolder.current = fake.client;
    const { rollAnyway } = await import("../../../app/app/units/[unitId]/dispatch/actions");
    const fd = new FormData();
    fd.set("unit_id", "u6");
    fd.set("loadout_id", "lo1");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    await expect(rollAnyway(fd)).rejects.toThrow("REDIRECT /app/loadouts/lo1");
    const inserts = fake.writes.filter((w) => w.kind === "insert");
    expect(inserts.map((w) => w.table)).toEqual(["saas_loadout_overrides"]);
    expect(inserts[0].payload).toMatchObject({ company_id: CO, loadout_id: "lo1", by_name: "Kevin Odom", reason: "New BOP test cert is in the truck, upload failed." });
    expect(fake.writes.some((w) => w.table === "saas_dispatch_checks")).toBe(false);
  });
  it("no load-out to roll: nothing is recorded, back to the Paper check", async () => {
    const fake = fakeDb(ct6({ saas_compliance_items_with_status: [{ id: "c-dot", title: "Annual DOT inspection", expiration_date: "2020-01-01", parent_type: "unit", parent_id: "u6", company_id: CO, last_upload_id: "up1" }] }));
    dbHolder.current = fake.client;
    const { rollAnyway } = await import("../../../app/app/units/[unitId]/dispatch/actions");
    const fd = new FormData();
    fd.set("unit_id", "u6");
    fd.set("reason", "Company man signed off on location.");
    await expect(rollAnyway(fd)).rejects.toThrow("REDIRECT /app/units/u6/dispatch?roll=none");
    expect(fake.writes).toEqual([]);
  });
  it("the truck moved on since the page loaded (a different load-out now): nothing rolls", async () => {
    const fake = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1, { id: "lo2" })] }));
    dbHolder.current = fake.client;
    const { rollAnyway } = await import("../../../app/app/units/[unitId]/dispatch/actions");
    const fd = new FormData();
    fd.set("unit_id", "u6");
    fd.set("loadout_id", "lo1");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    await expect(rollAnyway(fd)).rejects.toThrow("roll=none");
    expect(fake.writes).toEqual([]);
  });
  it("yesterday's blocked load-out: nothing rolls", async () => {
    const fake = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(30)] }));
    dbHolder.current = fake.client;
    const { rollAnyway } = await import("../../../app/app/units/[unitId]/dispatch/actions");
    const fd = new FormData();
    fd.set("unit_id", "u6");
    fd.set("loadout_id", "lo1");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    await expect(rollAnyway(fd)).rejects.toThrow("roll=none");
    expect(fake.writes).toEqual([]);
  });
  it("a form that names no load-out (an old tab) rolls nothing, even with one blocked", async () => {
    const fake = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)] }));
    dbHolder.current = fake.client;
    const { rollAnyway } = await import("../../../app/app/units/[unitId]/dispatch/actions");
    const fd = new FormData();
    fd.set("unit_id", "u6");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    await expect(rollAnyway(fd)).rejects.toThrow("roll=none");
    expect(fake.writes).toEqual([]);
  });
  it("a hand can't", async () => {
    dbHolder.current = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(1)] })).client;
    const { rollAnyway } = await import("../../../app/app/units/[unitId]/dispatch/actions");
    const fd = new FormData();
    fd.set("unit_id", "u6");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    authMock.company.role = "member";
    try {
      await expect(rollAnyway(fd)).rejects.toThrow("Only a manager");
    } finally {
      authMock.company.role = "owner";
    }
  });
});

describe("the load-out record's override refuses an old load-out", () => {
  it("30 hours old: refused, no override row", async () => {
    const fake = fakeDb(ct6({ saas_loadout_scans: [blockedLoadout(30)] }));
    dbHolder.current = fake.client;
    const { rollLoadoutAnyway } = await import("../../../app/app/loadouts/[id]/actions");
    const fd = new FormData();
    fd.set("loadout_id", "lo1");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    await expect(rollLoadoutAnyway(fd)).rejects.toThrow("REDIRECT /app/loadouts/lo1?stale=1");
    expect(fake.writes).toEqual([]);
  });
  it("this shift: it rolls, the record's plan is used up, and only that plan", async () => {
    const fake = fakeDb(ct6({
      saas_loadout_scans: [blockedLoadout(1, { plan: { id: "plan-now", by: "Kevin Odom", at: ago(3), note: null, packages: [], lines: [] } })],
      saas_loadout_plans: [{ id: "plan-now", company_id: CO, unit_id: "u6", package_ids: [], lines: [], note: null, job: null, planned_by: "Kevin Odom", created_at: ago(3), leaves_at: null, used_at: null }],
    }));
    dbHolder.current = fake.client;
    const { rollLoadoutAnyway } = await import("../../../app/app/loadouts/[id]/actions");
    const fd = new FormData();
    fd.set("loadout_id", "lo1");
    fd.set("reason", "New BOP test cert is in the truck, upload failed.");
    await expect(rollLoadoutAnyway(fd)).rejects.toThrow("REDIRECT /app/loadouts/lo1");
    expect(fake.writes.filter((w) => w.kind === "insert").map((w) => w.table)).toEqual(["saas_loadout_overrides"]);
    const planUpdate = fake.writes.find((w) => w.table === "saas_loadout_plans" && w.kind === "update");
    expect(planUpdate?.filters).toContainEqual(["id", "in", ["plan-now"]]);
    expect(fake.tables.saas_loadout_plans[0].used_at).toBeTruthy();
  });
});

describe("a plan's yard iron, said before 5 AM", () => {
  const swivel = "2in 1502 Chiksan swivel";
  const lines = [
    { label: swivel, qty: 1, source: "kit" as const },
    { label: "2in 1502 plug valve", qty: 1, source: "package" as const, package: "Pump-down package" },
    { label: swivel, qty: 1, source: "package" as const, package: "Pump-down package" },
  ];
  const truck = [{ id: "sw1105", name: swivel, serial: "SW-1105" }, { id: "pv1", name: "2in 1502 plug valve", serial: "PV-1" }];

  it("the kit takes the truck's swivel; the package needs a second, and the yard's only one is out of test", () => {
    const out = planShortInYard({ lines, truck, yard: [{ id: "sw1180", name: swivel, serial: "SW-1180", bad: "Iron recert expired Oct 28, 2026 (12d ago)" }] });
    expect(out).toEqual([
      "Pump-down package needs 2in 1502 Chiksan swivel. No good one on the truck or free in the yard. The yard's 2in 1502 Chiksan swivel SW-1180: Iron recert expired Oct 28, 2026 (12d ago). The load-out will block without it.",
    ]);
  });
  it("a good swivel free in the yard: nothing to say", () => {
    expect(planShortInYard({ lines, truck, yard: [{ id: "sw1190", name: swivel, serial: "SW-1190", bad: null }] })).toEqual([]);
  });
  it("a short kit line alone isn't repeated here (the kit warns on its own)", () => {
    expect(planShortInYard({ lines: [lines[0]], truck: [], yard: [] })).toEqual([]);
  });

  it("Paper check on CT-05 with the Pump-down package planned names the yard's out-of-test swivel", async () => {
    const { client } = fakeDb({
      saas_units: [{ id: "u5", name: "CT-05", type: "coil", yard_id: "ody", company_id: CO }],
      saas_packages: [
        { id: "kit5", name: "CT-05 kit", company_id: CO, unit_id: "u5" },
        { id: "pd", name: "Pump-down package", company_id: CO, unit_id: null, saas_package_lines: [{ label: "2in 1502 plug valve", qty: 1, sort: 0 }, { label: swivel, qty: 1, sort: 1 }] },
      ],
      saas_package_lines: [{ id: "kl1", package_id: "kit5", label: swivel, qty: 1, sort: 0 }],
      saas_assets: [
        { id: "sw1105", name: swivel, identifier: "SW-1105", status: "in_service", category: "flow_iron", needs_redress_since: null, unit_id: "u5", yard_id: "ody", company_id: CO },
        { id: "pv1", name: "2in 1502 plug valve", identifier: "PV-1", status: "in_service", category: "flow_iron", needs_redress_since: null, unit_id: "u5", yard_id: "ody", company_id: CO },
        { id: "sw1180", name: swivel, identifier: "SW-1180", status: "in_service", category: "flow_iron", needs_redress_since: null, unit_id: null, yard_id: "ody", out_since: null, out_with_user: null, company_id: CO },
        // Midland's swivel is in another yard: it can't fill an Odessa truck's line.
        { id: "sw2000", name: swivel, identifier: "SW-2000", status: "in_service", category: "flow_iron", needs_redress_since: null, unit_id: null, yard_id: "mid", out_since: null, out_with_user: null, company_id: CO },
      ],
      saas_compliance_items_with_status: [
        { id: "c-dot", title: "Annual DOT inspection", expiration_date: FUTURE, parent_type: "unit", parent_id: "u5", company_id: CO, last_upload_id: "up1" },
        { id: "c-1105", title: "Iron recert", expiration_date: FUTURE, parent_type: "asset", parent_id: "sw1105", company_id: CO, last_upload_id: "up2" },
        { id: "c-pv1", title: "Iron recert", expiration_date: FUTURE, parent_type: "asset", parent_id: "pv1", company_id: CO, last_upload_id: "up3" },
        { id: "c-1180", title: "Iron recert", expiration_date: addDaysIso(TODAY, -12), parent_type: "asset", parent_id: "sw1180", company_id: CO, last_upload_id: "up4" },
        { id: "c-2000", title: "Iron recert", expiration_date: FUTURE, parent_type: "asset", parent_id: "sw2000", company_id: CO, last_upload_id: "up5" },
      ],
      saas_loadout_plans: [{ id: "plan5", company_id: CO, unit_id: "u5", package_ids: ["pd"], lines: [], leaves_at: null, used_at: null, created_at: ago(2) }],
      saas_loadout_scans: [],
      saas_loadout_overrides: [],
      saas_returns: [],
    });
    const r = await computeDispatchCheck(client, CO, "u5");
    expect(r?.verdict).toBe("ready"); // a heads-up, never a gate: the load-out is the gate
    expect(r?.planShort).toHaveLength(1);
    expect(r?.planShort[0]).toMatch(/^Pump-down package needs 2in 1502 Chiksan swivel\. No good one on the truck or free in the yard\. The yard's 2in 1502 Chiksan swivel SW-1180: Iron recert expired/);
    expect(r?.warnings).toContain(r?.planShort[0]);
  });
});
