import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alerts and the morning email, round two:
 *   - a ?force=1 re-run in the afternoon never stops the next morning's run
 *   - the morning email says what can't be found at a check-in, what was
 *     red-tagged on a piece's page, and bad iron moved onto a truck that rolled
 *   - a plan for a later job isn't "scanned" by the on-call load-out before it
 *   - iron left on location at a check-in is its own line, not the truck's trip now
 *   - a Mountain-time yard's times read in Mountain time
 * Real production code runs against a small in-memory database. Email goes
 * out through the real sendEmail with fetch stubbed, so nothing leaves.
 */

type Row = Record<string, unknown>;

class Q {
  private rows: Row[];
  private head = false;
  private counted = false;
  private one = false;
  private writing = false;
  constructor(private table: string, data: Row[], private writes: { table: string; kind: string; payload: unknown }[]) { this.rows = [...data]; }
  select(_cols?: string, opts?: { count?: string; head?: boolean }) { this.counted = Boolean(opts?.count); this.head = Boolean(opts?.head); return this; }
  eq(c: string, v: unknown) { if (!this.writing) this.rows = this.rows.filter((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.rows = this.rows.filter((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { if (!this.writing) this.rows = this.rows.filter((r) => vs.includes(r[c])); return this; }
  is(c: string, v: unknown) { if (v === null) this.rows = this.rows.filter((r) => r[c] === null || r[c] === undefined); return this; }
  not(c: string, op: string, v: unknown) {
    if (op === "is" && v === null) this.rows = this.rows.filter((r) => r[c] !== null && r[c] !== undefined);
    if (op === "in") { const vs = String(v).replace(/[()]/g, "").split(","); this.rows = this.rows.filter((r) => !vs.includes(String(r[c]))); }
    return this;
  }
  gte(c: string, v: unknown) { this.rows = this.rows.filter((r) => String(r[c] ?? "") >= String(v)); return this; }
  lte(c: string, v: unknown) { this.rows = this.rows.filter((r) => String(r[c] ?? "") <= String(v)); return this; }
  or() { return this; }
  order(c: string, o?: { ascending?: boolean }) {
    this.rows.sort((a, b) => String(a[c] ?? "").localeCompare(String(b[c] ?? "")) * (o?.ascending === false ? -1 : 1));
    return this;
  }
  limit(n: number) { this.rows = this.rows.slice(0, n); return this; }
  range(a: number, b: number) { this.rows = this.rows.slice(a, b + 1); return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  insert(payload: unknown) { this.writing = true; this.writes.push({ table: this.table, kind: "insert", payload }); return this; }
  update(payload: unknown) { this.writing = true; this.writes.push({ table: this.table, kind: "update", payload }); return this; }
  delete() { this.writing = true; this.writes.push({ table: this.table, kind: "delete", payload: null }); return this; }
  then<T>(res: (v: { data: unknown; error: null; count?: number }) => T, rej?: (e: unknown) => T) {
    const out = this.writing ? { data: null, error: null as null }
      : { data: this.head ? null : this.one ? this.rows[0] ?? null : this.rows, error: null as null, ...(this.counted ? { count: this.rows.length } : {}) };
    return Promise.resolve(out).then(res, rej);
  }
}

function fakeDb(tables: Record<string, Row[]>, users: Record<string, { email: string; full_name?: string }> = {}) {
  const writes: { table: string; kind: string; payload: unknown }[] = [];
  const client = {
    from: (t: string) => new Q(t, tables[t] ?? [], writes),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: users[id] ? { email: users[id].email, user_metadata: { full_name: users[id].full_name } } : null } }) } },
  };
  return { client, writes };
}

const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({ saasAdmin: () => dbHolder.current, saasDb: async () => dbHolder.current }));
vi.mock("../readiness", () => ({
  getCompanyReadiness: async () => ({ readiness: null, counts: {}, units: [], hardFail: false }),
  snapshotAllCompanies: async () => ({}),
}));

import { morningRunWindowStart } from "../alert-window";
import { summaryText, missingLine, damagedLine, planScanned, whenText, sendMorningSummaries, type DaySummary } from "../morning-summary";
import { lateLine, loadoutForPlan, type LoadoutPlan } from "../plans";

type Mail = { to: string[]; subject: string; html: string };
let mails: Mail[] = [];
beforeEach(() => {
  mails = [];
  process.env.RESEND_API_KEY = "test-key";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: { body: string }) => {
    mails.push(JSON.parse(init.body) as Mail);
    return { ok: true, status: 200, text: async () => "" };
  }));
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; vi.useRealTimers(); });

const CO = "co-1";
const ODESSA = "y-odessa";
const HOBBS = "y-hobbs";
const company = { id: CO, name: "Renegade Wireline", subscription_status: "active", comped: false, is_demo: false };
const owner = { company_id: CO, user_id: "u-owner", role: "owner", status: "active" };
const users = { "u-owner": { email: "owner@example.com", full_name: "Kevin Odom" } };
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

// ── 1. A forced re-run never stops the next day's run ──────────────────────

describe("the morning run's 'already ran today' check", () => {
  const hit = async (iso: string, runs: Row[], query = "") => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
    const { client, writes } = fakeDb({ saas_companies: [], saas_cron_runs: runs });
    dbHolder.current = client;
    const { GET } = await import("@/app/api/cron/saas-alerts/route");
    const body = await (await GET(new Request(`https://www.synnr.io/api/cron/saas-alerts${query}`))).json() as { ok: boolean; skipped?: string };
    return { body, beat: writes.filter((w) => w.table === "saas_cron_runs").length };
  };

  it("today starts at 08:00 UTC, ahead of 4 AM in the yard on either clock", () => {
    expect(morningRunWindowStart(new Date("2026-11-09T10:00:30Z")).toISOString()).toBe("2026-11-09T08:00:00.000Z");
    expect(morningRunWindowStart(new Date("2026-07-09T09:00:30Z")).toISOString()).toBe("2026-07-09T08:00:00.000Z");
  });

  it("a ?force=1 re-run at 9:30 AM CT doesn't stop the next morning (standard time)", async () => {
    const { body, beat } = await hit("2026-11-10T10:00:30Z", [{ job: "saas-alerts", ran_at: "2026-11-09T15:30:00Z" }]);
    expect(body.skipped).toBeUndefined();
    expect(beat).toBe(1);
  });

  it("nor on daylight time, when the next run is only 18 hours later", async () => {
    const { body, beat } = await hit("2026-07-10T09:00:30Z", [{ job: "saas-alerts", ran_at: "2026-07-09T14:30:00Z" }]);
    expect(body.skipped).toBeUndefined();
    expect(beat).toBe(1);
  });

  it("a repeat delivery the same morning is still skipped", async () => {
    const { body, beat } = await hit("2026-07-10T09:04:00Z", [{ job: "saas-alerts", ran_at: "2026-07-10T09:00:20Z" }]);
    expect(body.skipped).toMatch(/already ran today/);
    expect(beat).toBe(0);
  });
});

// ── 2. The new sections' words ─────────────────────────────────────────────

const quiet: DaySummary = { company: "Renegade Wireline", loadouts: 0, ready: 0, blocked: [], overrides: [], checkins: 0, unscanned: [], late: [], outTooLong: [], damaged: [], idle: [], noPaper: 0 };

describe("the morning email's new sections", () => {
  it("names a piece that can't be found, and whose trip it went out on", () => {
    const w = { truck: "CT-08", by: "Dale Wooten", at: "2026-10-31T11:00:00Z" };
    expect(missingLine({ name: "2in 1502 plug valve", serial: "PV-2207", outcome: "missing", went_out: w }, "CT-08", "Freddy Carrasco"))
      .toBe("2in 1502 plug valve PV-2207: didn't come back on CT-08. Went out Oct 31, loaded by Dale Wooten. Checked in by Freddy Carrasco.");
    expect(missingLine({ name: "Lubricator", serial: null, outcome: "missing", went_out: { with: "Lupe Cardenas", at: "2026-11-01T15:00:00Z" } }, null, "Lupe Cardenas"))
      .toBe("Lubricator: didn't come back. Signed out to Lupe Cardenas Nov 1. Checked in by Lupe Cardenas.");
    // Came back on another truck than it went out on: both are named.
    expect(missingLine({ name: "Pup joint", serial: "PJ-1", outcome: "missing", went_out: w }, "CT-03", "Freddy Carrasco"))
      .toBe("Pup joint PJ-1: didn't come back on CT-03. Went out on CT-08 Oct 31, loaded by Dale Wooten. Checked in by Freddy Carrasco.");
  });

  it("can't find is news on its own, has its own heading, and says so in the subject", () => {
    const m = summaryText({ ...quiet, checkins: 1, cantFind: ["2in 1502 plug valve PV-2207: didn't come back on CT-08. Checked in by Freddy Carrasco."] })!;
    expect(m.body).toContain("Can't find (flagged at check-in):\n  2in 1502 plug valve PV-2207");
    expect(m.subject).toBe("RollReady: 1 piece can't be found at Renegade Wireline");
    expect(summaryText({ ...quiet, cantFind: ["a"] })).not.toBeNull();
  });

  it("a red tag on a piece's page and bad iron moved onto a rolled truck are news", () => {
    const tagged = summaryText({ ...quiet, redTagged: ["Wire rope slings SL-A on CR-01 red-tagged by Cody Blackburn: cut near the eye (Thu 1:40 PM)"] })!;
    expect(tagged.body).toContain("Red-tagged in the yard:\n  Wire rope slings SL-A");
    const bad = summaryText({ ...quiet, badIronOut: ["2in 1502 swivel SW-1180 put on CT-08 after it loaded out: out of test. Moved by Cody Blackburn (Thu 1:40 PM)"] })!;
    expect(bad.body).toContain("Bad iron put on a truck after it rolled:\n  2in 1502 swivel SW-1180");
    expect(bad.subject).toBe("RollReady: bad iron put on a truck after it rolled at Renegade Wireline");
  });

  it("the damaged line reads the same as before when no zone is passed", () => {
    expect(damagedLine({ name: "Quad BOP #11", serial: "QB-4411", red_tag: "rams bent", went_out: { truck: "CT-03", by: "Dale Wooten", at: "2026-11-02T10:00:00Z" } }, "Freddy Carrasco"))
      .toBe("Quad BOP #11 QB-4411: rams bent. Went out on CT-03 Nov 2, loaded by Dale Wooten. Checked in by Freddy Carrasco.");
  });

  it("times read in the yard's own zone, with the zone said when the yards differ", () => {
    const iso = "2026-11-13T11:00:00Z"; // Fri 5:00 AM Central, 4:00 AM Mountain
    expect(whenText(iso).replace(/\s/g, " ")).toBe("Fri 5:00 AM");
    expect(whenText(iso, "America/Denver", true).replace(/\s/g, " ")).toBe("Fri 4:00 AM MT");
    expect(whenText(iso, null, true).replace(/\s/g, " ")).toBe("Fri 5:00 AM CT");
  });
});

// ── 3. A plan for a later job ──────────────────────────────────────────────

describe("a plan for a later job isn't scanned by the on-call load-out before it", () => {
  it("planScanned is loadoutForPlan", () => {
    const plan = { created_at: "2026-11-06T20:00:00Z", leaves_at: "2026-11-09T11:00:00Z" }; // Friday, for Monday 5 AM
    for (const finished_at of ["2026-11-07T15:00:00Z", "2026-11-09T10:30:00Z", "2026-11-06T19:00:00Z"]) {
      expect(planScanned(plan, { finished_at })).toBe(loadoutForPlan({ at: plan.created_at, leavesAt: plan.leaves_at }, { finished_at }));
    }
    expect(planScanned(plan, null)).toBe(false);
  });

  it("Friday's plan for Monday plus a Saturday on-call READY: 'not scanned out', in the subject too", async () => {
    const tables = {
      saas_companies: [company],
      saas_yards: [{ id: ODESSA, name: "Odessa Yard", company_id: CO }],
      saas_units: [{ id: "t1", name: "CT-01", yard_id: ODESSA, company_id: CO }],
      saas_loadout_plans: [{ company_id: CO, unit_id: "t1", created_at: ago(70), leaves_at: ago(2), used_at: null }],
      saas_loadout_scans: [{ id: "l-sat", unit_id: "t1", unit_name: "CT-01", yard_id: ODESSA, verdict: "ready", reasons: [], finished_at: ago(45), company_id: CO }],
      saas_memberships: [owner],
    };
    const { client } = fakeDb(tables, users);
    dbHolder.current = client;
    await sendMorningSummaries(client as unknown as SupabaseClient);
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe("RollReady: 1 truck not checked out at Renegade Wireline");
    expect(mails[0].html).toContain("Nobody has checked it out yet.");
    expect(mails[0].html).not.toContain("Planned to leave, still blocked");
  });
});

// ── 4. The whole morning email, end to end ─────────────────────────────────

describe("sendMorningSummaries puts the new lines where they belong", () => {
  it("can't find, red tags, bad iron, left on location, and Mountain time for Hobbs", async () => {
    const tables = {
      saas_companies: [company],
      saas_yards: [{ id: ODESSA, name: "Odessa Yard", company_id: CO, time_zone: "America/Chicago" }, { id: HOBBS, name: "Hobbs Yard", company_id: CO, time_zone: "America/Denver" }],
      saas_units: [{ id: "t8", name: "CT-08", yard_id: ODESSA, company_id: CO }, { id: "th", name: "H-01", yard_id: HOBBS, company_id: CO }],
      saas_returns: [{
        company_id: CO, yard_id: ODESSA, unit_id: "t8", unit_name: "CT-08", returned_by: "Freddy Carrasco", finished_at: ago(5),
        pieces: [],
        not_returned: [
          { asset_id: "a-pv", name: "2in 1502 plug valve", serial: "PV-2207", outcome: "missing", went_out: { truck: "CT-08", by: "Dale Wooten", at: ago(15 * 24) } },
          { asset_id: "a-lu", name: "Lubricator", serial: "LU-9", outcome: "still_out", went_out: null },
        ],
      }],
      saas_return_latest: [{ company_id: CO, unit_id: "t8", finished_at: ago(5) }],
      saas_assets: [
        // Left on location at CT-08's check-in 5 hours ago, out 15 days.
        { id: "a-lu", unit_id: "t8", yard_id: ODESSA, out_since: ago(15 * 24), out_with_name: null, name: "Lubricator", identifier: "LU-9", status: "in_service", company_id: CO },
      ],
      saas_events: [
        { id: 1, company_id: CO, kind: "red_tagged", unit_id: "th", actor: "Cody Blackburn", created_at: ago(3), message: "Wire rope slings SL-A on H-01 red-tagged by Cody Blackburn: cut near the eye" },
        { id: 2, company_id: CO, kind: "bad_iron_out", unit_id: "t8", actor: "Cody Blackburn", created_at: ago(4), message: "2in 1502 swivel SW-1180 put on CT-08 after it loaded out: out of test. Moved by Cody Blackburn" },
        { id: 3, company_id: CO, kind: "red_tagged", unit_id: "t8", actor: "Cody Blackburn", created_at: ago(30), message: "Old tag from two days ago" },
      ],
      saas_loadout_plans: [{ company_id: CO, unit_id: "th", created_at: ago(10), leaves_at: ago(2), used_at: null }],
      saas_memberships: [owner],
    };
    const { client } = fakeDb(tables, users);
    dbHolder.current = client;
    const res = await sendMorningSummaries(client as unknown as SupabaseClient);
    expect(res.errors).toEqual([]);
    expect(mails).toHaveLength(1);
    const body = mails[0].html.replace(/\s/g, " ");
    expect(body).toContain("Can&#39;t find (flagged at check-in):");
    expect(body).toContain("Odessa Yard, 2in 1502 plug valve PV-2207: didn&#39;t come back on CT-08. Went out ");
    expect(body).toContain("Checked in by Freddy Carrasco.");
    // Still out on the job isn't "can't find".
    expect(body).not.toContain("Lubricator LU-9: didn");
    expect(body).toContain("Red-tagged in the yard:");
    expect(body).toContain("Hobbs Yard, Wire rope slings SL-A on H-01 red-tagged by Cody Blackburn: cut near the eye (");
    expect(body).toContain("Bad iron put on a truck after it rolled:");
    expect(body).toContain("Odessa Yard, 2in 1502 swivel SW-1180 put on CT-08 after it loaded out");
    expect(body).not.toContain("Old tag from two days ago");
    // Left on location: its own line, not "CT-08: 1 piece".
    expect(body).toMatch(/Left on location from CT-08&#39;s [A-Z][a-z]{2} \d{1,2} job: Lubricator LU-9, out 15 days/);
    expect(body).not.toContain("CT-08: 1 piece");
    // The Hobbs plan reads in Mountain time, and says so.
    expect(body).toMatch(/Hobbs Yard, H-01: Was planned to leave \w{3} \d{1,2}:\d{2} [AP]M MT\. Nobody has checked it out yet\./);
  });

  it("iron out on the truck's trip now still reads as the truck's", async () => {
    const tables = {
      saas_companies: [company],
      saas_yards: [{ id: ODESSA, name: "Odessa Yard", company_id: CO }],
      saas_units: [{ id: "t8", name: "CT-08", yard_id: ODESSA, company_id: CO }],
      saas_return_latest: [{ company_id: CO, unit_id: "t8", finished_at: ago(20 * 24) }],
      saas_assets: [{ id: "a1", unit_id: "t8", yard_id: ODESSA, out_since: ago(9 * 24), out_with_name: null, name: "Quad BOP", identifier: "QB-1", status: "in_service", company_id: CO }],
      saas_memberships: [owner],
    };
    const { client } = fakeDb(tables, users);
    dbHolder.current = client;
    await sendMorningSummaries(client as unknown as SupabaseClient);
    expect(mails[0].html).toContain("CT-08: 1 piece, out 9 days");
    expect(mails[0].html).not.toContain("Left on location");
  });
});

// lateLine stays the source of the wording the email uses.
describe("lateLine with a zone-aware clock", () => {
  it("passes the yard's time through", () => {
    const plan = { at: "2026-11-12T20:00:00Z", leavesAt: "2026-11-13T11:00:00Z" } as Pick<LoadoutPlan, "at" | "leavesAt">;
    const line = lateLine(plan, null, Date.parse("2026-11-13T12:00:00Z"), (iso) => whenText(iso, "America/Denver", true))!;
    expect(line.replace(/\s/g, " ")).toBe("Was planned to leave Fri 4:00 AM MT. Nobody has checked it out yet.");
  });
});
