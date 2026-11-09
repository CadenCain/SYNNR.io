import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Alerts, recipients, and the morning email (the busy-week fixes):
 *   - a yard-only person narrows only their own mail; the owner keeps the rest
 *   - a test that lapsed while the truck sat gets one more alert after it runs out
 *   - the morning email: still blocked vs not scanned, can't roll right now,
 *     uploads waiting, names behind the counts, the worst reason, yard names,
 *     a yard-only person's own part, a moved piece's truck, crews on a job
 *   - the morning run lands at 4 AM in the yard all year, once a day
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
const readinessHolder = vi.hoisted(() => ({ units: [] as unknown[] }));
vi.mock("../readiness", () => ({
  getCompanyReadiness: async () => ({ readiness: null, counts: {}, units: readinessHolder.units, hardFail: false }),
  snapshotAllCompanies: async () => ({}),
}));

import { sweepAlerts } from "../alerts";
import { resolveRecipients } from "../notify";
import { isExpiredAlertDue, isMorningRunHour } from "../alert-window";
import { summaryText, blockedWhy, damagedLine, planScanned, sendMorningSummaries, type DaySummary } from "../morning-summary";
import { lateLine, type LoadoutPlan } from "../plans";
import { addDaysIso, localToday } from "../status";

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
afterEach(() => { vi.unstubAllGlobals(); delete process.env.RESEND_API_KEY; });

const CO = "co-1";
const ODESSA = "y-odessa";
const HOBBS = "y-hobbs";
const TODAY = localToday();
const company = { id: CO, name: "Renegade Wireline", subscription_status: "active", comped: false, is_demo: false };
const owner = { company_id: CO, user_id: "u-owner", role: "owner", status: "active" };
const users = { "u-owner": { email: "owner@example.com", full_name: "Kevin Odom" } };

// ── 1. A yard-only person narrows only their own mail ──────────────────────

function sweepTables(recips: Row[], sent: Row[] = []) {
  return {
    saas_companies: [company],
    saas_notification_settings: [],
    saas_compliance_items: [
      { id: "i-odessa", title: "BOP pressure test", kind: "test", expiration_date: addDaysIso(TODAY, 10), parent_type: "unit", parent_id: "t-odessa", company_id: CO },
      { id: "i-hobbs", title: "Annual DOT inspection", kind: "inspection", expiration_date: addDaysIso(TODAY, 12), parent_type: "unit", parent_id: "t-hobbs", company_id: CO },
    ],
    saas_alerts_sent: sent,
    saas_units: [{ id: "t-odessa", yard_id: ODESSA, company_id: CO }, { id: "t-hobbs", yard_id: HOBBS, company_id: CO }],
    saas_assets: [],
    saas_alert_recipients: recips,
    saas_memberships: [owner],
  };
}
const marcus = { company_id: CO, name: "Marcus Hale", email: "marcus@example.com", phone: null, channels: ["email"], yard_ids: [HOBBS] };

describe("test warnings: a yard-only person never silences the other yards", () => {
  it("Marcus (Only Hobbs) gets Hobbs; the Odessa test goes to the owner, and both are logged", async () => {
    const { client, writes } = fakeDb(sweepTables([marcus]), users);
    const res = await sweepAlerts(client as unknown as SupabaseClient);
    expect(res.errors).toEqual([]);
    const toMarcus = mails.find((m) => m.to.includes("marcus@example.com"))!;
    const toOwner = mails.find((m) => m.to.includes("owner@example.com"))!;
    expect(toMarcus.html).toContain("Annual DOT inspection");
    expect(toMarcus.html).not.toContain("BOP pressure test");
    expect(toOwner.html).toContain("BOP pressure test");
    expect(toOwner.html).not.toContain("Annual DOT inspection");
    const logged = writes.filter((w) => w.table === "saas_alerts_sent").flatMap((w) => w.payload as { compliance_item_id: string }[]);
    expect(logged.map((r) => r.compliance_item_id).sort()).toEqual(["i-hobbs", "i-odessa"]);
  });

  it("the owner on the list for one yard gets one email with both", async () => {
    const ownerHobbs = { ...marcus, name: "Kevin Odom", email: "owner@example.com" };
    const { client } = fakeDb(sweepTables([ownerHobbs]), users);
    await sweepAlerts(client as unknown as SupabaseClient);
    expect(mails).toHaveLength(1);
    expect(mails[0].html).toContain("BOP pressure test");
    expect(mails[0].html).toContain("Annual DOT inspection");
  });

  it("nobody to tell about the uncovered yard is loud, not silent", async () => {
    const { client } = fakeDb({ ...sweepTables([marcus]), saas_memberships: [] }, users);
    const res = await sweepAlerts(client as unknown as SupabaseClient);
    expect(res.errors.join(" ")).toMatch(/NO RECIPIENTS.*1 due item/);
  });
});

describe("company-wide mail (morning email, out too long) skips yard-only people", () => {
  it("only Marcus on the list: company-wide mail goes to the owner, Hobbs alerts to Marcus, Odessa alerts to the owner", async () => {
    const { client } = fakeDb({ saas_alert_recipients: [marcus], saas_memberships: [owner], saas_notification_settings: [] }, users);
    dbHolder.current = client;
    expect((await resolveRecipients(CO)).map((r) => r.email)).toEqual(["owner@example.com"]);
    expect((await resolveRecipients(CO, HOBBS)).map((r) => r.email)).toEqual(["marcus@example.com"]);
    expect((await resolveRecipients(CO, ODESSA)).map((r) => r.email)).toEqual(["owner@example.com"]);
  });

  it("someone on All yards gets the company-wide mail", async () => {
    const all = { ...marcus, name: "Ryan", email: "ryan@example.com", yard_ids: null };
    const { client } = fakeDb({ saas_alert_recipients: [marcus, all], saas_memberships: [owner] }, users);
    dbHolder.current = client;
    expect((await resolveRecipients(CO)).map((r) => r.email)).toEqual(["ryan@example.com"]);
    expect((await resolveRecipients(CO, HOBBS)).map((r) => r.email).sort()).toEqual(["marcus@example.com", "ryan@example.com"]);
  });
});

// ── 2. One more alert after it runs out ────────────────────────────────────

describe("a lapsed test gets one more alert after it runs out", () => {
  it("heads-up went out while it was good: due again once it has expired", () => {
    expect(isExpiredAlertDue("2026-10-17", "2026-11-09", "2026-09-17")).toBe(true);
    expect(isExpiredAlertDue("2026-10-17", "2026-10-18", "2026-10-17")).toBe(true);
  });
  it("not on its last good day, not twice, not when the first alert already said EXPIRED", () => {
    expect(isExpiredAlertDue("2026-11-09", "2026-11-09", "2026-10-10")).toBe(false); // still good today
    expect(isExpiredAlertDue("2026-10-17", "2026-11-10", "2026-11-09")).toBe(false); // the expired alert went out
    expect(isExpiredAlertDue("2026-10-17", "2026-11-09", null)).toBe(false); // never alerted: the first alert covers it
    expect(isExpiredAlertDue(null, "2026-11-09", "2026-10-01")).toBe(false); // no date: alerted once as MISSING
  });

  it("the sweep sends it, and the next day it's quiet", async () => {
    const lapsed = addDaysIso(TODAY, -23);
    const tables = {
      ...sweepTables([]),
      saas_compliance_items: [{ id: "i-dot", title: "Annual DOT inspection", kind: "inspection", expiration_date: lapsed, parent_type: "unit", parent_id: "t-odessa", company_id: CO }],
    };
    const first = fakeDb({ ...tables, saas_alerts_sent: [{ company_id: CO, compliance_item_id: "i-dot", sent_at: `${addDaysIso(lapsed, -30)}T10:00:00+00:00` }] }, users);
    const res = await sweepAlerts(first.client as unknown as SupabaseClient);
    expect(res.items_logged).toBe(1);
    expect(mails[0].html).toContain(`EXPIRED ${lapsed}`);
    mails = [];
    const again = fakeDb({ ...tables, saas_alerts_sent: [
      { company_id: CO, compliance_item_id: "i-dot", sent_at: `${addDaysIso(lapsed, -30)}T10:00:00+00:00` },
      { company_id: CO, compliance_item_id: "i-dot", sent_at: new Date().toISOString() },
    ] }, users);
    await sweepAlerts(again.client as unknown as SupabaseClient);
    expect(mails).toHaveLength(0);
  });
});

// ── 3. The morning email's words ───────────────────────────────────────────

const quiet: DaySummary = { company: "Renegade Wireline", loadouts: 0, ready: 0, blocked: [], overrides: [], checkins: 0, unscanned: [], late: [], outTooLong: [], damaged: [], idle: [], noPaper: 0 };

describe("the morning email", () => {
  it("a planned truck that was scanned and blocked isn't 'the app wasn't used'", () => {
    const m = summaryText({ ...quiet, loadouts: 1, stillBlocked: ["P-02: Was planned to leave Mon 5:00 AM. Still NOT READY."] })!;
    expect(m.body).toContain("Planned to leave, still blocked:\n  P-02: Was planned");
    expect(m.body).not.toContain("the app wasn't used");
    expect(m.subject).toBe("RollReady: 1 planned truck still blocked at Renegade Wireline");
  });

  it("planScanned agrees with lateLine on which line a plan gets", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    const plan = { created_at: "2026-11-05T12:00:00Z", leaves_at: "2026-11-09T11:00:00Z" }; // made days ahead
    const t = (iso: string) => iso;
    for (const last of [null, { finished_at: "2026-11-06T12:00:00Z" }, { finished_at: "2026-11-09T10:50:00Z" }]) {
      const line = lateLine({ at: plan.created_at, leavesAt: plan.leaves_at } as Pick<LoadoutPlan, "at" | "leavesAt">, last ? { ...last, rolled: false } : null, now, t)!;
      expect(planScanned(plan, last)).toBe(line.endsWith("Still NOT READY."));
    }
  });

  it("names what can't roll right now, even on a day nothing happened", () => {
    const m = summaryText({ ...quiet, cantRoll: ["P-02: Annual DOT inspection: expired 23d ago"] })!;
    expect(m.body).toContain("Can't roll right now:\n  P-02: Annual DOT inspection: expired 23d ago");
    expect(m.subject).toBe("RollReady: 1 truck can't roll at Renegade Wireline");
  });

  it("says what's waiting on a manager, and names the pieces behind the counts", () => {
    const m = summaryText({ ...quiet, uploadsWaiting: 2, redressWaiting: 7, redressNames: ["a", "b", "c", "d", "e"], noPaper: 1, noPaperNames: ["CT-03: Annual DOT inspection"] })!;
    expect(m.body).toContain("Waiting on you: 2 uploads need a manager's OK.");
    expect(m.body).toContain("  e\n  and 2 more");
    expect(m.body).toContain("  CT-03: Annual DOT inspection");
  });

  it("the blocked line leads with bad paper over a short line, and says how many more", () => {
    expect(blockedWhy(["Short: Lubricator, 0 of 1 scanned", "Truck paper: Annual DOT inspection expired"])).toBe("Truck paper: Annual DOT inspection expired (and 1 more)");
    expect(blockedWhy(["Short: Lubricator, 0 of 1 scanned"])).toBe("Short: Lubricator, 0 of 1 scanned");
    expect(blockedWhy(null)).toBe("NOT READY");
  });

  it("a moved piece that came back damaged names the truck it came back on", () => {
    expect(damagedLine({ name: "2in 1502 pup joint, 10 ft", serial: "PJ-3312", red_tag: "cracked at the union", from_unit: "CT-08", went_out: null }, "Beau Slaughter"))
      .toBe("2in 1502 pup joint, 10 ft PJ-3312: cracked at the union. Came back on CT-08. Checked in by Beau Slaughter.");
  });
});

// ── 4. Who gets the morning email, and what's in it ────────────────────────

function morningTables(recips: Row[]) {
  const recent = new Date(Date.now() - 3 * 3600e3).toISOString();
  return {
    saas_companies: [company],
    saas_yards: [{ id: ODESSA, name: "Odessa Yard", company_id: CO }, { id: HOBBS, name: "Hobbs Yard", company_id: CO }],
    saas_units: [{ id: "t1", name: "P-01", yard_id: ODESSA, company_id: CO }, { id: "t2", name: "P-01", yard_id: HOBBS, company_id: CO }],
    saas_loadout_scans: [
      { id: "l1", unit_id: "t1", unit_name: "P-01", yard_id: ODESSA, verdict: "not_ready", reasons: ["Short: Lubricator, 0 of 1 scanned", "Truck paper: Annual DOT inspection expired"], finished_at: recent, company_id: CO },
      { id: "l2", unit_id: "t2", unit_name: "P-01", yard_id: HOBBS, verdict: "not_ready", reasons: ["Out of test: Quad BOP stack QB-4471"], finished_at: recent, company_id: CO },
    ],
    saas_cert_uploads: [{ id: "up1", company_id: CO, status: "waiting" }],
    saas_alert_recipients: recips,
    saas_memberships: [owner],
    saas_notification_settings: [],
  };
}

describe("the morning email goes to the right people", () => {
  beforeEach(() => {
    readinessHolder.units = [{ id: "t3", name: "P-02", yardId: ODESSA, state: "not_ready", why: "Annual DOT inspection: expired 23d ago" }];
  });

  it("adding Marcus (Only Hobbs) keeps the owner on the whole email; Marcus gets just Hobbs", async () => {
    const { client } = fakeDb(morningTables([marcus]), users);
    dbHolder.current = client;
    const res = await sendMorningSummaries(client as unknown as SupabaseClient);
    expect(res.errors).toEqual([]);
    const whole = mails.find((m) => m.to.includes("owner@example.com"))!;
    const hobbs = mails.find((m) => m.to.includes("marcus@example.com"))!;
    expect(mails).toHaveLength(2);
    expect(whole.to).not.toContain("marcus@example.com");
    // Two trucks named P-01: each line says which yard.
    expect(whole.html).toContain("Odessa Yard, P-01: Truck paper: Annual DOT inspection expired (and 1 more)");
    expect(whole.html).toContain("Hobbs Yard, P-01: Out of test: Quad BOP stack QB-4471");
    expect(whole.html).toContain("Odessa Yard, P-02: Annual DOT inspection: expired 23d ago");
    expect(whole.html).toContain("Waiting on you: 1 upload needs a manager&#39;s OK.");
    // Marcus: Hobbs only, no Odessa lines, no company-wide uploads line.
    expect(hobbs.subject).toContain("Hobbs Yard (Renegade Wireline)");
    expect(hobbs.html).toContain("P-01: Out of test: Quad BOP stack QB-4471");
    expect(hobbs.html).not.toContain("Odessa");
    expect(hobbs.html).not.toContain("Lubricator");
    expect(hobbs.html).not.toContain("Waiting on you");
  });

  it("someone on All yards gets the whole email instead of the owner", async () => {
    const ryan = { ...marcus, name: "Ryan", email: "ryan@example.com", yard_ids: null };
    const { client } = fakeDb(morningTables([ryan]), users);
    dbHolder.current = client;
    await sendMorningSummaries(client as unknown as SupabaseClient);
    expect(mails.map((m) => m.to)).toEqual([["ryan@example.com"]]);
  });

  it("a hand who loaded out a truck still out on a job isn't idle", async () => {
    readinessHolder.units = [];
    const long = new Date(Date.now() - 9 * 86400e3).toISOString();
    const tables = {
      ...morningTables([]),
      saas_loadout_scans: [{ id: "l9", unit_id: "t1", unit_name: "P-01", yard_id: ODESSA, verdict: "ready", reasons: [], finished_at: long, scanned_by: "Manuel Ortega", company_id: CO }],
      saas_assets: [{ id: "a1", unit_id: "t1", yard_id: ODESSA, out_since: long, out_with_name: null, name: "Quad BOP", identifier: null, status: "in_service", company_id: CO }],
      saas_memberships: [owner, { company_id: CO, user_id: "u-manuel", role: "member", status: "active" }, { company_id: CO, user_id: "u-lupe", role: "member", status: "active" }],
    };
    const { client } = fakeDb(tables, { ...users, "u-manuel": { email: "manuel@example.com", full_name: "Manuel Ortega" }, "u-lupe": { email: "lupe@example.com", full_name: "Lupe Cardenas" } });
    dbHolder.current = client;
    await sendMorningSummaries(client as unknown as SupabaseClient);
    const body = mails[0]?.html ?? "";
    // The idle list prints whenever someone's on it; Manuel is on location, Lupe isn't.
    expect(body).toContain("Lupe Cardenas");
    expect(body).not.toContain("Manuel Ortega");
  });
});

// ── 5. 4 AM in the yard, all year ──────────────────────────────────────────

describe("the morning run lands at 4 AM Central all year", () => {
  const at = (iso: string) => isMorningRunHour(new Date(iso));
  it("standard time: 10:00 UTC runs, 09:00 UTC doesn't", () => {
    expect(at("2026-11-09T10:00:00Z")).toBe(true);
    expect(at("2026-11-09T09:00:00Z")).toBe(false);
    expect(at("2027-01-15T10:20:00Z")).toBe(true);
  });
  it("daylight time: 09:00 UTC runs, 10:00 UTC doesn't", () => {
    expect(at("2026-07-09T09:00:00Z")).toBe(true);
    expect(at("2026-07-09T10:00:00Z")).toBe(false);
  });
  it("exactly one of the two runs on the change-over Sundays", () => {
    for (const day of ["2026-03-08", "2026-11-01", "2027-03-14", "2027-11-07"]) {
      expect([at(`${day}T09:00:00Z`), at(`${day}T10:00:00Z`)].filter(Boolean)).toHaveLength(1);
    }
  });
});

describe("the cron route runs the morning once, at 4 AM in the yard", () => {
  afterEach(() => { vi.useRealTimers(); });
  const hit = async (iso: string, runs: Row[], query = "") => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(iso));
    const { client, writes } = fakeDb({ saas_companies: [], saas_cron_runs: runs });
    dbHolder.current = client;
    const { GET } = await import("@/app/api/cron/saas-alerts/route");
    const body = await (await GET(new Request(`https://www.synnr.io/api/cron/saas-alerts${query}`))).json() as { ok: boolean; skipped?: string };
    return { body, beat: writes.filter((w) => w.table === "saas_cron_runs").length };
  };

  it("the 09:00 UTC run on standard time does nothing and leaves no heartbeat", async () => {
    const { body, beat } = await hit("2026-11-09T09:00:30Z", []);
    expect(body.skipped).toMatch(/not the morning run hour/);
    expect(beat).toBe(0);
  });
  it("the 10:00 UTC run on standard time does the work", async () => {
    const { body, beat } = await hit("2026-11-09T10:00:30Z", [{ job: "saas-alerts", ran_at: "2026-11-08T10:00:20Z" }]);
    expect(body.skipped).toBeUndefined();
    expect(beat).toBe(1);
  });
  it("a repeat delivery the same morning never sends twice", async () => {
    const { body, beat } = await hit("2026-11-09T10:03:00Z", [{ job: "saas-alerts", ran_at: "2026-11-09T10:00:20Z" }]);
    expect(body.skipped).toMatch(/already ran today/);
    expect(beat).toBe(0);
  });
  it("?force=1 runs it now, for a re-run after a crash", async () => {
    const { body, beat } = await hit("2026-11-09T15:00:00Z", [{ job: "saas-alerts", ran_at: "2026-11-09T10:00:20Z" }], "?force=1");
    expect(body.skipped).toBeUndefined();
    expect(beat).toBe(1);
  });
});
