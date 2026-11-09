import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildLoadOutTrucks, weekNumbers, kitShortByTruck, type LoadoutScanRow } from "../loadout-board";
import { pieceProblem, type EquipRow } from "../equipment";
import type { UnitTile } from "../readiness";

/**
 * The busy-week fixes for equipment, moves, red tags and the board. Pure board
 * rules first, then the real server actions against a small in-memory stand-in
 * for the database (it supports .is(), which the shared fake doesn't).
 */

type Row = Record<string, unknown>;
interface Write { table: string; kind: "insert" | "update" | "delete"; payload?: unknown; filters: Record<string, unknown>; client: string }

class Q {
  private rows: Row[];
  private one = false;
  private w: Write | null = null;
  private desc: string | null = null;
  private max: number | null = null;
  constructor(private table: string, data: Row[], private log: Write[], private client: string) { this.rows = [...data]; }
  select() { return this; }
  or() { return this; }
  range() { return this; }
  order(col: string, o?: { ascending?: boolean }) { if (o?.ascending === false) this.desc = col; return this; }
  limit(n: number) { this.max = n; return this; }
  eq(c: string, v: unknown) { if (this.w) this.w.filters[c] = v; else this.rows = this.rows.filter((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { if (!this.w) this.rows = this.rows.filter((r) => r[c] !== v); return this; }
  in(c: string, v: unknown[]) { if (this.w) this.w.filters[c] = v; else this.rows = this.rows.filter((r) => v.includes(r[c])); return this; }
  is(c: string, v: unknown) { if (this.w) this.w.filters[`${c} is`] = v; else this.rows = this.rows.filter((r) => (r[c] ?? null) === v); return this; }
  not() { return this; }
  gte() { return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  insert(p: unknown) { this.w = { table: this.table, kind: "insert", payload: p, filters: {}, client: this.client }; this.log.push(this.w); return this; }
  update(p: unknown) { this.w = { table: this.table, kind: "update", payload: p, filters: {}, client: this.client }; this.log.push(this.w); return this; }
  delete() { this.w = { table: this.table, kind: "delete", filters: {}, client: this.client }; this.log.push(this.w); return this; }
  then<T>(res: (v: { data: unknown; error: null }) => T): T {
    if (this.w) return res({ data: this.one ? { id: "new-id" } : [], error: null });
    let rows = this.rows;
    if (this.desc) { const c = this.desc; rows = [...rows].sort((a, b) => String(b[c]).localeCompare(String(a[c]))); }
    if (this.max !== null) rows = rows.slice(0, this.max);
    return res({ data: this.one ? (rows[0] ?? null) : rows, error: null });
  }
}
function fakeDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  const make = (client: string) => ({ from: (t: string) => new Q(t, tables[t] ?? [], writes, client) });
  return { session: make("session"), admin: make("admin"), writes };
}

vi.mock("../notify", () => ({
  notifyEvent: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
  logEventNow: vi.fn(async () => {}),
}));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Spy Coil Tubing", role: "member", subscription_status: "active", comped: false },
  user: { id: "user-1", email: "tito@example.com", user_metadata: { full_name: "Tito Garza" } },
}));
vi.mock("../auth", () => ({
  requireCompany: vi.fn(async () => authMock),
  requireBillableCompany: vi.fn(async () => authMock),
  assertCan: () => {},
}));
const dbHolder = vi.hoisted(() => ({ session: null as unknown, admin: null as unknown }));
vi.mock("../db", () => ({ saasDb: async () => dbHolder.session, saasAdmin: () => dbHolder.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));

const CO = "co-1";
const unit = (id: string, state: UnitTile["state"], why = `${id} why`): UnitTile =>
  ({ id, name: id.toUpperCase(), type: "coil_tubing_unit", yardId: "y", yardName: "Yard", state, why, crewWorst: null });
const scan = (unit_id: string, finished_at: string, extra: Partial<LoadoutScanRow> = {}): LoadoutScanRow =>
  ({ id: `lo-${unit_id}`, unit_id, finished_at, scanned_by: "Ray Hinojosa", verdict: "ready", reasons: [], pieces: [], not_scanned: [], ...extra });
const TODAY = "2026-11-10";
const NOW = Date.parse("2026-11-10T18:00:00Z");

describe("the board, for a truck out on a job", () => {
  it("bad iron on a truck that's out reads red, not a quiet Out on a job", () => {
    const { trucks } = buildLoadOutTrucks([unit("ct8", "not_ready", "Swivel SW-1180: expired 12d ago")], [], [scan("ct8", "2026-11-10T11:10:00Z")], new Set(), TODAY, new Map(), { now: NOW });
    expect(trucks[0].status).toBe("out");
    expect(trucks[0].why).toBe("Out on a job and NOT READY now: Swivel SW-1180: expired 12d ago");
    expect(trucks[0].whyTone).toBe("red");
  });
  it("out too long still says so first", () => {
    const { trucks } = buildLoadOutTrucks([unit("ct8", "not_ready")], [], [scan("ct8", "2026-11-01T11:00:00Z")], new Set(), TODAY, new Map(), { now: NOW, alertDays: 7 });
    expect(trucks[0].why).toBe("Out 9 days. Check it in, or find out where it is.");
  });
  it("a hand's board (the crew on the job see it) says how long, without telling them to check it in", () => {
    const { trucks } = buildLoadOutTrucks([unit("ct8", "ready")], [], [scan("ct8", "2026-11-01T11:00:00Z")], new Set(), TODAY, new Map(), { now: NOW, alertDays: 7, hand: true });
    expect(trucks[0].why).toBe("Out 9 days.");
    expect(trucks[0].outTooLong).toBe(true);
  });
  it("names the manager who rolled it on an override, and the hand who loaded it", () => {
    const s = scan("ct6", "2026-11-10T11:05:00Z", { verdict: "not_ready", reasons: ["Out of test: PV-2231"] });
    const { trucks } = buildLoadOutTrucks([unit("ct6", "ready")], [], [s], new Map([[s.id, { at: "2026-11-10T11:20:00Z", by: "Kevin Odom" }]]), TODAY, new Map(), { now: NOW });
    expect(trucks[0].loadoutLine).toBe("Out on Kevin Odom's override since today 5:20 AM. Loaded by Ray Hinojosa");
    // No name known (an old caller): the old wording.
    const old = buildLoadOutTrucks([unit("ct6", "ready")], [], [s], new Map([[s.id, "2026-11-10T11:20:00Z"]]), TODAY, new Map(), { now: NOW });
    expect(old.trucks[0].loadoutLine).toBe("Out on a manager's override since today 5:20 AM by Ray Hinojosa");
  });
});

describe("the board, for a truck blocked only on its own paper", () => {
  const blocked = scan("p2", "2026-11-09T11:12:00Z", { verdict: "not_ready", reasons: ["Truck paper: Annual DOT inspection expired Oct 17, 2026 (23d ago)"] });
  it("once the paper is good, it says so instead of the old date, and still asks for a new scan", () => {
    const { trucks } = buildLoadOutTrucks([unit("p2", "ready")], [], [blocked], new Set(), TODAY, new Map(), { now: NOW });
    expect(trucks[0].status).toBe("blocked");
    expect(trucks[0].why).toBe("Blocked Nov 9 on truck paper. That paper is good now. Scan it again to roll.");
    expect(trucks[0].whyTone).toBe("amber");
  });
  it("while the paper is still bad, the load-out's reason stays up in red", () => {
    const { trucks } = buildLoadOutTrucks([unit("p2", "not_ready")], [], [blocked], new Set(), TODAY, new Map(), { now: NOW });
    expect(trucks[0].why).toBe("Truck paper: Annual DOT inspection expired Oct 17, 2026 (23d ago)");
    expect(trucks[0].whyTone).toBe("red");
  });
});

describe("kit short leaves out iron still on the last job", () => {
  it("a valve marked still out at the check-in doesn't fill the kit line", () => {
    const valve = { id: "pv8", unitId: "ct8", name: "2in 1502 plug valve", identifier: "PV-2208", state: "ok", outSince: "2026-10-31T11:00:00Z" } as EquipRow;
    const kits = new Map([["ct8", [{ label: "2in 1502 plug valve", qty: 1 }]]]);
    expect(kitShortByTruck(kits, [valve]).size).toBe(0);
    expect(kitShortByTruck(kits, [valve], new Map([["ct8", "2026-11-13T20:00:00Z"]])).get("ct8")).toMatch(/^Kit short: 2in 1502 plug valve\./);
  });
});

describe("bad pieces caught", () => {
  it("leaves out pieces that rolled on an override, and counts a retry's same piece once", () => {
    const week = weekNumbers([
      { id: "a", finished_at: "2026-11-10T11:00:00Z", pieces: [{ red: true, asset_id: "sw1" }] },
      { id: "b", finished_at: "2026-11-10T11:30:00Z", pieces: [{ red: true, asset_id: "sw1" }] },
      { id: "c", finished_at: "2026-11-11T11:00:00Z", pieces: [{ red: true, asset_id: "sw1" }] },
      { id: "ov", finished_at: "2026-11-10T12:00:00Z", pieces: [{ red: true, asset_id: "pv9" }] },
    ], 1, new Set(["ov"]));
    expect(week).toEqual({ loadouts: 4, caught: 2, overrides: 1 });
  });
});

describe("pieceProblem: the load-out's rules for one piece", () => {
  const good = { title: "UT + hydro recert", expiration_date: "2027-01-15", last_upload_id: "up-1" };
  it("names what's wrong, worst first", () => {
    expect(pieceProblem({ status: "out_of_service", category: "flow_iron" }, [good], TODAY)).toBe("red-tagged");
    expect(pieceProblem({ status: "missing", category: "flow_iron" }, [good], TODAY)).toBe("flagged missing");
    expect(pieceProblem({ status: "in_service", category: "flow_iron", needs_redress_since: "2026-11-09" }, [good], TODAY)).toBe("needs redress");
    expect(pieceProblem({ status: "in_service", category: "pressure_control" }, [], TODAY)).toBe("no test on file");
    expect(pieceProblem({ status: "in_service", category: "flow_iron" }, [{ ...good, expiration_date: "2026-10-29" }], TODAY)).toMatch(/^out of test \(UT \+ hydro recert expired Oct 29/);
    expect(pieceProblem({ status: "in_service", category: "flow_iron" }, [{ ...good, last_upload_id: null }], TODAY)).toBe("no paper (UT + hydro recert)");
    expect(pieceProblem({ status: "in_service", category: "flow_iron" }, [good], TODAY)).toBeNull();
  });
});

// ── Move it ──
const ct8 = { id: "ct8", name: "CT-08", yard_id: "ody", company_id: CO };
const ct2 = { id: "ct2", name: "CT-02", yard_id: "ody", company_id: CO };
function moveDb(asset: Row, extra: Record<string, Row[]> = {}) {
  const f = fakeDb({
    saas_units: [ct8, ct2],
    saas_yards: [{ id: "ody", name: "Odessa Yard", company_id: CO }],
    saas_assets: [{ company_id: CO, identifier: null, category: "flow_iron", unit_id: null, out_since: null, out_loadout_id: null, out_with_user: null, redress_each_run: false, needs_redress_since: null, ...asset }],
    saas_compliance_items: [],
    saas_loadout_scans: [], saas_returns: [], saas_loadout_overrides: [],
    ...extra,
  });
  dbHolder.session = f.session; dbHolder.admin = f.admin;
  return f;
}
const moveFd = (id: string, where: string, note = "") => { const fd = new FormData(); fd.set("id", id); fd.set("where", where); fd.set("note", note); return fd; };
// CT-08 rolled READY this morning and nobody has checked it in.
const ct8Out = { saas_loadout_scans: [{ id: "lo-8", unit_id: "ct8", company_id: CO, finished_at: "2026-11-10T11:10:00Z", verdict: "ready", reasons: [], pieces: [], not_scanned: [] }] };

describe("Move it", () => {
  beforeEach(async () => {
    const n = await import("../notify");
    vi.mocked(n.notifyEvent).mockClear(); vi.mocked(n.logEvent).mockClear();
  });

  it("a piece flagged missing that gets moved is found (a red tag would stay on)", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "pv3019", name: "3in 1502 plug valve", identifier: "PV-3019", status: "missing" });
    await moveEquipment(moveFd("pv3019", "yard:ody", "found under the catwalk"));
    const found = f.writes.find((w) => w.table === "saas_assets" && (w.payload as Row).status === "in_service");
    expect(found?.client).toBe("session"); // so the database logs it under the mover's name
    expect(found?.filters).toMatchObject({ id: "pv3019", company_id: CO, status: "missing" });
  });

  it("a red-tagged piece that gets moved keeps its tag", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "pv1", name: "Plug valve", status: "out_of_service" });
    await moveEquipment(moveFd("pv1", "yard:ody"));
    expect(f.writes.some((w) => w.table === "saas_assets" && "status" in (w.payload as Row))).toBe(false);
  });

  it("onto a truck that's out on a job: it joins the trip, its clock starts now", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "bask", name: "Crossover subs basket", category: "equipment" }, ct8Out);
    await moveEquipment(moveFd("bask", "unit:ct8"));
    const out = f.writes.find((w) => w.table === "saas_assets" && w.client === "admin" && "out_since" in (w.payload as Row));
    expect(out?.payload).toMatchObject({ out_loadout_id: "lo-8" });
    expect((out?.payload as Row).out_since).not.toBeNull();
    const n = await import("../notify");
    expect(vi.mocked(n.notifyEvent)).not.toHaveBeenCalled(); // nothing wrong with it
  });

  it("onto a truck in the yard: off any job, as before", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "bask", name: "Crossover subs basket", out_since: "2026-11-01T11:00:00Z", out_loadout_id: "lo-old" });
    await moveEquipment(moveFd("bask", "unit:ct2"));
    const out = f.writes.find((w) => w.table === "saas_assets" && w.client === "admin" && "out_since" in (w.payload as Row));
    expect(out?.payload).toMatchObject({ out_since: null, out_loadout_id: null });
  });

  it("a truck checked in since its load-out is home, not out", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "bask", name: "Basket" }, { ...ct8Out, saas_returns: [{ unit_id: "ct8", company_id: CO, finished_at: "2026-11-10T20:00:00Z" }] });
    await moveEquipment(moveFd("bask", "unit:ct8"));
    expect(f.writes.some((w) => w.table === "saas_assets" && (w.payload as Row).out_loadout_id === "lo-8")).toBe(false);
  });

  it("out-of-test iron put on a truck after it loaded out still moves, and the managers hear about it", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "sw1180", name: "2in 1502 swivel", identifier: "SW-1180" }, {
      ...ct8Out,
      saas_compliance_items: [{ company_id: CO, parent_type: "asset", parent_id: "sw1180", title: "UT + hydro recert", expiration_date: "2026-10-29", last_upload_id: "up-1", pending_until: null, reminder_days: 30 }],
    });
    await moveEquipment(moveFd("sw1180", "unit:ct8", "hot-shot to location"));
    expect(f.writes.some((w) => w.table === "saas_assets" && (w.payload as Row).unit_id === "ct8")).toBe(true);
    const n = await import("../notify");
    const msg = String(vi.mocked(n.notifyEvent).mock.calls[0]?.[0]?.message);
    expect(msg).toMatch(/^2in 1502 swivel SW-1180 put on CT-08 after it loaded out: out of test \(UT \+ hydro recert expired Oct 29/);
    expect(msg).toMatch(/Moved by Tito Garza$/);
    expect(vi.mocked(n.notifyEvent).mock.calls[0]?.[0]).toMatchObject({ yardId: "ody", href: "/app/units/ct8" });
    expect(vi.mocked(n.logEvent).mock.calls.find((c) => c[0].kind === "bad_iron_out")?.[0]).toMatchObject({ unitId: "ct8", message: msg });
  });

  it("a new note on a piece already out on that truck's trip leaves its clock alone", async () => {
    const { moveEquipment } = await import("../../../app/app/equipment/actions");
    const f = moveDb({ id: "pv8", name: "Plug valve", unit_id: "ct8", out_since: "2026-11-10T11:10:00Z", out_loadout_id: "lo-8" }, ct8Out);
    await moveEquipment(moveFd("pv8", "unit:ct8", "on the wellhead"));
    expect(f.writes.some((w) => w.table === "saas_assets" && "out_since" in (w.payload as Row))).toBe(false);
  });
});

// ── Red tags ──
function tagDb(asset: Row) {
  const f = fakeDb({
    saas_assets: [{ company_id: CO, identifier: "SL-A", unit_id: "cr1", yard_id: "ody", ...asset }],
    saas_units: [{ id: "cr1", name: "CR-01", company_id: CO }],
  });
  dbHolder.session = f.session; dbHolder.admin = f.admin;
  return f;
}
const statusFd = (status: string, extra: Record<string, string> = {}) => {
  const fd = new FormData(); fd.set("id", "sla"); fd.set("status", status);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
};

describe("red-tagging from the piece's page", () => {
  beforeEach(async () => {
    const n = await import("../notify");
    vi.mocked(n.notifyEvent).mockClear(); vi.mocked(n.logEventNow).mockClear();
    authMock.company.role = "member";
  });

  it("asks why, and saves nothing without it", async () => {
    const { updateAsset } = await import("../../../app/app/_actions");
    const f = tagDb({ id: "sla", name: "Wire rope slings, set A", status: "in_service" });
    await expect(updateAsset(statusFd("out_of_service"))).rejects.toThrow(/REDIRECT .*Say%20what's%20wrong/);
    expect(f.writes).toHaveLength(0);
  });

  it("keeps who and why on the piece, logs it, and tells the managers", async () => {
    const { updateAsset } = await import("../../../app/app/_actions");
    const f = tagDb({ id: "sla", name: "Wire rope slings, set A", status: "in_service" });
    await expect(updateAsset(statusFd("out_of_service", { tag_note: "cut near the eye" }))).rejects.toThrow(/REDIRECT \/app\/assets\/sla$/);
    const w = f.writes.find((x) => x.table === "saas_assets" && x.kind === "update");
    expect(w?.payload).toMatchObject({ status: "out_of_service", last_seen_where: "red-tagged: cut near the eye", last_seen_by: "Tito Garza" });
    const n = await import("../notify");
    const msg = "Wire rope slings, set A SL-A on CR-01 red-tagged by Tito Garza: cut near the eye";
    expect(vi.mocked(n.logEventNow).mock.calls.at(-1)?.[0]).toMatchObject({ kind: "red_tagged", unitId: "cr1", message: msg });
    expect(vi.mocked(n.notifyEvent).mock.calls.at(-1)?.[0]).toMatchObject({ yardId: "ody", message: msg, href: "/app/assets/sla" });
  });

  it("a red tag comes off only with a full sentence on what was done", async () => {
    const { updateAsset } = await import("../../../app/app/_actions");
    authMock.company.role = "owner";
    try {
      const f = tagDb({ id: "sla", name: "Wire rope slings, set A", status: "out_of_service" });
      const fd = statusFd("in_service", { clear_note: "fine.", name: "Wire rope slings, set A", category: "other" });
      await expect(updateAsset(fd)).rejects.toThrow(/REDIRECT .*full%20sentence/);
      expect(f.writes).toHaveLength(0);
    } finally {
      authMock.company.role = "member";
    }
  });

  it("a red tag taken off goes on the piece's history, and the old red-tag note doesn't stay on the list", async () => {
    const { updateAsset } = await import("../../../app/app/_actions");
    authMock.company.role = "owner";
    try {
      const f = tagDb({ id: "sla", name: "Wire rope slings, set A", status: "out_of_service", last_seen_where: "red-tagged: cut near the eye" });
      const fd = statusFd("in_service", { clear_note: "new set of slings, tagged and inspected", name: "Wire rope slings, set A", category: "other" });
      await expect(updateAsset(fd)).rejects.toThrow(/REDIRECT \/app\/assets\/sla$/);
      const w = f.writes.find((x) => x.table === "saas_assets" && x.kind === "update");
      expect(w?.payload).toMatchObject({ status: "in_service", last_seen_where: "red tag off: new set of slings, tagged and inspected", last_seen_by: "Tito Garza" });
      const n = await import("../notify");
      expect(vi.mocked(n.logEventNow).mock.calls.at(-1)?.[0]).toMatchObject({ kind: "asset_status", message: 'Tito Garza took the red tag off Wire rope slings, set A SL-A: "new set of slings, tagged and inspected"' });
    } finally {
      authMock.company.role = "member";
    }
  });

  it("a plain save on a piece in service writes no red-tag note", async () => {
    const { updateAsset } = await import("../../../app/app/_actions");
    const f = tagDb({ id: "sla", name: "Wire rope slings, set A", status: "in_service" });
    await expect(updateAsset(statusFd("in_service"))).rejects.toThrow(/REDIRECT \/app\/assets\/sla$/);
    const w = f.writes.find((x) => x.table === "saas_assets" && x.kind === "update");
    expect(w?.payload).toEqual({ status: "in_service" });
  });
});

// ── Deleting paper ──
describe("deleting a truck's paper", () => {
  it("names the truck, files the line under it, and says when the paper was failing", async () => {
    const { deleteComplianceItem } = await import("../../../app/app/_actions");
    const f = fakeDb({
      saas_compliance_items: [{ id: "dot2", company_id: CO, title: "Annual DOT inspection", parent_type: "unit", parent_id: "p2", expiration_date: "2026-10-17", last_upload_id: "up-9", pending_until: null, reminder_days: 30 }],
      saas_units: [{ id: "p2", name: "P-02", company_id: CO }],
    });
    dbHolder.session = f.session; dbHolder.admin = f.admin;
    const n = await import("../notify");
    vi.mocked(n.logEvent).mockClear();
    const fd = new FormData(); fd.set("id", "dot2"); fd.set("redirect_path", "");
    await deleteComplianceItem(fd);
    const call = vi.mocked(n.logEvent).mock.calls.at(-1)?.[0];
    expect(call?.kind).toBe("deleted_failing");
    expect(call?.unitId).toBe("p2");
    expect(call?.message).toMatch(/^Annual DOT inspection on P-02 deleted by Tito Garza\. It was failing: expired Oct 17, 2026/);
  });
});
