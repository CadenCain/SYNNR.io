import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Team, invites, exports and settings, from the busy-week findings:
 *  - Taking a hand off the crew turns the crew link over (he can't make a new
 *    login and walk back on), takes him off the alert emails, and says how
 *    many proof links he made still work.
 *  - A manager can fix a typo in a hand's login email, never for a login on
 *    another company's crew.
 *  - Every record can be downloaded: check-ins, the whole Tools out sheet
 *    (setting tool outs too), test history with old tests, and roll checks
 *    and the truck photo on load-outs.
 *  - The load-out records and their spreadsheet filter by dates and job or well.
 *  - The NPT day-rate's estimate counts a stopped truck once per day, and not
 *    when it rolled on an override anyway.
 */

const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Renegade Wireline", role: "owner", subscription_status: "active", comped: false, yard_quantity: 1, is_demo: false },
  user: { id: "user-kevin", email: "kevin@example.com", user_metadata: { full_name: "Kevin Odom" } },
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

import { turnOverCrewLink, dropAlertRecipient, liveProofLinksBy, changeLoginEmail, offCrewNotice } from "@/app/app/settings/team/crew-changes";
import { loadoutFilters, filterQuery, isFiltering, dayStartIso, rangeOf, jobPattern } from "@/app/app/loadouts/export/filters";
import { esc, csvText } from "@/app/api/saas/export/csv";
import { checkinRows, toolRows, testHistoryRows, CHECKIN_HEADER, TOOLS_HEADER, TESTS_HEADER } from "@/app/api/saas/export/rows";
import { caughtCount } from "@/app/app/settings/billing/npt";
import { GET as loadoutsCsv } from "@/app/app/loadouts/export/route";
import { GET as checkinsCsv } from "@/app/api/saas/export/checkins/route";
import { GET as toolsCsv } from "@/app/api/saas/export/tools-out/route";

const CO = "co-1";

// ------------------------------------------------------------- a small db
type Row = Record<string, unknown>;
type Filter = [string, string, unknown];
type Write = { table: string; kind: "insert" | "update" | "delete"; payload?: Row; filters: Filter[] };

const likeRe = (pattern: string) => new RegExp(`^${pattern.replace(/\\(.)|%|_|[.*+?^${}()|[\]]/g, (m, lit) =>
  lit !== undefined ? lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : m === "%" ? ".*" : m === "_" ? "." : `\\${m}`)}$`, "i");

function fakeDb(tables: Record<string, Row[]>, auth?: { updateUserById: (id: string, attrs: Row) => Promise<{ error: { message: string } | null }> }) {
  const writes: Write[] = [];
  const reads: { table: string; filters: Filter[] }[] = [];
  let seq = 0;
  const matchOne = (r: Row, [c, op, v]: Filter): boolean => {
    if (op === "eq") return r[c] === v;
    if (op === "neq") return r[c] !== v;
    if (op === "is") return (r[c] ?? null) === v;
    if (op === "in") return (v as unknown[]).includes(r[c]);
    if (op === "gte") return String(r[c] ?? "") >= String(v);
    if (op === "lt") return String(r[c] ?? "") < String(v);
    if (op === "ilike") return likeRe(String(v)).test(String(r[c] ?? ""));
    if (op === "or") return String(v).split(",").some((part) => { const [col, o, ...rest] = part.split("."); return matchOne(r, [col, o, rest.join(".") === "null" ? null : rest.join(".")]); });
    return true;
  };
  class Q {
    private filters: Filter[] = [];
    private span: [number, number] | null = null;
    private head = false;
    private write: Write | null = null;
    constructor(private table: string) {}
    select(_c?: string, o?: { head?: boolean }) { this.head = Boolean(o?.head); return this; }
    eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
    neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
    is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
    in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
    gte(c: string, v: unknown) { this.filters.push([c, "gte", v]); return this; }
    lt(c: string, v: unknown) { this.filters.push([c, "lt", v]); return this; }
    ilike(c: string, v: string) { this.filters.push([c, "ilike", v]); return this; }
    or(f: string) { this.filters.push(["", "or", f]); return this; }
    order() { return this; }
    range(a: number, b: number) { this.span = [a, b]; return this; }
    maybeSingle() { return this; }
    insert(payload: Row) { this.write = { table: this.table, kind: "insert", payload, filters: [] }; return this; }
    update(payload: Row) { this.write = { table: this.table, kind: "update", payload, filters: [] }; return this; }
    delete() { this.write = { table: this.table, kind: "delete", filters: [] }; return this; }
    then<T>(resolve: (v: { data: unknown; error: null; count?: number }) => T): T {
      const rows = (tables[this.table] ??= []);
      const hit = rows.filter((r) => this.filters.every((f) => matchOne(r, f)));
      if (this.write) {
        this.write.filters = this.filters;
        writes.push(this.write);
        if (this.write.kind === "insert") rows.push({ id: `new-${++seq}`, ...this.write.payload });
        else if (this.write.kind === "update") hit.forEach((r) => Object.assign(r, this.write!.payload));
        else tables[this.table] = rows.filter((r) => !hit.includes(r));
        return resolve({ data: null, error: null });
      }
      reads.push({ table: this.table, filters: this.filters });
      if (this.head) return resolve({ data: null, error: null, count: hit.length });
      const page = this.span ? hit.slice(this.span[0], this.span[1] + 1) : hit;
      return resolve({ data: page, error: null, count: hit.length });
    }
  }
  const db = { from: (t: string) => new Q(t), auth: { admin: auth ?? { updateUserById: async () => ({ error: null }) } } };
  return { db: db as unknown as SupabaseClient, writes, reads, tables };
}

const csvRows = (text: string) => text.trim().split("\n");

beforeEach(() => { authMock.company.role = "owner"; });

// ------------------------------------------------------------- off the crew
describe("taking someone off the crew", () => {
  it("turns the crew link over: the old one stops working and a fresh one takes its place", async () => {
    const { db, tables } = fakeDb({
      saas_invitations: [
        { id: "inv-old", company_id: CO, multi_use: true, status: "pending", token: "old" },
        { id: "inv-one", company_id: CO, multi_use: false, status: "pending" },
        { id: "inv-other-co", company_id: "co-2", multi_use: true, status: "pending" },
      ],
    });
    const r = await turnOverCrewLink(db, { id: CO, subscription_status: "active", comped: false });
    expect(r).toBe("new");
    const inv = tables.saas_invitations;
    expect(inv.find((i) => i.id === "inv-old")!.status).toBe("revoked");
    // A personal invite and another company's link are left alone.
    expect(inv.find((i) => i.id === "inv-one")!.status).toBe("pending");
    expect(inv.find((i) => i.id === "inv-other-co")!.status).toBe("pending");
    const fresh = inv.filter((i) => i.company_id === CO && i.multi_use && i.status === undefined);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].role).toBe("member");
    expect(Date.parse(String(fresh[0].expires_at)) - Date.now()).toBeGreaterThan(29 * 86400e3);
  });

  it("a canceled account turns the old link off without making a new one", async () => {
    const { db, writes } = fakeDb({ saas_invitations: [{ id: "inv-old", company_id: CO, multi_use: true, status: "pending" }] });
    expect(await turnOverCrewLink(db, { id: CO, subscription_status: "canceled", comped: false })).toBe("off");
    expect(writes.filter((w) => w.kind === "insert")).toHaveLength(0);
  });

  it("no crew link out: nothing to turn over, nothing written", async () => {
    const { db, writes } = fakeDb({ saas_invitations: [] });
    expect(await turnOverCrewLink(db, { id: CO, subscription_status: "active", comped: false })).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it("comes off this company's alert emails, whatever case the email was typed in", async () => {
    const { db, tables } = fakeDb({
      saas_alert_recipients: [
        { id: "r1", company_id: CO, email: "Marcus.Hale@Example.com" },
        { id: "r2", company_id: CO, email: "office@example.com" },
        { id: "r3", company_id: "co-2", email: "marcus.hale@example.com" },
      ],
    });
    expect(await dropAlertRecipient(db, CO, "marcus.hale@example.com")).toBe(1);
    expect(tables.saas_alert_recipients.map((r) => r.id).sort()).toEqual(["r2", "r3"]);
    expect(await dropAlertRecipient(db, CO, null)).toBe(0);
  });

  it("counts the proof links they made that still work", async () => {
    const { db } = fakeDb({
      saas_readiness_proofs: [
        { id: "p1", company_id: CO, created_by: "u-marcus", revoked_at: null },
        { id: "p2", company_id: CO, created_by: "u-marcus", revoked_at: "2026-11-01T00:00:00Z" },
        { id: "p3", company_id: CO, created_by: "u-dale", revoked_at: null },
      ],
    });
    expect(await liveProofLinksBy(db, CO, "u-marcus")).toBe(1);
  });

  it("tells the manager in plain words what happened", () => {
    const text = offCrewNotice({ link: "new", alerts: 1, links: 2 });
    expect(text).toMatch(/crew link turned over/);
    expect(text).toMatch(/off the alert emails/);
    expect(text).toMatch(/2 proof links that still work/);
    expect(text).not.toMatch(/—/);
    expect(offCrewNotice({ link: null, alerts: 0, links: 0 })).toBe("Taken off the crew.");
  });
});

// ------------------------------------------------------------- login email
describe("fixing a hand's login email", () => {
  it("changes it for a login on this crew only", async () => {
    const update = vi.fn(async () => ({ error: null }));
    const { db } = fakeDb({ saas_memberships: [{ user_id: "u-tony", company_id: CO, status: "active" }] }, { updateUserById: update });
    const r = await changeLoginEmail(db, CO, "u-tony", "  Tony.Rios@Gmail.com ");
    expect(r).toEqual({ ok: true, email: "tony.rios@gmail.com" });
    expect(update).toHaveBeenCalledWith("u-tony", { email: "tony.rios@gmail.com", email_confirm: true });
  });

  it("won't touch a login that's on another company's crew too", async () => {
    const update = vi.fn(async () => ({ error: null }));
    const { db } = fakeDb({ saas_memberships: [
      { user_id: "u-tony", company_id: CO, status: "active" },
      { user_id: "u-tony", company_id: "co-2", status: "active" },
    ] }, { updateUserById: update });
    const r = await changeLoginEmail(db, CO, "u-tony", "tony@example.com");
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("says so when the email is wrong or already has a login", async () => {
    const { db } = fakeDb({ saas_memberships: [{ user_id: "u-tony", company_id: CO, status: "active" }] },
      { updateUserById: async () => ({ error: { message: "A user with this email address has already been registered" } }) });
    expect(await changeLoginEmail(db, CO, "u-tony", "tony@")).toEqual({ ok: false, error: "That email doesn't look right." });
    expect(await changeLoginEmail(db, CO, "u-tony", "dale@example.com")).toEqual({ ok: false, error: "That email already has a login." });
  });

  it("someone no longer on this crew can't be changed from here", async () => {
    const { db } = fakeDb({ saas_memberships: [{ user_id: "u-tony", company_id: CO, status: "removed" }] });
    expect((await changeLoginEmail(db, CO, "u-tony", "tony@example.com")).ok).toBe(false);
  });
});

// ------------------------------------------------------------- filters
describe("load-out filters", () => {
  it("reads dates, a job, and only real yard ids", () => {
    const f = loadoutFilters({ from: "2026-11-30", to: "2026-09-01", job: "  Pioneer   Smith 4H ", yard: "not-a-uuid", show: "blocked", by: "Dale" });
    // Typed backwards: still the days between.
    expect(f).toMatchObject({ from: "2026-09-01", to: "2026-11-30", job: "Pioneer Smith 4H", yard: "", show: "blocked", by: "Dale" });
    expect(loadoutFilters({ from: "2026-02-30", show: "everything" })).toMatchObject({ from: "", show: "" });
    expect(isFiltering(loadoutFilters({}))).toBe(false);
    expect(filterQuery(loadoutFilters({}))).toBe("");
    const q = filterQuery(f);
    expect(loadoutFilters(new URLSearchParams(q.slice(1)))).toEqual(f);
  });

  it("a yard day starts at midnight in the yard, through the clock change", () => {
    expect(dayStartIso("2026-08-12")).toBe("2026-08-12T05:00:00.000Z"); // CDT
    expect(dayStartIso("2026-12-12")).toBe("2026-12-12T06:00:00.000Z"); // CST
    expect(dayStartIso("2026-11-01")).toBe("2026-11-01T05:00:00.000Z"); // the day clocks fall back
    expect(rangeOf({ from: "2026-11-01", to: "2026-11-01" })).toEqual({ gte: "2026-11-01T05:00:00.000Z", lt: "2026-11-02T06:00:00.000Z" });
  });

  it("a job is matched as plain words, not as a pattern", () => {
    expect(jobPattern("100%_A*")).toBe("%100\\%\\_A %");
    expect(likeRe(jobPattern("smith 4h")).test("Pioneer Smith 4H")).toBe(true);
    expect(likeRe(jobPattern("100%")).test("1000")).toBe(false);
  });
});

// ------------------------------------------------------------- csv rows
describe("the spreadsheets", () => {
  it("a cell that starts like a formula goes in as text", () => {
    expect(esc("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(esc("-5")).toBe("-5");
    expect(csvText(["a", "b"], [["x, y", 1]])).toBe("a,b\n\"x, y\",1\n");
  });

  it("check-ins: every piece back, where it went, red tags and why, and what didn't come back", () => {
    const rows = checkinRows([{
      id: "ret-1", yard_id: "y-odessa", unit_name: "CT-03", returned_by: "Freddy", finished_at: "2026-11-11T20:10:00Z",
      pieces: [
        { name: "Quad BOP #11", serial: "QB-4471", how: "nfc", at: Date.parse("2026-11-11T20:05:00Z"), to: "yard", rack: "Rack 2", red_tag: "rams bent", red: true,
          went_out: { truck: "CT-03", by: "Dale", at: "2026-11-02T11:00:00Z" }, out_days: 9 },
        { name: "Setting tool #4", serial: "ST-4", how: "hand", to: "truck", needs_redress: true },
      ],
      not_returned: [{ name: "Lubricator", serial: "LU-9", outcome: "missing", went_out: { truck: "CT-03", by: "Dale", at: "2026-11-02T11:00:00Z" } }],
    }], new Map([["y-odessa", "Odessa"]]));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(r).toHaveLength(CHECKIN_HEADER.length);
    const [bop, tool, lost] = rows;
    expect(bop.slice(1, 6)).toEqual(["CT-03", "Odessa", "Freddy", "Quad BOP #11", "QB-4471"]);
    expect(bop[8]).toBe("Into the yard: Rack 2");
    expect(bop[10]).toMatch(/^On CT-03 .*loaded by Dale$/);
    expect(bop[12]).toBe("rams bent");
    expect(bop[13]).toBe("yes");
    expect(tool[8]).toBe("Back on CT-03");
    expect(tool[14]).toBe("yes");
    expect(lost[15]).toBe("Can't find");
  });

  it("Tools out: per-piece sign-outs and hand-offs, counted setting tools, the vendor, and redress, newest first", () => {
    const rows = toolRows({
      signouts: [{ asset_name: "Setting tool #4", serial: "ST-4", out_name: "Dale", job_note: "Smith 4H", out_at: "2026-11-10T11:00:00Z", back_at: "2026-11-10T15:00:00Z", back_by: "Dale", back_note: "handed to Freddy" }],
      toolOuts: [{ stock_id: "s1", out_name: "Freddy", qty: 3, job_note: null, out_at: "2026-11-12T11:00:00Z", out_by: "Kevin", back_at: null, back_by: null, back_used: null, back_unused: null }],
      stocks: [{ id: "s1", name: "Baker 20", vendor: "Silver Fox", yard_id: "y-odessa" }],
      log: [
        { stock_id: "s1", kind: "vendor", note: "Vendor picked up 5 used, dropped off 6 ready", by_name: "Kevin", created_at: "2026-11-11T11:00:00Z" },
        { stock_id: "s1", kind: "out", note: "3 to Freddy", by_name: "Kevin", created_at: "2026-11-12T11:00:00Z" },
      ],
      redress: [{ kind: "redressed", message: "Dale redressed Setting tool #4 ST-4", actor: "Dale", created_at: "2026-11-10T16:00:00Z" }],
      yardName: new Map([["y-odessa", "Odessa"]]),
    });
    for (const r of rows) expect(r).toHaveLength(TOOLS_HEADER.length);
    expect(rows.map((r) => r[1])).toEqual(["Setting tools out (counted)", "Vendor visit", "Redressed", "Signed out"]);
    expect(rows[0].slice(2, 7)).toEqual(["Baker 20 (Silver Fox)", "", "Odessa", 3, "Freddy"]);
    expect(rows[0][9]).toBe("Still out");
    expect(rows[3][13]).toBe("handed to Freddy");
  });

  it("test history keeps last year's test after a retest, with a link to each cert", () => {
    const rows = testHistoryRows({
      uploads: [
        { id: "up-2026", item_id: "it-bop", created_at: "2026-10-01T15:00:00Z", uploaded_by_name: "Dale", evidence: "cert", claimed_issued: "2026-09-30", claimed_expiration: "2027-09-30", pending_until: null, verdict: "verified", status: "applied", applied_at: "2026-10-01T15:00:00Z", reviewed_by_name: null, reviewed_at: null, review_note: null },
        { id: "up-2025", item_id: "it-bop", created_at: "2025-10-01T15:00:00Z", uploaded_by_name: "Dale", evidence: "cert", claimed_issued: "2025-09-30", claimed_expiration: "2026-09-30", pending_until: null, verdict: "needs_review", status: "superseded", applied_at: "2025-10-02T15:00:00Z", reviewed_by_name: "Kevin", reviewed_at: "2025-10-02T15:00:00Z", review_note: null },
        { id: "up-gone", item_id: null, created_at: "2026-01-01T15:00:00Z", uploaded_by_name: "Dale", evidence: "cert", claimed_issued: null, claimed_expiration: "2027-01-01", pending_until: null, verdict: "verified", status: "superseded", applied_at: null, reviewed_by_name: null, reviewed_at: null, review_note: null },
      ],
      items: [{ id: "it-bop", title: "Pressure test", parent_type: "asset", parent_id: "a-bop", expiration_date: "2027-09-30", last_upload_id: "up-2026" }],
      pieces: new Map([["a-bop", { name: "Quad BOP #11", serial: "QB-4471" }]]),
      trucks: new Map(),
      certUrl: (id) => `https://www.synnr.io/api/saas/export/cert/${id}`,
    });
    for (const r of rows) expect(r).toHaveLength(TESTS_HEADER.length);
    expect(rows.map((r) => r[13])).toEqual([
      "https://www.synnr.io/api/saas/export/cert/up-2026",
      "https://www.synnr.io/api/saas/export/cert/up-2025",
      "https://www.synnr.io/api/saas/export/cert/up-gone",
    ]);
    expect(rows[0].slice(1, 4)).toEqual(["Quad BOP #11", "QB-4471", "Pressure test"]);
    expect(rows[0][7]).toBe("2027-09-30");
    expect(rows[0][8]).toBe("On file");
    expect(rows[0][10]).toBe("RollReady, against the photo");
    expect(rows[1][6]).toBe("2026-09-30");
    expect(rows[1][7]).toBe("");
    expect(rows[1][8]).toBe("Replaced by a newer test");
    expect(rows[1][10]).toBe("Kevin");
    expect(rows[2][1]).toBe("Test deleted");
  });
});

// ------------------------------------------------------------- npt
describe("the NPT estimate", () => {
  it("one per truck per day, and none on a day the truck rolled on an override anyway", () => {
    const n = caughtCount([
      { id: "l1", unit_id: "t1", finished_at: "2026-11-10T11:00:00Z" },
      { id: "l2", unit_id: "t1", finished_at: "2026-11-10T11:20:00Z" }, // scanned again after a fix
      { id: "l3", unit_id: "t2", finished_at: "2026-11-10T11:00:00Z" },
      { id: "l4", unit_id: "t2", finished_at: "2026-11-10T12:00:00Z" }, // rolled on an override
      { id: "l5", unit_id: "t1", finished_at: "2026-11-12T11:00:00Z" },
    ], new Set(["l4"]));
    expect(n).toBe(2);
  });
});

// ------------------------------------------------------------- routes
const piece = (name: string) => ({ asset_id: `a-${name}`, name, serial: null, how: "nfc", at: "2026-11-10T11:00:00Z" });
const loadout = (id: string, job: string | null, finished_at: string, extra: Row = {}) => ({
  id, company_id: CO, unit_name: "CT-03", yard_id: "y-odessa", finished_at, scanned_by: "Dale", verdict: "ready", reasons: [],
  pieces: [piece("Quad BOP #11")], not_scanned: [], proof_token: `tok-${id}`, job, roll_checks: null, photo_path: null, ...extra,
});

describe("the load-out spreadsheet", () => {
  it("carries the records page's filters, roll checks, and the truck photo", async () => {
    const f = fakeDb({
      saas_loadout_scans: [
        loadout("l-pioneer", "Pioneer Smith 4H", "2026-11-10T11:00:00Z", {
          roll_checks: [{ label: "BOP rams closed for travel", ok: true, by: "Dale", at: "2026-11-10T10:58:00Z" }], photo_path: "co-1/l/x.jpg" }),
        loadout("l-other", "Diamondback Jones 2", "2026-11-10T12:00:00Z"),
        loadout("l-old", "Pioneer Smith 4H", "2026-07-01T12:00:00Z"),
        { ...loadout("l-other-co", "Pioneer Smith 4H", "2026-11-10T11:00:00Z"), company_id: "co-2" },
      ],
      saas_yards: [{ id: "y-odessa", company_id: CO, name: "Odessa" }],
      saas_loadout_overrides: [],
      saas_loadout_link_offs: [],
    });
    dbHolder.current = f.db;
    const res = await loadoutsCsv(new Request("https://www.synnr.io/app/loadouts/export?from=2026-11-01&to=2026-11-30&job=pioneer"));
    const lines = csvRows(await res.text());
    expect(lines[0]).toContain("Roll checks,Truck photo");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Pioneer Smith 4H");
    expect(lines[1]).toContain("BOP rams closed for travel: done by Dale");
    expect(lines[1]).toContain(",yes,");
    expect(lines[1]).toContain("https://www.synnr.io/l/tok-l-pioneer");
    expect(res.headers.get("Content-Disposition")).toContain("2026-11-01-to-2026-11-30");
    // Every read is this company's.
    expect(f.reads.every((r) => r.filters.some(([c, op, v]) => c === "company_id" && op === "eq" && v === CO))).toBe(true);
  });

  it("with no filters it's still every load-out", async () => {
    dbHolder.current = fakeDb({
      saas_loadout_scans: [loadout("l1", null, "2026-11-10T11:00:00Z"), loadout("l2", "x", "2025-01-10T11:00:00Z")],
      saas_yards: [], saas_loadout_overrides: [], saas_loadout_link_offs: [],
    }).db;
    const lines = csvRows(await (await loadoutsCsv(new Request("https://www.synnr.io/app/loadouts/export"))).text());
    expect(lines).toHaveLength(3);
  });
});

describe("check-in and Tools out downloads", () => {
  it("check-ins read every one past a page, this company's only", async () => {
    const many = Array.from({ length: 1205 }, (_, i) => ({
      id: `r${i}`, company_id: CO, yard_id: null, unit_name: "CT-03", returned_by: "Freddy", finished_at: "2026-11-10T11:00:00Z",
      pieces: [{ name: "Valve", serial: `V-${i}`, how: "qr", to: "truck" }], not_returned: [],
    }));
    const f = fakeDb({ saas_returns: [...many, { ...many[0], id: "r-other", company_id: "co-2" }], saas_yards: [] });
    dbHolder.current = f.db;
    const res = await checkinsCsv();
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(csvRows(await res.text())).toHaveLength(1 + 1205);
  });

  it("Tools out has counted setting tools and per-piece sign-outs", async () => {
    dbHolder.current = fakeDb({
      saas_signouts: [{ id: "so1", company_id: CO, asset_name: "Setting tool #4", serial: "ST-4", out_name: "Dale", job_note: null, out_at: "2026-11-10T11:00:00Z", back_at: null, back_by: null, back_note: null }],
      saas_tool_outs: [{ id: "to1", company_id: CO, stock_id: "s1", out_name: "Freddy", qty: 2, job_note: null, out_at: "2026-11-11T11:00:00Z", out_by: "Freddy", back_at: null, back_by: null, back_used: null, back_unused: null }],
      saas_tool_stocks: [{ id: "s1", company_id: CO, name: "Baker 20", vendor: null, yard_id: null }],
      saas_tool_stock_log: [], saas_events: [], saas_yards: [],
    }).db;
    const text = await (await toolsCsv()).text();
    expect(text).toContain("Setting tools out (counted),Baker 20");
    expect(text).toContain("Signed out,Setting tool #4,ST-4");
  });
});
