import { describe, it, expect, vi, beforeEach } from "vitest";
import { planTiming, lateLine, loadoutForPlan, getOpenPlan, getTruckPlan, rolledSince, PLAN_AHEAD_MS } from "../plans";

/**
 * Planned jobs, from the busy-week findings:
 *  - Friday's plan for Monday's job doesn't take over Saturday's on-call
 *    load-out (or get used up by it).
 *  - A plan whose truck never rolled stops locking the truck once it's more
 *    than a day past its leave time, and the board asks to set a new time or
 *    clear it. The plan can move to the truck the job went on.
 *  - A truck that rolls while the manager has the plan page open: the save
 *    says so once, then saves.
 */

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
    eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
    is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
    in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
    neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
    or() { return this; }
    order(col: string, o?: { ascending?: boolean }) { this.sort = { col, asc: o?.ascending !== false }; return this; }
    limit(n: number) { this.max = n; return this; }
    maybeSingle() { this.one = true; return this; }
    single() { this.one = true; return this; }
    insert(payload: Row) { this.write = { table: this.table, kind: "insert", payload, filters: [] }; return this; }
    update(payload: Row) { this.write = { table: this.table, kind: "update", payload, filters: [] }; return this; }
    delete() { this.write = { table: this.table, kind: "delete", filters: [] }; return this; }
    private match(r: Row) {
      return this.filters.every(([c, op, v]) => op === "eq" ? r[c] === v : op === "is" ? (r[c] ?? null) === v : op === "neq" ? r[c] !== v : (v as unknown[]).includes(r[c]));
    }
    then<T>(resolve: (v: { data: unknown; error: null; count?: number }) => T): T {
      const rows = (tables[this.table] ??= []);
      if (this.write) {
        this.write.filters = this.filters;
        writes.push(this.write);
        if (this.write.kind === "insert") { rows.push({ id: `new-${++seq}`, used_at: null, ...this.write.payload }); return resolve({ data: null, error: null }); }
        const hit = rows.filter((r) => this.match(r));
        if (this.write.kind === "update") hit.forEach((r) => Object.assign(r, this.write!.payload));
        else tables[this.table] = rows.filter((r) => !hit.includes(r));
        return resolve({ data: null, error: null, count: hit.length });
      }
      let out = rows.filter((r) => this.match(r));
      if (this.sort) { const { col, asc } = this.sort; out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1)); }
      out = out.slice(0, this.max);
      return resolve({ data: this.one ? (out[0] ?? null) : out, error: null });
    }
  }
  return { client: { from: (t: string) => new Q(t) }, writes, tables };
}

// ----------------------------------------------------- server action mocks
vi.mock("../notify", () => ({ logEvent: vi.fn(async () => {}), notifyEvent: vi.fn(async () => {}) }));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Test Wireline", role: "owner", subscription_status: "active", comped: false },
  user: { id: "user-kevin", email: "kevin@example.com", user_metadata: { full_name: "Kevin Odom" } },
}));
vi.mock("../auth", () => ({
  requireCompany: vi.fn(async () => authMock),
  requireBillableCompany: vi.fn(async () => authMock),
}));
const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({ saasDb: async () => dbHolder.current, saasAdmin: () => dbHolder.current }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const CO = "co-1";
const ct = (s: string) => new Date(`${s.replace(" ", "T")}:00-06:00`).toISOString(); // Central (CST)
const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });

const mondayPlan = (over: Row = {}): Row => ({
  id: "plan-ct1", company_id: CO, unit_id: "ct1", package_ids: ["coil"], lines: [], note: null, job: "Monday well",
  planned_by: "Kevin Odom", created_at: ct("2026-11-13 15:00"), leaves_at: ct("2026-11-16 05:00"), used_at: null, ...over,
});

describe("planTiming", () => {
  const leaves = ct("2026-11-16 05:00");
  it("Friday's plan for Monday 5 AM is for a later job on Saturday night", () => {
    expect(planTiming({ leavesAt: leaves }, Date.parse(ct("2026-11-14 01:30")))).toBe("later");
  });
  it("counts from 18 hours before it leaves", () => {
    expect(planTiming({ leavesAt: leaves }, Date.parse(leaves) - PLAN_AHEAD_MS - 60e3)).toBe("later");
    expect(planTiming({ leavesAt: leaves }, Date.parse(leaves) - PLAN_AHEAD_MS + 60e3)).toBe("now");
    expect(planTiming({ leavesAt: leaves }, Date.parse(ct("2026-11-16 04:30")))).toBe("now");
  });
  it("still counts the morning it was late, and goes old a day after", () => {
    expect(planTiming({ leavesAt: leaves }, Date.parse(ct("2026-11-16 09:00")))).toBe("now");
    expect(planTiming({ leavesAt: leaves }, Date.parse(ct("2026-11-17 05:01")))).toBe("old");
  });
  it("no leave time: it's for the next load-out, whenever", () => {
    expect(planTiming({ leavesAt: null }, Date.parse(ct("2026-12-01 05:00")))).toBe("now");
  });
});

describe("the load-out only uses the plan that's for it", () => {
  it("Saturday's on-call load-out on CT-01 doesn't get Monday's plan; the manager still sees it", async () => {
    const { client } = fakeDb({ saas_loadout_plans: [mondayPlan()] });
    const db = client as never;
    expect(await getOpenPlan(db, CO, "ct1", Date.parse(ct("2026-11-14 01:30")))).toBeNull();
    expect((await getTruckPlan(db, CO, "ct1"))?.id).toBe("plan-ct1");
  });
  it("Monday 4:30 AM the same plan locks CT-01's load-out", async () => {
    const { client } = fakeDb({ saas_loadout_plans: [mondayPlan()] });
    const plan = await getOpenPlan(client as never, CO, "ct1", Date.parse(ct("2026-11-16 04:30")));
    expect(plan?.packageIds).toEqual(["coil"]);
    expect(plan?.leavesAt).toBe(ct("2026-11-16 05:00"));
  });
  it("Wednesday, P-02's Monday plan that never rolled stops locking it", async () => {
    const { client } = fakeDb({ saas_loadout_plans: [mondayPlan({ id: "plan-p2", unit_id: "p2", leaves_at: ct("2026-11-09 06:00"), created_at: ct("2026-11-08 20:00") })] });
    expect(await getOpenPlan(client as never, CO, "p2", Date.parse(ct("2026-11-11 05:00")))).toBeNull();
    expect((await getTruckPlan(client as never, CO, "p2"))?.id).toBe("plan-p2");
  });
  it("another company's plan never shows", async () => {
    const { client } = fakeDb({ saas_loadout_plans: [mondayPlan({ company_id: "co-2" })] });
    expect(await getTruckPlan(client as never, CO, "ct1")).toBeNull();
  });
});

describe("the late line", () => {
  const plan = { at: ct("2026-11-13 15:00"), leavesAt: ct("2026-11-16 05:00") };
  it("Saturday's READY on-call load-out (without the plan) doesn't count for Monday's job", () => {
    const sat = { finished_at: ct("2026-11-14 02:10"), rolled: true };
    expect(lateLine(plan, sat, Date.parse(ct("2026-11-16 05:01")), timeText)).toBe("Was planned to leave Mon 5:00 AM. Nobody has scanned it out.");
  });
  it("Sunday night's READY load-out inside the 18 hours does", () => {
    expect(lateLine(plan, { finished_at: ct("2026-11-15 22:00"), rolled: true }, Date.parse(ct("2026-11-16 05:01")), timeText)).toBeNull();
  });
  it("blocked Monday 4:40 AM: still NOT READY", () => {
    expect(lateLine(plan, { finished_at: ct("2026-11-16 04:40"), rolled: false }, Date.parse(ct("2026-11-16 05:30")), timeText))
      .toBe("Was planned to leave Mon 5:00 AM. Still NOT READY.");
  });
  it("the morning email sorts by the same rule: Saturday's load-out wasn't for Monday's job, Sunday night's was", () => {
    expect(loadoutForPlan(plan, { finished_at: ct("2026-11-14 02:10") })).toBe(false);
    expect(loadoutForPlan(plan, { finished_at: ct("2026-11-15 22:00") })).toBe(true);
    expect(loadoutForPlan(plan, null)).toBe(false);
    // No leave time: any load-out after the plan was made.
    expect(loadoutForPlan({ at: plan.at, leavesAt: null }, { finished_at: ct("2026-11-13 15:30") })).toBe(true);
    expect(loadoutForPlan({ at: plan.at, leavesAt: null }, { finished_at: ct("2026-11-13 14:30") })).toBe(false);
  });
  it("more than a day past: asks to set a new time or clear it", () => {
    expect(lateLine(plan, { finished_at: ct("2026-11-16 04:40"), rolled: false }, Date.parse(ct("2026-11-18 05:00")), timeText))
      .toBe("Was planned to leave Mon 5:00 AM, more than a day ago. That plan doesn't lock a load-out any more. Set a new time or clear it.");
  });
});

// ---------------------------------------------------------- the actions
async function actions() { return import("../../../app/app/units/[unitId]/plan/actions"); }
const units = () => [
  { id: "ct5", company_id: CO, name: "CT-05" }, { id: "p1", company_id: CO, name: "P-01" }, { id: "p2", company_id: CO, name: "P-02" },
  { id: "x9", company_id: "co-2", name: "Other shop truck" },
];

describe("a truck that rolls while the plan page is open", () => {
  beforeEach(() => { authMock.company.role = "owner"; });
  const base = { unitId: "ct5", packageIds: ["pd"], lines: [], note: "", job: "Pump-down", leavesAt: new Date(Date.now() + 30 * 60e3).toISOString() };

  it("says it already rolled and who loaded it, saves nothing, then saves on the next tap", async () => {
    const opened = new Date(Date.now() - 7 * 60e3).toISOString();
    const fake = fakeDb({
      saas_units: units(),
      saas_packages: [{ id: "pd", company_id: CO, name: "Pump-down package", unit_id: null }],
      saas_loadout_plans: [],
      saas_loadout_scans: [{ id: "lo-1", company_id: CO, unit_id: "ct5", finished_at: new Date(Date.now() - 2 * 60e3).toISOString(), verdict: "ready", scanned_by: "Ray Hinojosa" }],
      saas_loadout_overrides: [],
    });
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const first = await savePlan({ ...base, seenAt: opened });
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/^CT-05 already rolled, loaded out by Ray Hinojosa .*This plan would be for its next job\./);
    expect(first.error).not.toContain("—");
    expect(first.seenAt).toBeTruthy();
    expect(fake.writes.filter((w) => w.table === "saas_loadout_plans")).toHaveLength(0);

    const second = await savePlan({ ...base, seenAt: first.seenAt });
    expect(second.ok).toBe(true);
    expect(fake.tables.saas_loadout_plans).toHaveLength(1);
  });

  it("a truck that rolled on a manager's override after the page opened counts too", async () => {
    const opened = new Date(Date.now() - 10 * 60e3).toISOString();
    const fake = fakeDb({
      saas_units: units(), saas_packages: [], saas_loadout_plans: [],
      saas_loadout_scans: [{ id: "lo-2", company_id: CO, unit_id: "ct5", finished_at: new Date(Date.now() - 60 * 60e3).toISOString(), verdict: "not_ready", scanned_by: "Ray Hinojosa" }],
      saas_loadout_overrides: [{ loadout_id: "lo-2", company_id: CO, created_at: new Date(Date.now() - 3 * 60e3).toISOString() }],
    });
    expect(await rolledSince(fake.client as never, CO, "ct5", opened)).toMatchObject({ by: "Ray Hinojosa" });
  });

  it("a truck that rolled before the page opened, or a blocked one, saves straight away", async () => {
    const fake = fakeDb({
      saas_units: units(), saas_packages: [{ id: "pd", company_id: CO, name: "Pump-down package", unit_id: null }], saas_loadout_plans: [],
      saas_loadout_scans: [{ id: "lo-3", company_id: CO, unit_id: "ct5", finished_at: new Date(Date.now() - 60 * 60e3).toISOString(), verdict: "ready", scanned_by: "Ray Hinojosa" }],
      saas_loadout_overrides: [],
    });
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    expect((await savePlan({ ...base, seenAt: new Date(Date.now() - 5 * 60e3).toISOString() })).ok).toBe(true);
  });

  it("saving over a plan for a later job replaces it (one open plan per truck), never a second one", async () => {
    const fake = fakeDb({
      saas_units: units(), saas_packages: [{ id: "pd", company_id: CO, name: "Pump-down package", unit_id: null }],
      saas_loadout_plans: [mondayPlan({ id: "plan-ct5", unit_id: "ct5", leaves_at: new Date(Date.now() + 10 * 864e5).toISOString() })],
      saas_loadout_scans: [], saas_loadout_overrides: [],
    });
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    expect((await savePlan({ ...base, seenAt: new Date().toISOString() })).ok).toBe(true);
    const planWrites = fake.writes.filter((w) => w.table === "saas_loadout_plans");
    expect(planWrites.map((w) => w.kind)).toEqual(["update"]);
    expect(fake.tables.saas_loadout_plans).toHaveLength(1);
  });
});

describe("moving a plan to the truck the job went on", () => {
  beforeEach(() => { authMock.company.role = "owner"; });
  const p2Plan = () => mondayPlan({ id: "plan-p2", unit_id: "p2", job: "University 7-12 #3H" });

  it("P-02 blocked: the plan moves to P-01, P-02 goes back to its kit", async () => {
    const fake = fakeDb({ saas_units: units(), saas_loadout_plans: [p2Plan()] });
    dbHolder.current = fake.client;
    const { movePlan } = await actions();
    expect(await movePlan({ unitId: "p2", toUnitId: "p1" })).toEqual({ ok: true });
    expect(fake.tables.saas_loadout_plans).toHaveLength(1);
    expect(fake.tables.saas_loadout_plans[0]).toMatchObject({ id: "plan-p2", unit_id: "p1", job: "University 7-12 #3H" });
  });

  it("won't overwrite the other truck's own plan", async () => {
    const fake = fakeDb({ saas_units: units(), saas_loadout_plans: [p2Plan(), mondayPlan({ id: "plan-p1", unit_id: "p1" })] });
    dbHolder.current = fake.client;
    const { movePlan } = await actions();
    const res = await movePlan({ unitId: "p2", toUnitId: "p1" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("P-01 already has a plan. Clear that one first, or pick another truck.");
    expect(fake.writes).toHaveLength(0);
  });

  it("never onto another company's truck", async () => {
    const fake = fakeDb({ saas_units: units(), saas_loadout_plans: [p2Plan()] });
    dbHolder.current = fake.client;
    const { movePlan } = await actions();
    expect((await movePlan({ unitId: "p2", toUnitId: "x9" })).error).toBe("That truck isn't in your account.");
    expect(fake.writes).toHaveLength(0);
  });

  it("a hand can't move a plan", async () => {
    authMock.company.role = "member";
    const fake = fakeDb({ saas_units: units(), saas_loadout_plans: [p2Plan()] });
    dbHolder.current = fake.client;
    const { movePlan } = await actions();
    expect((await movePlan({ unitId: "p2", toUnitId: "p1" })).error).toBe("Only a manager can change a plan.");
    expect(fake.writes).toHaveLength(0);
  });
});
