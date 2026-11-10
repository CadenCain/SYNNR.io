import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Operator proof links, round two of the busy-week fixes:
 *  - An old /l/ load-out link never shows or points to a later load-out of
 *    the same truck for another job. Only a NOT READY record nobody rolled,
 *    fixed on the same shift for the same job, gets one line saying so, with
 *    no link to that record. A READY link never says it.
 *  - A truck link (/proof/) hides a later trip's load-out whether or not the
 *    truck was checked in: a load-out that rolled is a trip of its own.
 *  - The record shows the truck's own paper with its cert, when a phone save
 *    with no signal landed late, and a red tag taken off before it went on.
 *  - The proof links list says who made each truck, yard, or company link.
 */

// ── A small in-memory database: filters filter, order sorts ──
type Row = Record<string, unknown>;
class Q {
  private rows: Row[];
  private one = false;
  private sorts: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private rng: [number, number] | null = null;
  private wantCount = false;
  constructor(private table: string, data: Row[], private fail: (table: string, cols: string) => boolean, private cols = "") { this.rows = [...data]; }
  select(cols?: string, opts?: { count?: string }) { this.cols = cols ?? ""; if (opts?.count) this.wantCount = true; return this; }
  eq(c: string, v: unknown) { this.rows = this.rows.filter((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.rows = this.rows.filter((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.rows = this.rows.filter((r) => vs.includes(r[c])); return this; }
  gt(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) > v); return this; }
  lt(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) < v); return this; }
  gte(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) >= v); return this; }
  lte(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) <= v); return this; }
  is(c: string, v: unknown) { this.rows = this.rows.filter((r) => (r[c] ?? null) === v); return this; }
  not(c: string, op: string, v: unknown) { if (op === "is" && v === null) this.rows = this.rows.filter((r) => r[c] != null); return this; }
  or() { return this; }
  order(c: string, o?: { ascending?: boolean }) { this.sorts.push({ col: c, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  then<T>(resolve: (v: { data: unknown; error: unknown; count?: number | null }) => T): T {
    if (this.fail(this.table, this.cols)) return resolve({ data: null, error: { code: "42703", message: "column saas_loadout_scans.truck_paper does not exist" } });
    let rows = [...this.rows];
    for (const s of [...this.sorts].reverse()) rows.sort((a, b) => (String(a[s.col] ?? "") < String(b[s.col] ?? "") ? -1 : String(a[s.col] ?? "") > String(b[s.col] ?? "") ? 1 : 0) * (s.asc ? 1 : -1));
    const count = rows.length;
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) rows = rows.slice(0, this.lim);
    return resolve({ data: this.one ? rows[0] ?? null : rows, error: null, count: this.wantCount ? count : null });
  }
}
function fakeDb(tables: Record<string, Row[]>, opts: { fail?: (table: string, cols: string) => boolean; users?: Record<string, { email: string; full_name?: string }> } = {}) {
  const selects: string[] = [];
  const db = {
    from: (t: string) => {
      const q = new Q(t, tables[t] ?? [], opts.fail ?? (() => false));
      const sel = q.select.bind(q);
      q.select = (cols?: string, o?: { count?: string }) => { selects.push(`${t}: ${cols ?? ""}`); return sel(cols, o); };
      return q;
    },
    storage: {
      from: () => ({
        createSignedUrl: async (p: string, secs: number) => ({ data: { signedUrl: `https://storage.test/${p}?ttl=${secs}` }, error: null }),
        createSignedUrls: async (ps: string[], secs: number) => ({ data: ps.map((p) => ({ signedUrl: `https://storage.test/${p}?ttl=${secs}` })), error: null }),
      }),
    },
    auth: {
      admin: {
        getUserById: async (id: string) => {
          const u = opts.users?.[id];
          return { data: { user: u ? { id, email: u.email, user_metadata: u.full_name ? { full_name: u.full_name } : {} } : null }, error: null };
        },
      },
    },
  };
  return { db: db as unknown as SupabaseClient, selects };
}

const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({ saasDb: async () => dbHolder.current, saasAdmin: () => dbHolder.current }));
vi.mock("../demo-seed", () => ({ SHOWCASE_PROOF_TOKEN: "showcasetoken0000000000000000000000" }));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Renegade Wireline", role: "owner" as string, subscription_status: "active", comped: false, yard_quantity: 2 },
  user: { id: "user-kevin", email: "kevin@example.com", user_metadata: { full_name: "Kevin Odom" } },
}));
vi.mock("../auth", () => ({
  requireCompany: vi.fn(async () => authMock),
  requireBillableCompany: vi.fn(async () => authMock),
  assertCan: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../dispatch-check", () => ({ computeDispatchCheck: vi.fn(async () => ({ verdict: "ready", notChecked: [] })) }));
vi.mock("../readiness", () => ({ getCompanyReadiness: vi.fn(async () => ({ units: [] })) }));

import { laterLoadout, laterTripSince, sameJob, getLoadout, selectRecord, type LoadoutRecord } from "../loadout-record";
import { recordTruckPaper, truckPaperUploads } from "../paper";
import LoadoutRecordView from "@/app/app/_components/loadout-record-view";
import PublicLoadoutPage from "@/app/l/[token]/page";
import ProofPage from "@/app/proof/[token]/page";
import { GET as lPaper } from "@/app/l/[token]/paper/[uploadId]/route";
import ProofsSettings from "@/app/app/settings/proofs/page";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

const TOK_A = "a".repeat(32);
const TOK_B = "b".repeat(32);
const rec = (over: Partial<LoadoutRecord> = {}): LoadoutRecord => ({
  id: "lo-a", company_id: "co-1", unit_id: "ct8", unit_name: "CT-08", yard_id: "ody", scanned_by: "Dale Wooten", started_at: null,
  finished_at: "2026-11-09T11:00:00.000Z", expected: 1, scanned: 1, verdict: "ready", reasons: [],
  lines: [], packages: [], pieces: [{ asset_id: "a1", name: "Quad BOP stack", serial: "QB-4471", how: "nfc", tests: [] }],
  not_scanned: [], proof_token: TOK_A, job: "University 7-12 #3H", ...over,
});
const row = (r: LoadoutRecord) => r as unknown as Row;
// Operator B's load-out, Friday: another job, its own pieces and loader.
const bFriday = rec({
  id: "lo-b", finished_at: "2026-11-13T12:05:00.000Z", proof_token: TOK_B, job: null, scanned_by: "Freddy Carrasco",
  pieces: [{ asset_id: "b1", name: "Lubricator", serial: "LB-9921", how: "qr", tests: [] }],
});

describe("an old /l/ link never reaches a later load-out for another job", () => {
  it("READY Monday for A, never checked in, READY Friday for B with no job typed: A's link says nothing about B", async () => {
    const a = rec();
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(bFriday)] });
    expect(await laterLoadout(db, a, null)).toBeNull();
  });
  it("A READY record never points anywhere, even to a load-out minutes later for the same job", async () => {
    const a = rec();
    const again = rec({ id: "lo-2", finished_at: "2026-11-09T11:20:00.000Z", proof_token: TOK_B });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(again)] });
    expect(await laterLoadout(db, a, null)).toBeNull();
  });
  it("a record a manager rolled on an override has nothing to point to", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"] });
    const fixed = rec({ id: "lo-2", finished_at: "2026-11-09T11:30:00.000Z", proof_token: TOK_B });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(fixed)] });
    expect(await laterLoadout(db, a, { loadout_id: "lo-a", by_name: "Kevin Odom", reason: "Spare stack", created_at: a.finished_at })).toBeNull();
  });
  it("blocked Monday, not fixed that shift, loaded for B on Friday: nothing", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"] });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(bFriday)] });
    expect(await laterLoadout(db, a, null)).toBeNull();
  });
  it("blocked, then another job's load-out the same afternoon with no job typed on either: nothing (no proof it's the same job)", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"], job: null });
    const b = rec({ ...bFriday, finished_at: "2026-11-09T20:00:00.000Z" });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(b)] });
    expect(await laterLoadout(db, a, null)).toBeNull();
  });
  it("blocked, fixed READY for the same job, then the truck went out again for the same well later that day: it says the fix, not the newest", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"] });
    const fix = rec({ id: "lo-2", finished_at: "2026-11-09T11:40:00.000Z", proof_token: TOK_B });
    const nextTrip = rec({ id: "lo-3", finished_at: "2026-11-10T02:00:00.000Z", proof_token: "c".repeat(32) });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(fix), row(nextTrip)] });
    expect(await laterLoadout(db, a, null)).toEqual({ unit_name: "CT-08", finished_at: fix.finished_at, yard_id: "ody", outcome: "ready" });
  });
  it("blocked, then a try for another job: it stops there, even if a READY for this job comes after", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"] });
    const other = rec({ id: "lo-2", finished_at: "2026-11-09T12:00:00.000Z", verdict: "not_ready", job: "Mesa 22 #1" });
    const fix = rec({ id: "lo-3", finished_at: "2026-11-09T13:00:00.000Z" });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(other), row(fix)] });
    expect(await laterLoadout(db, a, null)).toBeNull();
  });
  it("blocked twice on the same job, nothing rolled yet: it says the last try, NOT READY", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"] });
    const t2 = rec({ id: "lo-2", finished_at: "2026-11-09T11:30:00.000Z", verdict: "not_ready", reasons: ["Not confirmed: BOP rams closed for travel"] });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(t2)] });
    expect((await laterLoadout(db, a, null))?.outcome).toBe("blocked");
  });
  it("the same plan as it stood counts as the same job when no job was typed", async () => {
    const plan = { id: "plan-1", by: "Kevin Odom", at: "2026-11-08T22:00:00.000Z", note: null, packages: ["Pump-down"], lines: [] };
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack"], job: null, plan });
    const fix = rec({ id: "lo-2", finished_at: "2026-11-09T11:40:00.000Z", job: null, plan });
    const { db } = fakeDb({ saas_loadout_scans: [row(a), row(fix)] });
    expect((await laterLoadout(db, a, null))?.outcome).toBe("ready");
    // Saved again since (it may be for another job now): not the same.
    const resaved = rec({ ...fix, plan: { ...plan, at: "2026-11-09T11:35:00.000Z" } });
    const { db: db2 } = fakeDb({ saas_loadout_scans: [row(a), row(resaved)] });
    expect(await laterLoadout(db2, a, null)).toBeNull();
  });
  it("same job reads the same with any case or spacing; a blank job matches nothing", () => {
    expect(sameJob({ job: "University 7-12  #3H" }, { job: "university 7-12 #3h" })).toBe(true);
    expect(sameJob({ job: "University 7-12 #3H" }, { job: null })).toBe(false);
    expect(sameJob({ job: null }, { job: null })).toBe(false);
    expect(sameJob({ job: "Pad 7" }, { job: "Pad 8" })).toBe(false);
  });
  it("the /l/ page for A's READY record shows A's record only: no word of B, no link, none of B's iron", async () => {
    const a = rec();
    dbHolder.current = fakeDb({
      saas_loadout_scans: [row(a), row(bFriday)],
      saas_companies: [{ id: "co-1", name: "Renegade Wireline", is_demo: false }],
      saas_yards: [{ id: "ody", name: "Odessa Yard", time_zone: "America/Chicago", company_id: "co-1" }],
    }).db;
    const html = renderToStaticMarkup(await PublicLoadoutPage({ params: Promise.resolve({ token: TOK_A }) }));
    const t = text(html);
    expect(t).toMatch(/University 7-12 #3H/);
    expect(t).not.toMatch(/loaded out again/);
    expect(html).not.toContain(TOK_B);
    expect(t).not.toMatch(/LB-9921|Freddy Carrasco/);
  });
  it("the /l/ page for a blocked record fixed on the shift: one line, no link to the fix's record", async () => {
    const a = rec({ verdict: "not_ready", reasons: ["Short: Quad BOP stack, 0 of 1 scanned"] });
    const fix = rec({ id: "lo-2", finished_at: "2026-11-09T11:40:00.000Z", proof_token: TOK_B, scanned_by: "Lupe Cardenas" });
    dbHolder.current = fakeDb({
      saas_loadout_scans: [row(a), row(fix)],
      saas_companies: [{ id: "co-1", name: "Renegade Wireline", is_demo: false }],
      saas_yards: [{ id: "ody", name: "Odessa Yard", time_zone: "America/Chicago", company_id: "co-1" }],
    }).db;
    const html = renderToStaticMarkup(await PublicLoadoutPage({ params: Promise.resolve({ token: TOK_A }) }));
    const t = text(html);
    expect(t).toMatch(/CT-08 was loaded out again for this job Nov 9, 5:40\sAM CT: READY \. Ask the shop for that record\./);
    expect(html).not.toContain(TOK_B);
    expect(t).not.toMatch(/Lupe Cardenas/);
  });
});

// ── The truck proof link (/proof/) ──
const proofTables = (over: Record<string, Row[]> = {}): Record<string, Row[]> => ({
  saas_readiness_proofs: [{ id: "p1", token: "ab".repeat(18), company_id: "co-1", scope: "unit", unit_id: "ct8", yard_id: null, expires_at: null, revoked_at: null, created_at: "2026-11-09T12:00:00.000Z" }],
  saas_companies: [{ id: "co-1", name: "Renegade Wireline", is_demo: false }],
  saas_units: [{ id: "ct8", name: "CT-08", yard_id: "ody", company_id: "co-1" }],
  saas_yards: [{ id: "ody", name: "Odessa Yard", time_zone: "America/Chicago", company_id: "co-1" }],
  saas_assets: [{ id: "a1", name: "Quad BOP stack", category: "pressure_control", identifier: "QB-4471", status: "in_service", unit_id: "ct8", yard_id: "ody", needs_redress_since: null, company_id: "co-1" }],
  saas_compliance_items_with_status: [{ id: "t1", company_id: "co-1", title: "BOP pressure test", kind: "pressure_test", expiration_date: "2027-06-01", pending_until: null, reminder_days: 30, parent_type: "asset", parent_id: "a1", last_upload_id: "u1" }],
  saas_cert_uploads: [{ id: "u1", company_id: "co-1", item_id: "t1", storage_path: "co-1/certs/qb.jpg" }],
  ...over,
});
const scan = (over: Row): Row => ({
  company_id: "co-1", unit_id: "ct8", yard_id: "ody", scanned: 1, expected: 1, not_scanned: [], reasons: [], verdict: "ready",
  scanned_by: "Dale Wooten", pieces: [{ name: "Quad BOP stack", serial: "QB-4471", how: "nfc" }], ...over,
});
const renderProof = async (tables: Record<string, Row[]>) => {
  dbHolder.current = fakeDb(tables).db;
  const html = renderToStaticMarkup(await ProofPage({ params: Promise.resolve({ token: "ab".repeat(18) }) }));
  return { html, t: text(html) };
};
const bScan = scan({ id: "lo-b", finished_at: "2026-11-13T12:05:00.000Z", proof_token: TOK_B, scanned_by: "Freddy Carrasco", pieces: [{ name: "Lubricator", serial: "LB-9921", how: "qr" }] });

describe("a truck link hides a later trip's load-out, checked in or not", () => {
  it("A loaded READY at 5:00, link made at 6:00, never checked in, B loaded Friday: B stays off the page", async () => {
    const { html, t } = await renderProof(proofTables({ saas_loadout_scans: [scan({ id: "lo-a", finished_at: "2026-11-09T11:00:00.000Z", proof_token: TOK_A }), bScan] }));
    expect(t).toMatch(/still had this truck out on its .* trip \(it was never checked back in\), so later load-outs don.t show here/);
    expect(html).not.toContain(TOK_B);
    expect(t).not.toMatch(/LB-9921|Freddy Carrasco/);
  });
  it("link made first, A rolled after it, then B on Friday with no check-in: B stays off", async () => {
    const { html, t } = await renderProof(proofTables({ saas_loadout_scans: [scan({ id: "lo-a", finished_at: "2026-11-09T13:00:00.000Z", proof_token: TOK_A }), bScan] }));
    expect(t).toMatch(/later trip/);
    expect(html).not.toContain(TOK_B);
  });
  it("A blocked and rolled on a manager's override before the link, then B: B stays off", async () => {
    const { html } = await renderProof(proofTables({
      saas_loadout_scans: [scan({ id: "lo-a", finished_at: "2026-11-09T11:00:00.000Z", proof_token: TOK_A, verdict: "not_ready", reasons: ["Short: Quad BOP stack"] }), bScan],
      saas_loadout_overrides: [{ loadout_id: "lo-a", by_name: "Kevin Odom", reason: "Spare stack", created_at: "2026-11-09T11:10:00.000Z" }],
    }));
    expect(html).not.toContain(TOK_B);
  });
  it("blocked before the link, fixed READY after it: the fix is this link's trip and shows", async () => {
    const { html, t } = await renderProof(proofTables({ saas_loadout_scans: [
      scan({ id: "lo-a", finished_at: "2026-11-09T11:00:00.000Z", proof_token: TOK_A, verdict: "not_ready", reasons: ["Short: Quad BOP stack"] }),
      scan({ id: "lo-fix", finished_at: "2026-11-09T12:30:00.000Z", proof_token: TOK_B }),
    ] }));
    expect(t).not.toMatch(/later trip/);
    expect(html).toContain(`/l/${TOK_B}`);
  });
  it("last trip checked in before the link was made, then loaded out: that's this link's trip and shows", async () => {
    const { html } = await renderProof(proofTables({
      saas_loadout_scans: [scan({ id: "lo-old", finished_at: "2026-11-02T11:00:00.000Z", proof_token: TOK_A }), scan({ id: "lo-new", finished_at: "2026-11-09T13:00:00.000Z", proof_token: TOK_B })],
      saas_returns: [{ id: "r1", company_id: "co-1", unit_id: "ct8", finished_at: "2026-11-05T20:00:00.000Z" }],
    }));
    expect(html).toContain(`/l/${TOK_B}`);
  });
  it("the load-out the link was made for still shows", async () => {
    const { html } = await renderProof(proofTables({ saas_loadout_scans: [scan({ id: "lo-a", finished_at: "2026-11-09T11:00:00.000Z", proof_token: TOK_A })] }));
    expect(html).toContain(`/l/${TOK_A}`);
  });
  it("another company's load-outs never count as a trip", async () => {
    const { db } = fakeDb({ saas_loadout_scans: [scan({ id: "x", company_id: "co-2", finished_at: "2026-11-09T11:00:00.000Z" })] });
    expect(await laterTripSince(db, "co-1", "ct8", "2026-11-09T12:00:00.000Z", { id: "lo-b", finished_at: "2026-11-13T12:05:00.000Z" })).toBe(false);
  });
});

// ── What the record shows ──
describe("the record shows the truck's own paper, a late phone save, and a red tag taken off", () => {
  const r = rec({
    finished_at: "2026-11-09T14:40:00.000Z",
    phone_saved_at: "2026-11-09T11:10:00.000Z",
    truck_paper: [
      { title: "Annual DOT inspection", good_until: "2026-10-30", result: "pending", paper: "dddddddd-0000-0000-0000-000000000001" },
      { title: "Registration", good_until: "2027-03-01", result: "ok", paper: null },
    ],
    pieces: [{ asset_id: "a1", name: "Quad BOP stack", serial: "QB-4471", how: "nfc", tests: [], red_tag_off: { by: "Kevin Odom", note: "New seals, retested", at: "2026-11-09T11:15:00.000Z" } }],
  });
  it("on the operator link", () => {
    const html = renderToStaticMarkup(createElement(LoadoutRecordView, {
      rec: r, override: null, forOperator: true, tz: null,
      truckPaper: { "dddddddd-0000-0000-0000-000000000001": "/l/x/paper/dddddddd-0000-0000-0000-000000000001" },
    }));
    const t = text(html);
    expect(t).toMatch(/Truck paper Annual DOT inspection: retested, cert on the way \(the old one ran out Oct 30, 2026\)/);
    expect(t).toMatch(/Registration: good to Mar 1, 2027/);
    expect(html).toContain('href="/l/x/paper/dddddddd-0000-0000-0000-000000000001"');
    expect(t).toMatch(/Saved on the phone Nov 9, 5:10\sAM CT, sent Nov 9, 8:40\sAM CT\./);
    expect(t).toMatch(/1 piece had its red tag taken off before it went on\./);
    expect(t).toMatch(/Red tag taken off by Kevin Odom Nov 9, 5:15\sAM CT: “New seals, retested”/);
  });
  it("a save that went straight through says nothing extra; an old record without the new fields reads as before", () => {
    const quick = renderToStaticMarkup(createElement(LoadoutRecordView, { rec: rec({ phone_saved_at: "2026-11-09T10:59:00.000Z" }), override: null }));
    expect(text(quick)).not.toMatch(/Saved on the phone/);
    const old = text(renderToStaticMarkup(createElement(LoadoutRecordView, { rec: rec(), override: null })));
    expect(old).not.toMatch(/Truck paper|red tag|Saved on the phone/i);
  });
  it("the truck's paper links only the cert the record kept, in this company", async () => {
    const { db } = fakeDb({ saas_cert_uploads: [
      { id: "dddddddd-0000-0000-0000-000000000001", company_id: "co-1", item_id: "dot", storage_path: "co-1/certs/dot.jpg" },
      { id: "dddddddd-0000-0000-0000-000000000002", company_id: "co-2", item_id: "x", storage_path: "co-2/certs/x.jpg" },
    ] });
    expect(truckPaperUploads(r.truck_paper)).toEqual(["dddddddd-0000-0000-0000-000000000001"]);
    expect(await recordTruckPaper(db, "co-1", r.truck_paper, (id) => `/l/t/paper/${id}`)).toEqual({ "dddddddd-0000-0000-0000-000000000001": "/l/t/paper/dddddddd-0000-0000-0000-000000000001" });
    expect(await recordTruckPaper(db, "co-1", [{ paper: "dddddddd-0000-0000-0000-000000000002" }])).toEqual({});
  });
  it("the /l/ cert link opens the truck's kept DOT and nothing else", async () => {
    const tables = {
      saas_loadout_scans: [row({ ...r, proof_token: TOK_A })],
      saas_cert_uploads: [
        { id: "dddddddd-0000-0000-0000-000000000001", company_id: "co-1", item_id: "dot", storage_path: "co-1/certs/dot.jpg" },
        { id: "dddddddd-0000-0000-0000-000000000003", company_id: "co-1", item_id: "dot2", storage_path: "co-1/certs/dot-new.jpg" },
      ],
    };
    dbHolder.current = fakeDb(tables).db;
    const ctx = (uploadId: string) => ({ params: Promise.resolve({ token: TOK_A, uploadId }) });
    const ok = await lPaper(new Request("https://www.synnr.io/x"), ctx("dddddddd-0000-0000-0000-000000000001"));
    expect(ok.status).toBe(302);
    expect(ok.headers.get("Location")).toBe("https://storage.test/co-1/certs/dot.jpg?ttl=300");
    expect((await lPaper(new Request("https://www.synnr.io/x"), ctx("dddddddd-0000-0000-0000-000000000003"))).status).toBe(404);
  });
});

describe("reading a record before migration 0040 is in", () => {
  it("reads with the new columns once they're there", async () => {
    const { db, selects } = fakeDb({ saas_loadout_scans: [row(rec({ truck_paper: [{ title: "Annual DOT inspection", good_until: "2027-01-01", result: "ok", paper: null }] }))] });
    const got = await getLoadout(db, { token: TOK_A });
    expect(got?.rec.truck_paper?.[0].title).toBe("Annual DOT inspection");
    expect(selects.filter((s) => s.startsWith("saas_loadout_scans")).length).toBe(1);
  });
  it("a select naming them fails until then: it reads again without them instead of losing the record", async () => {
    const { db, selects } = fakeDb({ saas_loadout_scans: [row(rec())] }, { fail: (t, cols) => t === "saas_loadout_scans" && cols.includes("truck_paper") });
    const got = await getLoadout(db, { id: "lo-a", companyId: "co-1" });
    expect(got?.rec.id).toBe("lo-a");
    expect(selects.filter((s) => s.startsWith("saas_loadout_scans"))).toHaveLength(2);
    expect(await selectRecord(async () => ({ data: null, error: { code: "x" } }))).toBeNull();
  });
});

describe("the proof links list says who made each truck, yard, and company link", () => {
  it("names the maker, and says when that person is off the crew", async () => {
    dbHolder.current = fakeDb({
      saas_loadout_scans: [],
      saas_loadout_link_offs: [],
      saas_readiness_proofs: [
        { id: "p1", token: "ab".repeat(18), company_id: "co-1", scope: "unit", created_at: "2026-11-09T12:00:00.000Z", created_by: "user-kevin", revoked_at: null, saas_units: { name: "CT-08" }, saas_yards: null },
        { id: "p2", token: "cd".repeat(18), company_id: "co-1", scope: "company", created_at: "2026-11-02T12:00:00.000Z", created_by: "user-ray", revoked_at: null, saas_units: null, saas_yards: null },
        { id: "p3", token: "ef".repeat(18), company_id: "co-2", scope: "company", created_at: "2026-11-02T12:00:00.000Z", created_by: "user-other", revoked_at: null, saas_units: null, saas_yards: null },
      ],
      saas_memberships: [
        { company_id: "co-1", user_id: "user-kevin", status: "active" },
        { company_id: "co-1", user_id: "user-ray", status: "removed" },
      ],
    }, { users: { "user-kevin": { email: "kevin@example.com", full_name: "Kevin Odom" }, "user-ray": { email: "ray.p@example.com" }, "user-other": { email: "x@other.com", full_name: "Other Co Man" } } }).db;
    const t = text(renderToStaticMarkup(await ProofsSettings()));
    expect(t).toMatch(/Made by Kevin Odom/);
    expect(t).not.toMatch(/Kevin Odom \(off the crew\)/);
    expect(t).toMatch(/Made by ray\.p \(off the crew\)/);
    expect(t).not.toMatch(/Other Co Man/);
  });
});
