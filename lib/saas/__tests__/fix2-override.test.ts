import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToStaticMarkup } from "react-dom/server";
import { localToday, addDaysIso } from "../status";

/**
 * Overrides and the Paper check, round two:
 *  - Blocked only on the truck's own paper, and that paper is good now: the
 *    Paper check says so the way the board does ("Scan it again to roll"),
 *    and doesn't steer a manager to an override the truck doesn't need.
 *  - An override uses up the plan this load-out was for, not a plan for a
 *    later job that only started to count since.
 *  - The load-out record reads in its yard's zone, and a manager whose
 *    truck came up short with a piece added on top can go change the kit.
 */

vi.mock("../notify", () => ({
  sendEmail: vi.fn(async () => true),
  sendSms: vi.fn(async () => true),
  smsConfigured: () => false,
  notifyEvent: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
}));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Test Yard Co", role: "owner", subscription_status: "active", comped: false, yard_quantity: 1 },
  user: { id: "user-mgr", email: "mgr@example.com", user_metadata: { full_name: "Yard Manager" } },
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
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  notFound: vi.fn(() => { throw new Error("NOT FOUND"); }),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { computeDispatchCheck } from "../dispatch-check";

const CO = "co-1";
const H = 3600e3;
const ago = (h: number) => new Date(Date.now() - h * H).toISOString();
const ahead = (h: number) => new Date(Date.now() + h * H).toISOString();
const TODAY = localToday();
const FUTURE = addDaysIso(TODAY, 300);
const PAST = addDaysIso(TODAY, -3);

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
    not() { return this; }
    eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
    neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
    is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
    in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
    gt(c: string, v: unknown) { this.filters.push([c, "gt", v]); return this; }
    gte(c: string, v: unknown) { this.filters.push([c, "gte", v]); return this; }
    lt(c: string, v: unknown) { this.filters.push([c, "lt", v]); return this; }
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
        : op === "lt" ? String(r[c] ?? "") < String(v)
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

/** P-02: its DOT and its one valve, both current unless a test says otherwise. */
function p02(over: { dot?: string; valve?: string } = {}, extra: Record<string, Row[]> = {}) {
  return {
    saas_units: [{ id: "u2", name: "P-02", type: "pump", yard_id: "y1", company_id: CO }],
    saas_yards: [{ id: "y1", name: "West yard", time_zone: "America/Denver", company_id: CO }],
    saas_packages: [],
    saas_package_lines: [],
    saas_assets: [{ id: "pv1", name: "2in 1502 plug valve", identifier: "PV-2231", status: "in_service", category: "flow_iron", needs_redress_since: null, unit_id: "u2", yard_id: "y1", company_id: CO }],
    saas_compliance_items_with_status: [
      { id: "c-dot", title: "Annual DOT inspection", expiration_date: over.dot ?? FUTURE, parent_type: "unit", parent_id: "u2", company_id: CO, last_upload_id: "up1" },
      { id: "c-pv1", title: "Iron recert", expiration_date: over.valve ?? FUTURE, parent_type: "asset", parent_id: "pv1", company_id: CO, last_upload_id: "up2" },
    ],
    saas_loadout_overrides: [],
    saas_returns: [],
    saas_loadout_plans: [],
    saas_loadout_link_offs: [],
    ...extra,
  };
}
const DOT_REASON = `Truck paper: Annual DOT inspection expired ${PAST}`;
const loadout = (hoursAgo: number, over: Row = {}): Row => ({
  id: "lo1", company_id: CO, unit_id: "u2", unit_name: "P-02", yard_id: "y1", scanned_by: "Hand One",
  started_at: ago(hoursAgo + 0.3), finished_at: ago(hoursAgo), expected: 1, scanned: 1, verdict: "not_ready",
  reasons: [DOT_REASON], lines: [], packages: [], pieces: [], not_scanned: [],
  proof_token: "tok2", plan: null, photo_path: null, roll_checks: null, job: null, ...over,
});

async function dispatchHtml(fake: ReturnType<typeof fakeDb>) {
  dbHolder.current = fake.client;
  const { default: DispatchPage } = await import("../../../app/app/units/[unitId]/dispatch/page");
  return renderToStaticMarkup(await DispatchPage({ params: Promise.resolve({ unitId: "u2" }), searchParams: Promise.resolve({}) }));
}
async function recordHtml(fake: ReturnType<typeof fakeDb>) {
  dbHolder.current = fake.client;
  const { default: LoadoutRecordPage } = await import("../../../app/app/loadouts/[id]/page");
  return renderToStaticMarkup(await LoadoutRecordPage({ params: Promise.resolve({ id: "lo1" }) }));
}
const asRole = async <T,>(role: string, fn: () => Promise<T>) => {
  const was = authMock.company.role;
  authMock.company.role = role;
  try { return await fn(); } finally { authMock.company.role = was; }
};

beforeEach(() => { dbHolder.current = null; });

describe("Paper check: blocked on truck paper that's good now", () => {
  it("says the paper is fixed and to scan it again, not the old reason, and no override", async () => {
    const { client } = fakeDb(p02({}, { saas_loadout_scans: [loadout(1)] }));
    const r = await computeDispatchCheck(client, CO, "u2");
    expect(r?.verdict).toBe("not_ready");
    expect(r?.paperFixed).toBe(true);
    expect(r?.failures[0]).toMatch(/^Blocked at load-out .* on truck paper\. That paper is good now\. Scan it again to roll\.$/);
    expect(r?.failures.join(" ")).not.toMatch(/manager rolls|DOT inspection expired/);
    expect(r?.lines[0]).toMatchObject({ source_id: "lo1", result: "missing", detail: "NOT READY on truck paper. That paper is good now. Scan it again to roll." });
    // The DOT line itself reads good.
    expect(r?.lines.find((l) => l.source_id === "c-dot")).toMatchObject({ result: "ok" });
  });

  it("the manager's page offers a new scan, not the override form", async () => {
    const html = await dispatchHtml(fakeDb(p02({}, { saas_loadout_scans: [loadout(1)] })));
    expect(html).toContain("That paper is good now. Scan it again to roll.");
    expect(html).toContain("No override needed");
    expect(html).toContain('href="/app/units/u2/scan"');
    expect(html).not.toContain("Roll it on my override");
  });

  it("the DOT is still expired: the old reason, and the override is still there", async () => {
    const fake = fakeDb(p02({ dot: PAST }, { saas_loadout_scans: [loadout(1)] }));
    const r = await computeDispatchCheck(fake.client, CO, "u2");
    expect(r?.paperFixed).toBe(false);
    expect(r?.failures[0]).toContain(`Truck paper: Annual DOT inspection expired ${PAST}. Fix it and scan again, or a manager rolls it from the load-out record.`);
    expect(await dispatchHtml(fake)).toContain("Roll it on my override");
  });

  it("the DOT is fixed but the valve went out of test since: a new scan would block too, so the override stays", async () => {
    const fake = fakeDb(p02({ valve: PAST }, { saas_loadout_scans: [loadout(1)] }));
    const r = await computeDispatchCheck(fake.client, CO, "u2");
    expect(r?.paperFixed).toBe(false);
    expect(r?.failures[0]).toMatch(/or a manager rolls it from the load-out record\.$/);
    const html = await dispatchHtml(fake);
    expect(html).toContain("Roll it on my override");
    expect(html).not.toContain("No override needed");
  });

  it("blocked on truck paper and a short line: not paper-only, the old story", async () => {
    const { client } = fakeDb(p02({}, { saas_loadout_scans: [loadout(1, { reasons: [DOT_REASON, "Short: 2in 1502 plug valve, 0 of 1 scanned"] })] }));
    const r = await computeDispatchCheck(client, CO, "u2");
    expect(r?.paperFixed).toBe(false);
    expect(r?.failures[0]).toMatch(/\(and 1 more\)\. Fix it and scan again, or a manager rolls it/);
  });

  it("too old to roll and the paper is good now: still says scan it again, no override", async () => {
    const fake = fakeDb(p02({}, { saas_loadout_scans: [loadout(30)] }));
    const r = await computeDispatchCheck(fake.client, CO, "u2");
    expect(r?.paperFixed).toBe(true);
    expect(r?.loadout?.rollable).toBe(false);
    const html = await dispatchHtml(fake);
    expect(html).toContain("No override needed");
    expect(html).not.toContain("Roll it on my override");
  });

  it("rolled on an override: nothing about the load-out, the paper decides", async () => {
    const { client } = fakeDb(p02({}, { saas_loadout_scans: [loadout(1)], saas_loadout_overrides: [{ loadout_id: "lo1", company_id: CO }] }));
    const r = await computeDispatchCheck(client, CO, "u2");
    expect(r?.verdict).toBe("ready");
    expect(r?.paperFixed).toBe(false);
  });
});

describe("an override uses up this load-out's plan, not a later job's", () => {
  const roll = async (fake: ReturnType<typeof fakeDb>) => {
    dbHolder.current = fake.client;
    const { rollLoadoutAnyway } = await import("../../../app/app/loadouts/[id]/actions");
    const fd = new FormData();
    fd.set("loadout_id", "lo1");
    fd.set("reason", "New DOT is in the truck, the upload failed.");
    await expect(rollLoadoutAnyway(fd)).rejects.toThrow("REDIRECT /app/loadouts/lo1");
  };
  const plan = (over: Row): Row => ({ id: "plan-x", company_id: CO, unit_id: "u2", package_ids: [], lines: [], note: null, job: null, planned_by: "Yard Manager", used_at: null, ...over });

  it("a plan made before the load-out for a job that was still more than 18 hours off then stays open", async () => {
    // Scanned 10 hours ago; the plan leaves 10 hours from now (20 hours after
    // the scan), so it only started to count since. It's for that later job.
    const fake = fakeDb(p02({}, {
      saas_loadout_scans: [loadout(10)],
      saas_loadout_plans: [plan({ created_at: ago(30), leaves_at: ahead(10) })],
    }));
    await roll(fake);
    expect(fake.writes.filter((w) => w.kind === "insert").map((w) => w.table)).toEqual(["saas_loadout_overrides"]);
    expect(fake.writes.some((w) => w.table === "saas_loadout_plans")).toBe(false);
    expect(fake.tables.saas_loadout_plans[0].used_at).toBeNull();
  });

  it("a plan made after the load-out finished is for this one: used up", async () => {
    const fake = fakeDb(p02({}, {
      saas_loadout_scans: [loadout(3)],
      saas_loadout_plans: [plan({ created_at: ago(1), leaves_at: null })],
    }));
    await roll(fake);
    const upd = fake.writes.find((w) => w.table === "saas_loadout_plans" && w.kind === "update");
    expect(upd?.filters).toContainEqual(["id", "in", ["plan-x"]]);
    expect(fake.tables.saas_loadout_plans[0].used_at).toBeTruthy();
  });

  it("the plan the load-out was checked against: used up, even though it was made before", async () => {
    const fake = fakeDb(p02({}, {
      saas_loadout_scans: [loadout(3, { plan: { id: "plan-x", by: "Yard Manager", at: ago(8), note: null, packages: [], lines: [] } })],
      saas_loadout_plans: [plan({ created_at: ago(8), leaves_at: null })],
    }));
    await roll(fake);
    expect(fake.tables.saas_loadout_plans[0].used_at).toBeTruthy();
  });
});

describe("the load-out record in the app", () => {
  const shortWithAdded = (): Row => loadout(1, {
    reasons: ["Short: BOP stack, 0 of 1 scanned"],
    lines: [{ label: "BOP stack", qty: 1, source: "kit", filled: [] }],
    pieces: [{ asset_id: "bop9", name: "Spare BOP 15k", serial: "BOP-9", how: "nfc", added: true }],
  });

  it("reads in the yard's zone, the same as the operator's link", async () => {
    const html = await recordHtml(fakeDb(p02({}, { saas_loadout_scans: [loadout(1)] })));
    expect(html).toMatch(/\d{1,2}:\d{2}\s?[AP]M MT/);
  });

  it("short on a kit line with a piece added on top: a manager gets Change the kit", async () => {
    const html = await recordHtml(fakeDb(p02({}, { saas_loadout_scans: [shortWithAdded()] })));
    expect(html).toContain("Put a different piece on? Change the kit");
    expect(html).toContain('href="/app/units/u2/kit"');
    expect(html).toContain("Roll it on my override");
  });

  it("a hand doesn't get it", async () => {
    const html = await asRole("member", () => recordHtml(fakeDb(p02({}, { saas_loadout_scans: [shortWithAdded()] }))));
    expect(html).not.toContain("Change the kit");
  });

  it("short with nothing added on top: no kit link", async () => {
    const lo = shortWithAdded();
    lo.pieces = [];
    const html = await recordHtml(fakeDb(p02({}, { saas_loadout_scans: [lo] })));
    expect(html).not.toContain("Change the kit");
  });
});
