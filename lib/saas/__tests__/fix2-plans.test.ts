import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getOpenPlans, markPlansUsed, rolledOnOldPlans, lateLine, planTiming, planCountsFrom, type LoadoutPlan } from "../plans";
import { wallClock, fromWallClock } from "../../../app/app/units/[unitId]/plan/leave-time";
import { YARD_ZONES } from "../format";

/**
 * Planned jobs, round two:
 *  - An old plan (more than a day past its leave time) the truck has rolled
 *    on since isn't its "Next job" on the board any more, and the next roll
 *    uses it up. One that never rolled stays, with its late line.
 *  - The truck rolled on the plan while the manager had the form open: the
 *    save asks before it starts a new plan, and the new one doesn't keep the
 *    leave time of the job that already went. A plan another manager moved
 *    to another truck doesn't get saved back onto this one.
 *  - The leave time is on the truck's yard's clock (a Hobbs truck is on
 *    Mountain), and the feed line says which zone.
 *  - The plan page: the hand sees which job, and a manager sees what the
 *    yard can't fill.
 */

// ------------------------------------------------------------- a small db
type Row = Record<string, unknown>;
type Write = { table: string; kind: "insert" | "update" | "delete"; payload?: Row; filters: [string, string, unknown][] };

function fakeDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  const reads: string[] = [];
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
      reads.push(this.table);
      let out = rows.filter((r) => this.match(r));
      if (this.sort) { const { col, asc } = this.sort; out = [...out].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1)); }
      out = out.slice(0, this.max);
      return resolve({ data: this.one ? (out[0] ?? null) : out, error: null });
    }
  }
  return { client: { from: (t: string) => new Q(t) }, writes, reads, tables };
}

// ----------------------------------------------------- server action mocks
const notifyMock = vi.hoisted(() => ({ logEvent: vi.fn<(e: { message: string }) => Promise<void>>(async () => {}), notifyEvent: vi.fn(async () => {}) }));
vi.mock("../notify", () => notifyMock);
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
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT FOUND"); }),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  useRouter: () => ({ push: () => {}, refresh: () => {}, replace: () => {} }),
}));
const dispatchMock = vi.hoisted(() => ({ computeDispatchCheck: vi.fn<(...a: unknown[]) => Promise<{ planShort: string[] }>>(async () => ({ planShort: [] })) }));
vi.mock("../dispatch-check", () => dispatchMock);

const CO = "co-1";
const H = 3600e3;
const ct = (s: string) => new Date(`${s.replace(" ", "T")}:00-06:00`).toISOString(); // Central (CST)
const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });
const plan = (over: Row = {}): Row => ({
  id: "plan-ct8", company_id: CO, unit_id: "ct8", package_ids: ["pd"], lines: [], note: null, job: "University 7-12 #3H",
  planned_by: "Kevin Odom", created_at: ct("2026-11-15 20:00"), leaves_at: ct("2026-11-16 06:00"), used_at: null, ...over,
});
const asPlan = (r: Row): LoadoutPlan => ({ id: String(r.id), unitId: String(r.unit_id), packageIds: [], lines: [], note: null, job: null, by: null, at: String(r.created_at), leavesAt: (r.leaves_at as string | null) ?? null });

// ------------------------------------------------- the board's next job
describe("an old plan the truck has rolled on since isn't its next job", () => {
  const WED = Date.parse(ct("2026-11-18 05:00"));
  const tables = () => ({
    saas_loadout_plans: [
      // Monday's plan; CT-08 rolled READY Wednesday 3 AM (on that job, late, or another call).
      plan(),
      // P-02's Monday plan: it was blocked Monday and never rolled.
      plan({ id: "plan-p2", unit_id: "p2" }),
      // CT-01: Friday's plan for Monday; the only roll since was Saturday's on-call, before it counted.
      plan({ id: "plan-ct1", unit_id: "ct1", created_at: ct("2026-11-13 15:00") }),
      // CT-03: blocked Tuesday, rolled on a manager's override.
      plan({ id: "plan-ct3", unit_id: "ct3" }),
      // CT-05: Friday's job. CT-06: no leave time.
      plan({ id: "plan-ct5", unit_id: "ct5", leaves_at: ct("2026-11-20 06:00") }),
      plan({ id: "plan-ct6", unit_id: "ct6", leaves_at: null }),
      // Another company's old plan on a truck id that rolled.
      plan({ id: "plan-x", company_id: "co-2", unit_id: "x9" }),
    ],
    saas_loadout_latest: [
      { id: "lo-ct8", company_id: CO, unit_id: "ct8", finished_at: ct("2026-11-18 03:00"), verdict: "ready", scanned_by: "Freddy Carrasco" },
      { id: "lo-p2", company_id: CO, unit_id: "p2", finished_at: ct("2026-11-16 04:40"), verdict: "not_ready", scanned_by: "Ray Hinojosa" },
      { id: "lo-ct1", company_id: CO, unit_id: "ct1", finished_at: ct("2026-11-14 01:30"), verdict: "ready", scanned_by: "Ray Hinojosa" },
      { id: "lo-ct3", company_id: CO, unit_id: "ct3", finished_at: ct("2026-11-17 06:00"), verdict: "not_ready", scanned_by: "Ray Hinojosa" },
      { id: "lo-x9", company_id: "co-2", unit_id: "x9", finished_at: ct("2026-11-18 03:00"), verdict: "ready", scanned_by: "Someone" },
    ],
    saas_loadout_overrides: [{ loadout_id: "lo-ct3", company_id: CO, created_at: ct("2026-11-17 07:00") }],
  });

  it("drops CT-08's and CT-03's old plans, keeps the rest", async () => {
    const { client } = fakeDb(tables());
    const plans = await getOpenPlans(client as never, CO, WED);
    expect([...plans.keys()].sort()).toEqual(["ct1", "ct5", "ct6", "p2"]);
  });

  it("drops exactly the old plans the board would show with no late line", async () => {
    const t = tables();
    const { client } = fakeDb(t);
    const shown = await getOpenPlans(client as never, CO, WED);
    const latest = new Map(t.saas_loadout_latest.map((l) => [l.unit_id, { finished_at: String(l.finished_at), rolled: l.verdict === "ready" || l.id === "lo-ct3" }]));
    for (const r of t.saas_loadout_plans.filter((p) => p.company_id === CO)) {
      const p = asPlan(r);
      if (planTiming(p, WED) !== "old") { expect(shown.has(p.unitId)).toBe(true); continue; }
      expect(shown.has(p.unitId)).toBe(lateLine(p, latest.get(p.unitId) ?? null, WED, timeText) !== null);
    }
    expect(lateLine(asPlan(t.saas_loadout_plans[1]), latest.get("p2")!, WED, timeText)).toMatch(/more than a day ago\. That plan doesn't lock a load-out any more/);
  });

  it("says when it rolled and who loaded it out, for the plan page", async () => {
    const { client } = fakeDb(tables());
    const done = await rolledOnOldPlans(client as never, CO, [asPlan(plan()), asPlan(plan({ id: "plan-ct3", unit_id: "ct3" })), asPlan(plan({ id: "plan-p2", unit_id: "p2" }))]);
    expect(done.get("plan-ct8")).toEqual({ at: ct("2026-11-18 03:00"), by: "Freddy Carrasco" });
    expect(done.get("plan-ct3")).toEqual({ at: ct("2026-11-17 07:00"), by: "Ray Hinojosa" });
    expect(done.has("plan-p2")).toBe(false);
  });

  it("no old plans: no extra reads", async () => {
    const { client, reads } = fakeDb({ saas_loadout_plans: [plan({ leaves_at: ct("2026-11-18 06:00") })] });
    expect((await getOpenPlans(client as never, CO, WED)).size).toBe(1);
    expect(reads).toEqual(["saas_loadout_plans"]);
  });

  it("another company's plans and load-outs never count", async () => {
    const { client } = fakeDb(tables());
    const plans = await getOpenPlans(client as never, CO, WED);
    expect(plans.has("x9")).toBe(false);
    expect((await getOpenPlans(client as never, "co-2", WED)).size).toBe(0);
  });
});

describe("the roll uses up an old plan too", () => {
  const nowIso = ct("2026-11-18 03:00");
  it("CT-08 rolls READY Wednesday: Monday's plan, not the one checked, is used up by it", async () => {
    const fake = fakeDb({ saas_loadout_plans: [plan()] });
    await markPlansUsed(fake.client as never, CO, "ct8", "lo-ct8", [null], nowIso);
    expect(fake.tables.saas_loadout_plans[0]).toMatchObject({ used_at: nowIso, used_loadout_id: "lo-ct8" });
  });
  it("the plan it was checked against is used up", async () => {
    const fake = fakeDb({ saas_loadout_plans: [plan({ leaves_at: ct("2026-11-18 06:00") })] });
    await markPlansUsed(fake.client as never, CO, "ct8", "lo-ct8", ["plan-ct8"], nowIso);
    expect(fake.tables.saas_loadout_plans[0].used_loadout_id).toBe("lo-ct8");
  });
  it("Friday's plan for a later job stays open, and nothing is written", async () => {
    const fake = fakeDb({ saas_loadout_plans: [plan({ leaves_at: ct("2026-11-20 06:00") })] });
    await markPlansUsed(fake.client as never, CO, "ct8", "lo-ct8", [undefined], nowIso);
    expect(fake.tables.saas_loadout_plans[0].used_at).toBeNull();
    expect(fake.writes).toHaveLength(0);
  });
  it("never another company's plan", async () => {
    const fake = fakeDb({ saas_loadout_plans: [plan({ company_id: "co-2" })] });
    await markPlansUsed(fake.client as never, CO, "ct8", "lo-ct8", ["plan-ct8"], nowIso);
    expect(fake.tables.saas_loadout_plans[0].used_at).toBeNull();
    expect(fake.writes.every((w) => w.filters.some(([c, , v]) => c === "company_id" && v === CO))).toBe(true);
  });
  it("counts from when it was made, or 18 hours before it leaves", () => {
    expect(planCountsFrom({ at: ct("2026-11-13 15:00"), leavesAt: ct("2026-11-16 06:00") })).toBe(Date.parse(ct("2026-11-15 12:00")));
    expect(planCountsFrom({ at: ct("2026-11-15 20:00"), leavesAt: ct("2026-11-16 06:00") })).toBe(Date.parse(ct("2026-11-15 20:00")));
  });
});

// ------------------------------------------- the truck rolled on the plan
async function actions() { return import("../../../app/app/units/[unitId]/plan/actions"); }
const units = () => [
  { id: "ct1", company_id: CO, name: "CT-01", yard_id: "midland" }, { id: "ct2", company_id: CO, name: "CT-02", yard_id: "midland" },
  { id: "h1", company_id: CO, name: "H-01", yard_id: "hobbs" }, { id: "x9", company_id: "co-2", name: "Other shop truck", yard_id: null },
];
const yards = () => [
  { id: "midland", company_id: CO, time_zone: "America/Chicago" }, { id: "hobbs", company_id: CO, time_zone: "America/Denver" },
];

describe("Kevin saves the plan after Freddy rolled CT-01 on it", () => {
  beforeEach(() => { authMock.company.role = "owner"; notifyMock.logEvent.mockClear(); });
  const leaves = new Date(Date.now() + 20 * 60e3).toISOString();
  const used = () => ({
    id: "plan-ct1", company_id: CO, unit_id: "ct1", package_ids: ["pd"], lines: [], note: null, job: "University 7-12 #3H",
    planned_by: "Kevin Odom", created_at: new Date(Date.now() - 3 * H).toISOString(), leaves_at: leaves,
    used_at: new Date(Date.now() - 2 * 60e3).toISOString(), used_loadout_id: "lo-1",
  });
  const world = (planRows: Row[]) => fakeDb({
    saas_units: units(), saas_yards: yards(),
    saas_packages: [{ id: "pd", company_id: CO, name: "Pump-down package", unit_id: null }],
    saas_loadout_plans: planRows,
    saas_loadout_scans: [{ id: "lo-1", company_id: CO, unit_id: "ct1", finished_at: new Date(Date.now() - 2 * 60e3).toISOString(), verdict: "ready", scanned_by: "Freddy Carrasco" }],
    saas_loadout_overrides: [],
  });
  const form = { unitId: "ct1", packageIds: ["pd"], lines: [], note: "Bring the spare sinker bar", job: "University 7-12 #3H", leavesAt: leaves, seenAt: new Date(Date.now() - 7 * 60e3).toISOString(), planId: "plan-ct1" };

  it("says it already rolled on this plan, by whom, and saves nothing", async () => {
    const fake = world([used()]);
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const res = await savePlan(form);
    expect(res.ok).toBe(false);
    expect(res.usedUp).toBe(true);
    expect(res.error).toMatch(/^CT-01 already rolled on this plan, loaded out by Freddy Carrasco .* CT\. Save it as the next job instead\?/);
    expect(res.error).not.toContain("—");
    expect(fake.writes).toHaveLength(0);
  });

  it("saved as the next job: a new plan, without the leave time of the job that went", async () => {
    const fake = world([used()]);
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const res = await savePlan({ ...form, nextJob: true });
    expect(res.ok).toBe(true);
    const open = fake.tables.saas_loadout_plans.filter((p) => !p.used_at);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ unit_id: "ct1", leaves_at: null, note: "Bring the spare sinker bar" });
    // The one it rolled on stays used up.
    expect(fake.tables.saas_loadout_plans.find((p) => p.id === "plan-ct1")?.used_loadout_id).toBe("lo-1");
  });

  it("saved as the next job with its own leave time: that time stays", async () => {
    const fake = world([used()]);
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const tomorrow = new Date(Date.now() + 24 * H).toISOString();
    expect((await savePlan({ ...form, leavesAt: tomorrow, nextJob: true })).ok).toBe(true);
    expect(fake.tables.saas_loadout_plans.find((p) => !p.used_at)?.leaves_at).toBe(tomorrow);
  });

  it("the next-job flag on a plan that wasn't used changes nothing: the rolled-since check still runs", async () => {
    const fake = world([{ ...used(), used_at: null, used_loadout_id: null, leaves_at: new Date(Date.now() + 30 * H).toISOString() }]);
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const res = await savePlan({ ...form, nextJob: true });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/This plan would be for its next job/);
  });

  it("a plan another manager moved to CT-02 isn't saved back onto CT-01", async () => {
    const fake = world([{ ...used(), unit_id: "ct2", used_at: null, used_loadout_id: null }]);
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const res = await savePlan(form);
    expect(res).toEqual({ ok: false, error: "This plan moved to CT-02. Change it on CT-02's plan." });
    expect(fake.writes).toHaveLength(0);
  });

  it("another company's plan id tells nothing and is ignored", async () => {
    const fake = world([{ ...used(), company_id: "co-2", unit_id: "x9" }]);
    fake.tables.saas_loadout_scans = [];
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const res = await savePlan(form);
    expect(res.ok).toBe(true);
    expect(fake.tables.saas_loadout_plans.filter((p) => p.company_id === CO)).toHaveLength(1);
    expect(fake.tables.saas_loadout_plans.find((p) => p.company_id === "co-2")?.unit_id).toBe("x9");
  });

  it("a hand can't save a plan", async () => {
    authMock.company.role = "member";
    const fake = world([]);
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    expect((await savePlan(form)).error).toBe("Only a manager can plan a load-out.");
    expect(fake.writes).toHaveLength(0);
  });
});

describe("the feed line reads on the truck's yard's clock", () => {
  beforeEach(() => { authMock.company.role = "owner"; notifyMock.logEvent.mockClear(); });
  it("a Hobbs truck's leave time is in Mountain, with MT on it", async () => {
    const fake = fakeDb({ saas_units: units(), saas_yards: yards(), saas_packages: [], saas_loadout_plans: [], saas_loadout_scans: [], saas_loadout_overrides: [] });
    dbHolder.current = fake.client;
    const { savePlan } = await actions();
    const leaves = new Date(Date.now() + 5 * H);
    expect((await savePlan({ unitId: "h1", packageIds: [], lines: [], note: "", job: "Hobbs pump-down", leavesAt: leaves.toISOString() })).ok).toBe(true);
    const msg = notifyMock.logEvent.mock.calls[0][0].message;
    const mt = leaves.toLocaleString("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    expect(msg).toContain(`Leaves ${mt} MT`);
  });
});

// --------------------------------------------- the time picker's clock
describe("the leave time is on the yard's clock, not the phone's", () => {
  it("5:00 for a Hobbs truck is 5:00 Mountain, whatever zone the phone is in", () => {
    expect(fromWallClock("2026-11-16T05:00", "America/Denver")).toBe("2026-11-16T12:00:00.000Z");
    expect(fromWallClock("2026-11-16T05:00", "America/Chicago")).toBe("2026-11-16T11:00:00.000Z");
    expect(wallClock("2026-11-16T12:00:00.000Z", "America/Denver")).toBe("2026-11-16T05:00");
    expect(wallClock("2026-11-16T12:00:00.000Z", "America/Chicago")).toBe("2026-11-16T06:00");
  });
  it("summer time and the night the clocks go back", () => {
    expect(fromWallClock("2026-07-01T05:00", "America/Denver")).toBe("2026-07-01T11:00:00.000Z");
    expect(fromWallClock("2026-10-31T23:00", "America/Chicago")).toBe("2026-11-01T04:00:00.000Z");
    expect(fromWallClock("2026-11-01T05:00", "America/Chicago")).toBe("2026-11-01T11:00:00.000Z");
    expect(wallClock("2026-11-17T06:00:00.000Z", "America/Chicago")).toBe("2026-11-17T00:00");
  });
  it("every yard zone reads back what was typed", () => {
    for (const { tz } of YARD_ZONES) {
      for (const wall of ["2026-01-15T00:00", "2026-03-20T05:30", "2026-07-04T13:45", "2026-11-16T23:59"]) {
        expect(wallClock(fromWallClock(wall, tz), tz)).toBe(wall);
      }
    }
  });
  it("nothing typed, or not a time: no leave time", () => {
    expect(wallClock(null, "America/Chicago")).toBe("");
    expect(wallClock("not a date", "America/Chicago")).toBe("");
    expect(fromWallClock("", "America/Chicago")).toBeNull();
    expect(fromWallClock("tomorrow", "America/Chicago")).toBeNull();
  });
});

// ------------------------------------------------------- the plan page
async function renderPlanPage() {
  const { default: PlanPage } = await import("../../../app/app/units/[unitId]/plan/page");
  return renderToStaticMarkup(await PlanPage({ params: Promise.resolve({ unitId: "h1" }) }));
}

describe("the plan page", () => {
  beforeEach(() => { authMock.company.role = "owner"; dispatchMock.computeDispatchCheck.mockClear(); });
  const leaves = new Date(Date.now() + 2 * H).toISOString();
  const page = (planRow: Row, extra: Record<string, Row[]> = {}) => fakeDb({
    saas_units: units(), saas_yards: yards(),
    saas_packages: [{ id: "pd", company_id: CO, name: "Pump-down package", unit_id: null, saas_package_lines: [{ label: "Lubricator", qty: 1, sort: 0 }] }],
    saas_assets: [], saas_returns: [], saas_loadout_scans: [], saas_loadout_overrides: [], saas_loadout_latest: [],
    saas_loadout_plans: [planRow], ...extra,
  });
  const hobbsPlan = (over: Row = {}): Row => ({
    id: "plan-h1", company_id: CO, unit_id: "h1", package_ids: ["pd"], lines: [], note: null, job: "University 7-12 #3H",
    planned_by: "Kevin Odom", created_at: new Date(Date.now() - H).toISOString(), leaves_at: leaves, used_at: null, ...over,
  });

  it("the hand sees which job it's for, on the yard's clock", async () => {
    authMock.company.role = "member";
    dbHolder.current = page(hobbsPlan()).client;
    const html = await renderPlanPage();
    expect(html).toContain(" for University 7-12 #3H, leaves ");
    expect(html).toMatch(/leaves [A-Z][a-z]{2} \d+, \d+:\d\d [AP]M MT: Pump-down package/);
    expect(dispatchMock.computeDispatchCheck).not.toHaveBeenCalled();
  });

  it("a manager sees what the yard can't fill, checked as of the day it leaves; the form is on Mountain", async () => {
    dispatchMock.computeDispatchCheck.mockResolvedValueOnce({ planShort: ["Pump-down package needs Lubricator. No good one on the truck or free in the yard. The load-out will block without it."] });
    dbHolder.current = page(hobbsPlan()).client;
    const html = await renderPlanPage();
    expect(html).toContain("The yard can&#x27;t fill all of this plan:");
    expect(html).toContain("Pump-down package needs Lubricator.");
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date(leaves));
    expect(dispatchMock.computeDispatchCheck).toHaveBeenCalledWith(expect.anything(), CO, "h1", day);
    expect(html).toContain("(MT, optional)");
    expect(html).toContain(`value="${wallClock(leaves, "America/Denver")}"`);
  });

  it("nothing short: no yard box, and the save is never held up by it", async () => {
    dbHolder.current = page(hobbsPlan()).client;
    const html = await renderPlanPage();
    expect(html).not.toContain("The yard can&#x27;t fill");
    expect(html).toContain("Save the plan");
  });

  it("an old plan the truck has rolled on since says so, and isn't checked against the yard", async () => {
    const old = hobbsPlan({ created_at: new Date(Date.now() - 60 * H).toISOString(), leaves_at: new Date(Date.now() - 50 * H).toISOString() });
    dbHolder.current = page(old, {
      saas_loadout_latest: [{ id: "lo-h1", company_id: CO, unit_id: "h1", finished_at: new Date(Date.now() - 3 * H).toISOString(), verdict: "ready", scanned_by: "Freddy Carrasco" }],
    }).client;
    const html = await renderPlanPage();
    expect(html).toContain("H-01 has rolled since, loaded out by Freddy Carrasco");
    expect(html).toContain("so Load out doesn&#x27;t show it as the next job any more");
    expect(html).not.toContain("never rolled on it");
    expect(dispatchMock.computeDispatchCheck).not.toHaveBeenCalled();
  });

  it("an old plan that never rolled still says so", async () => {
    const old = hobbsPlan({ created_at: new Date(Date.now() - 60 * H).toISOString(), leaves_at: new Date(Date.now() - 50 * H).toISOString() });
    dbHolder.current = page(old).client;
    const html = await renderPlanPage();
    expect(html).toContain("and H-01 never rolled on it");
  });
});
