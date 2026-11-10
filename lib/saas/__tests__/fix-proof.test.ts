import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Operator proof links and yard time zones, from the busy-week findings:
 *  - The truck proof says a manager rolled it NOT READY on an override, by
 *    name and why, instead of a red NOT READY under a green Ready.
 *  - A Hobbs (Mountain time) yard reads its own clock on the proof links,
 *    with the zone on every time ("5:10 AM MT"). Other screens unchanged.
 *  - A truck link made for one job doesn't show the next job's load-out
 *    after the truck was checked in.
 *  - An old NOT READY load-out link says, in one line, that the truck was
 *    loaded out again for the same job (fix2-proof.test.ts has the bounds).
 *  - Cert and truck photo links on the proof pages don't die after an hour:
 *    they go through the link, which signs a fresh one and honors shut-off.
 *  - "said to be on the truck" is gone; the proof links list says what it
 *    covers and where older links are.
 */

// ── A small in-memory database: filters filter, order sorts, writes are kept ──
type Row = Record<string, unknown>;
type Write = { table: string; payload: unknown; filters: Record<string, unknown> };
class Q {
  private rows: Row[];
  private one = false;
  private wantCount = false;
  private sorts: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  private rng: [number, number] | null = null;
  private write: Write | null = null;
  constructor(private table: string, data: Row[], private failing: boolean, private writes: Write[]) { this.rows = [...data]; }
  select(_cols?: string, opts?: { count?: string }) { if (opts?.count) this.wantCount = true; return this; }
  or() { return this; }
  eq(c: string, v: unknown) { if (this.write) this.write.filters[c] = v; else this.rows = this.rows.filter((r) => r[c] === v); return this; }
  neq(c: string, v: unknown) { this.rows = this.rows.filter((r) => r[c] !== v); return this; }
  in(c: string, vs: unknown[]) { this.rows = this.rows.filter((r) => vs.includes(r[c])); return this; }
  gt(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) > v); return this; }
  lt(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) < v); return this; }
  gte(c: string, v: string) { this.rows = this.rows.filter((r) => r[c] != null && String(r[c]) >= v); return this; }
  is(c: string, v: unknown) { this.rows = this.rows.filter((r) => (r[c] ?? null) === v); return this; }
  not(c: string, op: string, v: unknown) { if (op === "is" && v === null) this.rows = this.rows.filter((r) => r[c] != null); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.sorts.push({ col: c, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.rng = [a, b]; return this; }
  maybeSingle() { this.one = true; return this; }
  single() { this.one = true; return this; }
  update(payload: unknown) { this.write = { table: this.table, payload, filters: {} }; this.writes.push(this.write); return this; }
  then<T>(resolve: (v: { data: unknown; error: unknown; count: number | null }) => T): T {
    if (this.write) return resolve({ data: null, error: null, count: null });
    if (this.failing) return resolve({ data: null, error: { message: "column does not exist" }, count: null });
    let rows = [...this.rows];
    for (const s of [...this.sorts].reverse()) rows.sort((a, b) => (String(a[s.col] ?? "") < String(b[s.col] ?? "") ? -1 : String(a[s.col] ?? "") > String(b[s.col] ?? "") ? 1 : 0) * (s.asc ? 1 : -1));
    const count = rows.length;
    if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
    if (this.lim != null) rows = rows.slice(0, this.lim);
    return resolve({ data: this.one ? rows[0] ?? null : rows, error: null, count: this.wantCount ? count : null });
  }
}
function fakeDb(tables: Record<string, Row[]>, opts: { failing?: string[] } = {}) {
  const writes: Write[] = [];
  const signed: string[] = [];
  const db = {
    from: (t: string) => new Q(t, tables[t] ?? [], (opts.failing ?? []).includes(t), writes),
    storage: {
      from: () => ({
        createSignedUrl: async (p: string, secs: number) => { signed.push(p); return { data: { signedUrl: `https://storage.test/${p}?ttl=${secs}` }, error: null }; },
        createSignedUrls: async (ps: string[], secs: number) => { signed.push(...ps); return { data: ps.map((p) => ({ signedUrl: `https://storage.test/${p}?ttl=${secs}` })), error: null }; },
      }),
    },
  };
  return { db: db as unknown as SupabaseClient, writes, signed };
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
  assertCan: vi.fn((c: { role: string }) => { if (c.role === "member") throw new Error("Only a manager can do that."); }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/app/_actions", () => ({ updateYard: vi.fn(async () => {}) }));
vi.mock("../dispatch-check", () => ({ computeDispatchCheck: vi.fn(async () => ({ verdict: "ready", notChecked: [] })) }));
vi.mock("../readiness", () => ({ getCompanyReadiness: vi.fn(async () => ({ units: [] })) }));

import { fmtWhen, fmtTime, fmtDay, yardZone, isYardZone, zoneShort, YARD_ZONES, YARD_TZ } from "../format";
import { laterLoadout, checkedInBetween, yardZones, recordPhoto, type LoadoutRecord } from "../loadout-record";
import { recordPaper, recordPaperUploads, DEMO_PAPER } from "../paper";
import { itemInProofScope } from "@/app/proof/[token]/load-proof";
import LoadoutRecordView from "@/app/app/_components/loadout-record-view";
import PublicLoadoutPage from "@/app/l/[token]/page";
import ProofPage from "@/app/proof/[token]/page";
import { GET as lPaper } from "@/app/l/[token]/paper/[uploadId]/route";
import { GET as lPhoto } from "@/app/l/[token]/photo/route";
import { GET as proofPaper } from "@/app/proof/[token]/paper/[itemId]/route";
import { saveYard } from "@/app/app/yards/[yardId]/actions";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

// Thu Nov 12 2026, 5:10 AM Mountain (MST, UTC-7) = 6:10 AM Central (CST, UTC-6).
const T510MT = "2026-11-12T12:10:00.000Z";

describe("time zones: the formatters are additive", () => {
  it("existing callers read Central with no zone, exactly as before", () => {
    expect(fmtWhen(T510MT)).toMatch(/^Nov 12, 6:10\sAM$/);
    expect(fmtTime(T510MT)).toMatch(/^6:10\sAM$/);
    expect(fmtDay(T510MT)).toBe("Nov 12, 2026");
  });
  it("a Mountain yard reads its own clock, with the zone on it", () => {
    expect(fmtWhen(T510MT, "America/Denver")).toMatch(/^Nov 12, 5:10\sAM MT$/);
    expect(fmtTime(T510MT, "America/Denver")).toMatch(/^5:10\sAM MT$/);
  });
  it("a yard with no zone (null) reads Central, and says so", () => {
    expect(fmtWhen(T510MT, null)).toMatch(/^Nov 12, 6:10\sAM CT$/);
    expect(zoneShort(null)).toBe("CT");
  });
  it("an unknown zone falls back to Central, never to the server's UTC", () => {
    expect(yardZone("Europe/London")).toBe(YARD_TZ);
    expect(isYardZone("Europe/London")).toBe(false);
    expect(isYardZone("America/Denver")).toBe(true);
    expect(fmtWhen(T510MT, "Mars/Olympus")).toMatch(/6:10\sAM CT$/);
  });
  it("Arizona stays on Mountain standard in summer; Denver moves to daylight time", () => {
    const july = "2026-07-15T12:10:00.000Z";
    expect(fmtTime(july, "America/Phoenix")).toMatch(/^5:10\sAM MT$/);
    expect(fmtTime(july, "America/Denver")).toMatch(/^6:10\sAM MT$/);
  });
  it("the zone list matches the database check in migration 0035", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0035_yard_time_zone.sql"), "utf8");
    const inSql = [...sql.matchAll(/'(America\/[A-Za-z_]+)'/g)].map((m) => m[1]);
    expect(new Set(inSql)).toEqual(new Set(YARD_ZONES.map((z) => z.tz)));
    expect(sql).toMatch(/default 'America\/Chicago'/);
    expect(sql).toMatch(/add column if not exists time_zone/);
  });
});

describe("yard zones from the database", () => {
  it("reads each yard's zone", async () => {
    const { db } = fakeDb({ saas_yards: [{ id: "hobbs", time_zone: "America/Denver" }, { id: "ody", time_zone: "America/Chicago" }] });
    const z = await yardZones(db, ["hobbs", "ody", null]);
    expect(z.get("hobbs")).toBe("America/Denver");
    expect(z.get("ody")).toBe("America/Chicago");
  });
  it("before the migration is in, every yard reads Central instead of breaking the page", async () => {
    const { db } = fakeDb({ saas_yards: [{ id: "hobbs" }] }, { failing: ["saas_yards"] });
    expect((await yardZones(db, ["hobbs"])).size).toBe(0);
  });
});

describe("the yard edit page sets the zone", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
  beforeEach(() => { authMock.company.role = "owner"; });
  it("a manager sets Hobbs to Mountain, inside his own company", async () => {
    const f = fakeDb({});
    dbHolder.current = f.db;
    await saveYard(fd({ id: "hobbs", name: "Hobbs Yard", time_zone: "America/Denver", time_zone_was: "America/Chicago" }));
    expect(f.writes).toEqual([{ table: "saas_yards", payload: { time_zone: "America/Denver" }, filters: { id: "hobbs", company_id: "co-1" } }]);
  });
  it("a zone off the list is never written", async () => {
    const f = fakeDb({});
    dbHolder.current = f.db;
    await saveYard(fd({ id: "hobbs", name: "Hobbs Yard", time_zone: "Europe/London", time_zone_was: "America/Chicago" }));
    expect(f.writes).toEqual([]);
  });
  it("saving the name without touching the zone doesn't write the zone", async () => {
    const f = fakeDb({});
    dbHolder.current = f.db;
    await saveYard(fd({ id: "hobbs", name: "Hobbs Yard", time_zone: "America/Chicago", time_zone_was: "America/Chicago" }));
    expect(f.writes).toEqual([]);
  });
  it("a hand can't change a yard's clock", async () => {
    authMock.company.role = "member";
    const f = fakeDb({});
    dbHolder.current = f.db;
    await expect(saveYard(fd({ id: "hobbs", name: "Hobbs Yard", time_zone: "America/Denver", time_zone_was: "America/Chicago" }))).rejects.toThrow(/manager/);
    expect(f.writes).toEqual([]);
  });
});

// ── Load-out records ──
const rec = (over: Partial<LoadoutRecord> = {}): LoadoutRecord => ({
  id: "lo-1", company_id: "co-1", unit_id: "ct3", unit_name: "CT-03", yard_id: "hobbs", scanned_by: "Dale", started_at: null,
  finished_at: "2026-11-09T10:55:00.000Z", expected: 1, scanned: 0, verdict: "not_ready", reasons: ["Short: Quad BOP stack, 0 of 1 scanned"],
  lines: [], packages: [], pieces: [], not_scanned: [], proof_token: "a".repeat(32), job: "Pad 7", ...over,
});
const scanRow = (r: LoadoutRecord) => r as unknown as Row;

describe("an old NOT READY link says the truck was loaded out again for the same job", () => {
  const old = rec();
  const fixed = rec({ id: "lo-2", finished_at: "2026-11-09T12:05:00.000Z", verdict: "ready", reasons: [], proof_token: "b".repeat(32) });
  it("loaded out again READY: the old link says so, with no way to the other record", async () => {
    const { db } = fakeDb({ saas_loadout_scans: [scanRow(old), scanRow(fixed)] });
    const later = await laterLoadout(db, old, null);
    expect(later).toEqual({ unit_name: "CT-03", outcome: "ready", finished_at: fixed.finished_at, yard_id: "hobbs" });
  });
  it("nothing newer: nothing to point at", async () => {
    const { db } = fakeDb({ saas_loadout_scans: [scanRow(old)] });
    expect(await laterLoadout(db, old, null)).toBeNull();
  });
  it("a load-out after the truck was checked back in is the next trip: not pointed at", async () => {
    const nextJob = rec({ id: "lo-3", finished_at: "2026-11-13T11:00:00.000Z", verdict: "ready", reasons: [], proof_token: "c".repeat(32), job: null });
    const { db } = fakeDb({
      saas_loadout_scans: [scanRow(old), scanRow(nextJob)],
      saas_returns: [{ id: "r1", company_id: "co-1", unit_id: "ct3", finished_at: "2026-11-11T20:00:00.000Z" }],
    });
    expect(await laterLoadout(db, old, null)).toBeNull();
  });
  it("same trip, then a check-in, then the next job: points at the same-trip one, not the next job", async () => {
    const nextJob = rec({ id: "lo-3", finished_at: "2026-11-13T11:00:00.000Z", verdict: "ready", reasons: [], proof_token: "c".repeat(32) });
    const { db } = fakeDb({
      saas_loadout_scans: [scanRow(old), scanRow(fixed), scanRow(nextJob)],
      saas_returns: [{ id: "r1", company_id: "co-1", unit_id: "ct3", finished_at: "2026-11-11T20:00:00.000Z" }],
    });
    expect((await laterLoadout(db, old, null))?.finished_at).toBe(fixed.finished_at);
  });
  it("a newer load-out for a different job is not this operator's to see", async () => {
    const { db } = fakeDb({ saas_loadout_scans: [scanRow(old), scanRow({ ...fixed, job: "Another pad" })] });
    expect(await laterLoadout(db, old, null)).toBeNull();
  });
  it("the shop shut the newer link off: not pointed at", async () => {
    const { db } = fakeDb({ saas_loadout_scans: [scanRow(old), scanRow(fixed)], saas_loadout_link_offs: [{ loadout_id: "lo-2", company_id: "co-1" }] });
    expect(await laterLoadout(db, old, null)).toBeNull();
  });
  it("the newer one rolled on a manager's override: it says that, not READY", async () => {
    const rolled = { ...fixed, verdict: "not_ready" as const, reasons: ["Short: Quad BOP stack"] };
    const { db } = fakeDb({
      saas_loadout_scans: [scanRow(old), scanRow(rolled)],
      saas_loadout_overrides: [{ loadout_id: "lo-2", by_name: "Kevin Odom", reason: "Spare dual stack", created_at: fixed.finished_at }],
    });
    expect((await laterLoadout(db, old, null))?.outcome).toBe("override");
  });
  it("another company's load-outs are never looked at", async () => {
    const { db } = fakeDb({ saas_loadout_scans: [scanRow(old), scanRow({ ...fixed, company_id: "co-2" })] });
    expect(await laterLoadout(db, old, null)).toBeNull();
  });
});

describe("checked in between two times", () => {
  const { db } = fakeDb({ saas_returns: [{ id: "r1", company_id: "co-1", unit_id: "ct3", finished_at: "2026-11-11T20:00:00.000Z" }] });
  it("finds a check-in inside the window, not outside it", async () => {
    expect(await checkedInBetween(db, "co-1", "ct3", "2026-11-09T00:00:00.000Z", "2026-11-13T00:00:00.000Z")).toBe(true);
    expect(await checkedInBetween(db, "co-1", "ct3", "2026-11-12T00:00:00.000Z", "2026-11-13T00:00:00.000Z")).toBe(false);
    expect(await checkedInBetween(db, "co-1", "ct3", "2026-11-13T00:00:00.000Z", "2026-11-09T00:00:00.000Z")).toBe(false);
    expect(await checkedInBetween(db, "co-1", "ct9", "2026-11-09T00:00:00.000Z", "2026-11-13T00:00:00.000Z")).toBe(false);
  });
});

describe("the record view on the operator link", () => {
  it("every time in the yard's zone, with the zone; the newer load-out under the verdict", () => {
    const r = rec({
      finished_at: T510MT,
      pieces: [{ asset_id: "a1", name: "Quad BOP stack", serial: "QB-4472", how: "nfc", at: T510MT, by: "Dale", red: true, tests: [] }],
      photo_path: null,
    });
    const html = renderToStaticMarkup(createElement(LoadoutRecordView, {
      rec: r, override: null, forOperator: true, tz: "America/Denver",
      later: { unit_name: "CT-03", finished_at: "2026-11-12T13:05:00.000Z", outcome: "ready", tz: "America/Denver" },
    }));
    const t = text(html);
    expect(t).toMatch(/CT-03 load-out, Nov 12, 5:10\sAM MT, by Dale/);
    expect(t).toMatch(/NFC tap 5:10\sAM MT by Dale/);
    expect(t).toMatch(/CT-03 was loaded out again for this job Nov 12, 6:05\sAM MT: READY \. Ask the shop for that record/);
    expect(html).not.toMatch(/href="\/l\//);
  });
  it("in the app (no zone passed) it reads exactly as before", () => {
    const html = renderToStaticMarkup(createElement(LoadoutRecordView, { rec: rec({ finished_at: T510MT }), override: null }));
    expect(text(html)).toMatch(/CT-03 load-out, Nov 12, 6:10\sAM, by Dale/);
    expect(text(html)).not.toMatch(/AM CT|AM MT/);
  });
});

describe("cert and photo links on the load-out link don't die after an hour", () => {
  const token = "d".repeat(32);
  const base = () => ({
    saas_loadout_scans: [scanRow(rec({
      proof_token: token, photo_path: "co-1/loadouts/1731409800000-1731409900000.jpg",
      pieces: [
        { asset_id: "a1", name: "Quad BOP stack", serial: "QB-4472", how: "nfc", tests: [{ title: "BOP test", good_until: "2027-05-12", result: "ok", paper: "11111111-1111-1111-1111-111111111111" }] },
        { asset_id: "a2", name: "Lubricator", serial: "LB-9", how: "qr", tests: [{ title: "Pressure test", good_until: "2027-01-01", result: "ok", paper: "22222222-2222-2222-2222-222222222222" }] },
      ],
    }))],
    saas_cert_uploads: [
      { id: "11111111-1111-1111-1111-111111111111", company_id: "co-1", item_id: "i1", storage_path: "co-1/certs/bop.jpg" },
      { id: "22222222-2222-2222-2222-222222222222", company_id: "co-1", item_id: "i2", storage_path: `${DEMO_PAPER}i2` },
      { id: "33333333-3333-3333-3333-333333333333", company_id: "co-1", item_id: "i3", storage_path: "co-1/certs/other.jpg" },
    ],
  });
  const req = (p: string) => new Request(`https://www.synnr.io${p}`);
  const ctx = <T,>(p: T) => ({ params: Promise.resolve(p) });

  it("the page links each cert and the photo through the link itself, not a one-hour signed link", async () => {
    const f = fakeDb(base());
    const r = (base().saas_loadout_scans[0] as unknown as LoadoutRecord);
    const paper = await recordPaper(f.db, "co-1", r.pieces, (id) => `/l/${token}/paper/${id}`);
    expect(paper.a1).toEqual([{ title: "BOP test", url: `/l/${token}/paper/11111111-1111-1111-1111-111111111111` }]);
    expect(paper.a2).toEqual([{ title: "Pressure test", url: "/demo-cert/i2" }]);
    expect(f.signed).toEqual([]);
    const photo = await recordPhoto(f.db, r, `/l/${token}/photo`);
    expect(photo?.url).toBe(`/l/${token}/photo`);
    expect(f.signed).toEqual([]);
  });
  it("in the app the links are still signed, as before", async () => {
    const f = fakeDb(base());
    const r = (base().saas_loadout_scans[0] as unknown as LoadoutRecord);
    const paper = await recordPaper(f.db, "co-1", r.pieces);
    expect(paper.a1[0].url).toMatch(/^https:\/\/storage\.test\/co-1\/certs\/bop\.jpg\?ttl=3600$/);
  });
  it("tapping a cert signs a fresh short link and sends the phone to it", async () => {
    dbHolder.current = fakeDb(base()).db;
    const res = await lPaper(req(`/l/${token}/paper/x`), ctx({ token, uploadId: "11111111-1111-1111-1111-111111111111" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.test/co-1/certs/bop.jpg?ttl=300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("a demo yard's cert opens the sample cert", async () => {
    dbHolder.current = fakeDb(base()).db;
    const res = await lPaper(req(`/l/${token}/paper/x`), ctx({ token, uploadId: "22222222-2222-2222-2222-222222222222" }));
    expect(res.headers.get("Location")).toBe("https://www.synnr.io/demo-cert/i2");
  });
  it("a cert that isn't on this record never opens through it", async () => {
    dbHolder.current = fakeDb(base()).db;
    const res = await lPaper(req("/x"), ctx({ token, uploadId: "33333333-3333-3333-3333-333333333333" }));
    expect(res.status).toBe(404);
  });
  it("once the shop shuts the link off, its certs and photo stop opening", async () => {
    dbHolder.current = fakeDb({ ...base(), saas_loadout_link_offs: [{ loadout_id: "lo-1", company_id: "co-1" }] }).db;
    expect((await lPaper(req("/x"), ctx({ token, uploadId: "11111111-1111-1111-1111-111111111111" }))).status).toBe(410);
    expect((await lPhoto(req("/x"), ctx({ token }))).status).toBe(410);
  });
  it("the truck photo signs fresh each time", async () => {
    dbHolder.current = fakeDb(base()).db;
    const res = await lPhoto(req("/x"), ctx({ token }));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.test/co-1/loadouts/1731409800000-1731409900000.jpg?ttl=300");
  });
  it("a made-up token opens nothing", async () => {
    dbHolder.current = fakeDb(base()).db;
    expect((await lPaper(req("/x"), ctx({ token: "e".repeat(32), uploadId: "11111111-1111-1111-1111-111111111111" }))).status).toBe(404);
    expect((await lPhoto(req("/x"), ctx({ token: "not-a-token" }))).status).toBe(404);
  });
  it("the papers a record stands on are the ones it kept", async () => {
    const r = (base().saas_loadout_scans[0] as unknown as LoadoutRecord);
    const want = await recordPaperUploads(fakeDb(base()).db, "co-1", r.pieces);
    expect(want.map((w) => w.upload).sort()).toEqual(["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"]);
  });
});

describe("the /l/ page: the Hobbs record reads Mountain time and says the truck was fixed", () => {
  it("renders the zone, the newer READY record, and links certs through the link", async () => {
    const token = "f".repeat(32);
    const old = rec({ proof_token: token, finished_at: T510MT, pieces: [{ asset_id: "a1", name: "Quad BOP stack", serial: "QB-4472", how: "nfc", at: T510MT, tests: [{ title: "BOP test", good_until: "2027-05-12", result: "ok", paper: "11111111-1111-1111-1111-111111111111" }] }] });
    const fixed = rec({ id: "lo-2", finished_at: "2026-11-12T13:05:00.000Z", verdict: "ready", reasons: [], proof_token: "b".repeat(32) });
    dbHolder.current = fakeDb({
      saas_loadout_scans: [scanRow(old), scanRow(fixed)],
      saas_companies: [{ id: "co-1", name: "Renegade Wireline", is_demo: false }],
      saas_yards: [{ id: "hobbs", name: "Hobbs Yard", time_zone: "America/Denver", company_id: "co-1" }],
      saas_cert_uploads: [{ id: "11111111-1111-1111-1111-111111111111", company_id: "co-1", item_id: "i1", storage_path: "co-1/certs/bop.jpg" }],
    }).db;
    const html = renderToStaticMarkup(await PublicLoadoutPage({ params: Promise.resolve({ token }) }));
    const t = text(html);
    expect(t).toMatch(/CT-03 load-out, Nov 12, 5:10\sAM MT/);
    expect(t).toMatch(/CT-03 was loaded out again for this job Nov 12, 6:05\sAM MT: READY/);
    expect(html).not.toContain(`/l/${"b".repeat(32)}`);
    expect(html).toContain(`href="/l/${token}/paper/11111111-1111-1111-1111-111111111111"`);
    expect(html).not.toContain("storage.test");
  });
});

// ── The truck proof link (/proof/) ──
const proofTables = (over: Record<string, Row[]> = {}): Record<string, Row[]> => ({
  saas_readiness_proofs: [{ id: "p1", token: "ab".repeat(18), company_id: "co-1", scope: "unit", unit_id: "ct4", yard_id: null, expires_at: null, revoked_at: null, created_at: "2026-11-09T12:00:00.000Z" }],
  saas_companies: [{ id: "co-1", name: "Renegade Wireline", is_demo: false }],
  saas_units: [{ id: "ct4", name: "CT-04", yard_id: "hobbs", company_id: "co-1" }],
  saas_yards: [{ id: "hobbs", name: "Hobbs Yard", time_zone: "America/Denver", company_id: "co-1" }],
  saas_assets: [{ id: "db2210", name: "Dual BOP stack", category: "pressure_control", identifier: "DB-2210", status: "in_service", unit_id: "ct4", yard_id: "hobbs", needs_redress_since: null, company_id: "co-1" }],
  saas_compliance_items_with_status: [{ id: "t1", company_id: "co-1", title: "BOP pressure test", kind: "pressure_test", expiration_date: "2027-06-01", pending_until: null, reminder_days: 30, parent_type: "asset", parent_id: "db2210", last_upload_id: "u1" }],
  saas_cert_uploads: [{ id: "u1", company_id: "co-1", item_id: "t1", storage_path: "co-1/certs/db.jpg" }],
  saas_loadout_scans: [{
    id: "lo-4", company_id: "co-1", unit_id: "ct4", yard_id: "hobbs", finished_at: T510MT, scanned_by: "Dale", scanned: 0, expected: 1,
    pieces: [], not_scanned: [{ name: "Reel", serial: "R-5", outcome: "left" }], verdict: "not_ready", reasons: ["Short: Quad BOP stack, 0 of 1 scanned"], proof_token: "4".repeat(32),
  }],
  saas_loadout_overrides: [{ loadout_id: "lo-4", by_name: "Kevin Odom", reason: "Spare dual stack DB-2210 replaces red-tagged QB-4472", created_at: "2026-11-12T12:20:00.000Z" }],
  ...over,
});
const renderProof = async (tables: Record<string, Row[]>) => {
  dbHolder.current = fakeDb(tables).db;
  const html = renderToStaticMarkup(await ProofPage({ params: Promise.resolve({ token: "ab".repeat(18) }) }));
  return { html, t: text(html) };
};

describe("the truck proof shows a manager's override the way the record does", () => {
  it("rolled NOT READY on an override: by name, why, in amber, not a bare red NOT READY", async () => {
    const { html, t } = await renderProof(proofTables());
    expect(t).toMatch(/Rolled NOT READY on a manager's override by Kevin Odom/);
    expect(t).toMatch(/Spare dual stack DB-2210 replaces red-tagged QB-4472/);
    expect(t).toMatch(/Its last load-out rolled NOT READY on a manager's override by Kevin Odom/);
    expect(t).not.toMatch(/NOT READY at load-out/);
    expect(html).toMatch(/text-amber-300[^>]*><li[^>]*>Short: Quad BOP stack/);
  });
  it("without an override it still reads NOT READY at load-out, in red", async () => {
    const { t } = await renderProof(proofTables({ saas_loadout_overrides: [] }));
    expect(t).toMatch(/NOT READY at load-out/);
    expect(t).not.toMatch(/override/);
    expect(t).toMatch(/Not ready/);
  });
  it("times read in the truck's yard zone with the zone on them", async () => {
    const { t } = await renderProof(proofTables());
    expect(t).toMatch(/Last load-out scan Nov 12, 5:10\sAM MT/);
    expect(t).toMatch(/Generated .* MT/);
  });
  it("a piece nobody scanned reads 'not scanned', never 'said to be on the truck'", async () => {
    const { t } = await renderProof(proofTables());
    expect(t).toMatch(/Not scanned Reel R-5 still logged on the truck, nobody scanned it/);
    expect(t).not.toMatch(/said to be on the truck/);
  });
  it("certs link through the proof link, not a one-hour signed link", async () => {
    const { html } = await renderProof(proofTables());
    expect(html).toContain(`href="/proof/${"ab".repeat(18)}/paper/t1"`);
    expect(html).not.toContain("storage.test");
  });
});

describe("a truck link made for one job doesn't show the next job", () => {
  it("checked in after the link was made, then loaded for the next job: the load-out stays off the page", async () => {
    const { html, t } = await renderProof(proofTables({
      saas_loadout_overrides: [],
      saas_loadout_scans: [{ ...proofTables().saas_loadout_scans[0], verdict: "ready", reasons: [], finished_at: "2026-11-13T11:00:00.000Z" }],
      saas_returns: [{ id: "r1", company_id: "co-1", unit_id: "ct4", finished_at: "2026-11-11T20:00:00.000Z" }],
    }));
    expect(t).toMatch(/loaded out again for a later trip since this link was made/);
    expect(html).not.toContain(`/l/${"4".repeat(32)}`);
    expect(t).not.toMatch(/Reel R-5/);
  });
  it("the load-out the link was made for still shows, with its record link", async () => {
    const { html } = await renderProof(proofTables({ saas_loadout_overrides: [] }));
    expect(html).toContain(`/l/${"4".repeat(32)}`);
  });
});

describe("the truck proof's cert link checks the proof and its scope", () => {
  const token = "ab".repeat(18);
  const items = [
    { id: "t1", company_id: "co-1", parent_type: "asset", parent_id: "db2210", last_upload_id: "u1" },
    { id: "t9", company_id: "co-1", parent_type: "asset", parent_id: "other", last_upload_id: "u9" },
  ];
  const tables = (over: Record<string, Row[]> = {}) => ({
    ...proofTables(),
    saas_compliance_items: items,
    saas_assets: [...proofTables().saas_assets, { id: "other", name: "Lubricator", status: "in_service", unit_id: "ct9", yard_id: "ody", company_id: "co-1" }],
    saas_cert_uploads: [{ id: "u1", company_id: "co-1", item_id: "t1", storage_path: "co-1/certs/db.jpg" }, { id: "u9", company_id: "co-1", item_id: "t9", storage_path: "co-1/certs/lub.jpg" }],
    ...over,
  });
  const req = new Request("https://www.synnr.io/x");
  it("an id that isn't one opens nothing", async () => {
    dbHolder.current = fakeDb(tables()).db;
    expect((await proofPaper(req, { params: Promise.resolve({ token, itemId: "t1" }) })).status).toBe(404);
  });
  it("scope: this truck's iron yes, another truck's iron no, crew never", async () => {
    const { db } = fakeDb(tables());
    const proof = { company_id: "co-1", scope: "unit", unit_id: "ct4", yard_id: null };
    expect(await itemInProofScope(db, proof, { parent_type: "asset", parent_id: "db2210" })).toBe(true);
    expect(await itemInProofScope(db, proof, { parent_type: "asset", parent_id: "other" })).toBe(false);
    expect(await itemInProofScope(db, proof, { parent_type: "unit", parent_id: "ct4" })).toBe(true);
    expect(await itemInProofScope(db, proof, { parent_type: "unit", parent_id: "ct9" })).toBe(false);
    expect(await itemInProofScope(db, proof, { parent_type: "crew", parent_id: "x" })).toBe(false);
    const yard = { company_id: "co-1", scope: "yard", unit_id: null, yard_id: "hobbs" };
    expect(await itemInProofScope(db, yard, { parent_type: "asset", parent_id: "db2210" })).toBe(true);
    expect(await itemInProofScope(db, yard, { parent_type: "asset", parent_id: "other" })).toBe(false);
    expect(await itemInProofScope(db, yard, { parent_type: "unit", parent_id: "ct4" })).toBe(true);
    const company = { company_id: "co-1", scope: "company", unit_id: null, yard_id: null };
    expect(await itemInProofScope(db, company, { parent_type: "asset", parent_id: "other" })).toBe(true);
    expect(await itemInProofScope(db, company, { parent_type: "crew", parent_id: "x" })).toBe(false);
  });
  it("retired iron is off every proof", async () => {
    const { db } = fakeDb(tables({ saas_assets: [{ id: "db2210", status: "retired", unit_id: "ct4", yard_id: "hobbs", company_id: "co-1" }] }));
    expect(await itemInProofScope(db, { company_id: "co-1", scope: "company", unit_id: null, yard_id: null }, { parent_type: "asset", parent_id: "db2210" })).toBe(false);
  });
  it("opens with a real id, refuses another truck's test, and stops once the link is shut off", async () => {
    const T1 = "11111111-0000-0000-0000-000000000001";
    const T9 = "11111111-0000-0000-0000-000000000009";
    const withIds = (over: Record<string, Row[]> = {}) => tables({
      saas_compliance_items: [{ ...items[0], id: T1 }, { ...items[1], id: T9 }],
      saas_cert_uploads: [{ id: "u1", company_id: "co-1", item_id: T1, storage_path: "co-1/certs/db.jpg" }, { id: "u9", company_id: "co-1", item_id: T9, storage_path: "co-1/certs/lub.jpg" }],
      ...over,
    });
    dbHolder.current = fakeDb(withIds()).db;
    const ok = await proofPaper(req, { params: Promise.resolve({ token, itemId: T1 }) });
    expect(ok.status).toBe(302);
    expect(ok.headers.get("Location")).toBe("https://storage.test/co-1/certs/db.jpg?ttl=300");
    const other = await proofPaper(req, { params: Promise.resolve({ token, itemId: T9 }) });
    expect(other.status).toBe(404);
    dbHolder.current = fakeDb(withIds({ saas_readiness_proofs: [{ ...proofTables().saas_readiness_proofs[0], revoked_at: "2026-11-10T00:00:00.000Z" }] })).db;
    expect((await proofPaper(req, { params: Promise.resolve({ token, itemId: T1 }) })).status).toBe(410);
  });
});
