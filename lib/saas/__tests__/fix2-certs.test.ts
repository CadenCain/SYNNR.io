import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Round two, certs and the QR tag page:
 *  - "See the cert" and "See the retest paper" on the tag page go through
 *    the tag (/t/<token>/paper/<itemId>), which re-checks the tag and the
 *    test's piece and signs a fresh 5-minute link every tap. A signed link
 *    in the page itself died after an hour on a tab left open on location.
 *  - Someone from the shop scanning a piece flagged missing is told to open
 *    it and say where it is (Move it now marks a missing piece found).
 */

type Row = Record<string, unknown>;
class Q {
  private rows: Row[];
  private one = false;
  private sorts: { col: string; asc: boolean }[] = [];
  private lim: number | null = null;
  constructor(data: Row[]) { this.rows = [...data]; }
  select() { return this; }
  eq(c: string, v: unknown) { this.rows = this.rows.filter((r) => r[c] === v); return this; }
  in(c: string, vs: unknown[]) { this.rows = this.rows.filter((r) => vs.includes(r[c])); return this; }
  order(c: string, o?: { ascending?: boolean }) { this.sorts.push({ col: c, asc: o?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  maybeSingle() { this.one = true; return this; }
  then<T>(resolve: (v: { data: unknown; error: unknown }) => T): T {
    let rows = [...this.rows];
    for (const s of [...this.sorts].reverse()) rows.sort((a, b) => (String(a[s.col] ?? "") < String(b[s.col] ?? "") ? -1 : String(a[s.col] ?? "") > String(b[s.col] ?? "") ? 1 : 0) * (s.asc ? 1 : -1));
    if (this.lim != null) rows = rows.slice(0, this.lim);
    return resolve({ data: this.one ? rows[0] ?? null : rows, error: null });
  }
}
function fakeDb(tables: Record<string, Row[]>) {
  const signed: { path: string; secs: number }[] = [];
  const db = {
    from: (t: string) => new Q(tables[t] ?? []),
    storage: {
      from: () => ({
        createSignedUrl: async (p: string, secs: number) => { signed.push({ path: p, secs }); return { data: { signedUrl: `https://storage.test/${p}?ttl=${secs}` }, error: null }; },
        createSignedUrls: async (ps: string[], secs: number) => { ps.forEach((p) => signed.push({ path: p, secs })); return { data: ps.map((p) => ({ signedUrl: `https://storage.test/${p}?ttl=${secs}` })), error: null }; },
      }),
    },
  };
  return { db: db as unknown as SupabaseClient, signed };
}

const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({ saasDb: async () => dbHolder.current, saasAdmin: () => dbHolder.current }));
const who = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("../auth", () => ({ getSaasUser: vi.fn(async () => who.user) }));

import TagPage from "@/app/t/[token]/page";
import { GET as tagPaper } from "@/app/t/[token]/paper/[itemId]/route";
import { DEMO_PAPER } from "../paper";

const TOKEN = "ab".repeat(16);
const OTHER_TOKEN = "cd".repeat(16);
const BOP = "11111111-0000-0000-0000-000000000001"; // current, cert on file
const LUB = "11111111-0000-0000-0000-000000000002"; // retested, cert on the way
const OTHER_PIECE = "11111111-0000-0000-0000-000000000003"; // same shop, another piece
const OTHER_SHOP = "11111111-0000-0000-0000-000000000004"; // another customer
const DEMO = "11111111-0000-0000-0000-000000000005";

function tables(over: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    saas_assets: [
      { id: "a1", company_id: "co-1", name: "Quad BOP stack", category: "bop", identifier: "QB-4472", status: "in_service", tag_token: TOKEN, needs_redress_since: null, redress_each_run: false, out_since: null, out_with_name: null },
      { id: "a2", company_id: "co-1", name: "Lubricator", category: "lubricator", identifier: "LB-9", status: "in_service", tag_token: "ef".repeat(16) },
      { id: "z1", company_id: "co-2", name: "Their BOP", category: "bop", identifier: "X-1", status: "in_service", tag_token: OTHER_TOKEN },
    ],
    saas_companies: [{ id: "co-1", name: "Test Wireline", is_demo: false }, { id: "co-2", name: "Other Shop", is_demo: false }],
    saas_memberships: [{ company_id: "co-1", user_id: "user-1", status: "active" }],
    saas_compliance_items: [
      { id: BOP, company_id: "co-1", parent_type: "asset", parent_id: "a1", title: "BOP test", issued_date: "2026-05-12", expiration_date: "2099-05-12", reminder_days: 30, pending_until: null, last_upload_id: "u1" },
      { id: LUB, company_id: "co-1", parent_type: "asset", parent_id: "a1", title: "Pressure test", issued_date: "1999-01-01", expiration_date: "2000-01-01", reminder_days: 30, pending_until: "2099-01-01", last_upload_id: "u2" },
      { id: OTHER_PIECE, company_id: "co-1", parent_type: "asset", parent_id: "a2", title: "Pressure test", issued_date: "2026-01-01", expiration_date: "2099-01-01", reminder_days: 30, pending_until: null, last_upload_id: "u3" },
      { id: OTHER_SHOP, company_id: "co-2", parent_type: "asset", parent_id: "z1", title: "BOP test", issued_date: "2026-01-01", expiration_date: "2099-01-01", reminder_days: 30, pending_until: null, last_upload_id: "u4" },
    ],
    saas_cert_uploads: [
      { id: "u1", company_id: "co-1", item_id: BOP, storage_path: "co-1/certs/bop.jpg", evidence: "cert", status: "applied", applied_at: "2026-05-13T00:00:00Z" },
      { id: "u2", company_id: "co-1", item_id: LUB, storage_path: "co-1/certs/lub-old.jpg", evidence: "cert", status: "applied", applied_at: "1999-01-02T00:00:00Z" },
      { id: "r1", company_id: "co-1", item_id: LUB, storage_path: "co-1/certs/lub-retest-old.jpg", evidence: "temporary", status: "applied", applied_at: "2026-11-01T00:00:00Z" },
      { id: "r2", company_id: "co-1", item_id: LUB, storage_path: "co-1/certs/lub-retest.jpg", evidence: "temporary", status: "applied", applied_at: "2026-11-08T00:00:00Z" },
      { id: "u3", company_id: "co-1", item_id: OTHER_PIECE, storage_path: "co-1/certs/other.jpg", evidence: "cert", status: "applied" },
      { id: "u4", company_id: "co-2", item_id: OTHER_SHOP, storage_path: "co-2/certs/theirs.jpg", evidence: "cert", status: "applied" },
    ],
    ...over,
  };
}

const req = (q = "") => new Request(`https://www.synnr.io/t/${TOKEN}/paper/x${q}`);
const open = (token: string, itemId: string, q = "") => tagPaper(req(q), { params: Promise.resolve({ token, itemId }) });
const render = async (token = TOKEN) => renderToStaticMarkup(await TagPage({ params: Promise.resolve({ token }) }));

beforeEach(() => { who.user = null; });

describe("tag page cert links", () => {
  it("links each cert through the tag, never a signed storage link", async () => {
    const f = fakeDb(tables());
    dbHolder.current = f.db;
    const html = await render();
    expect(html).toContain(`href="/t/${TOKEN}/paper/${BOP}"`);
    expect(html).toContain(`href="/t/${TOKEN}/paper/${LUB}?retest=1"`);
    expect(html).toContain(`href="/t/${TOKEN}/paper/${LUB}"`);
    expect(html).not.toContain("storage.test");
    expect(f.signed).toEqual([]);
  });

  it("opens the current cert with a fresh 5-minute link", async () => {
    const f = fakeDb(tables());
    dbHolder.current = f.db;
    const res = await open(TOKEN, BOP);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.test/co-1/certs/bop.jpg?ttl=300");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("opens the newest retest paper only while the test reads cert on the way", async () => {
    dbHolder.current = fakeDb(tables()).db;
    const res = await open(TOKEN, LUB, "?retest=1");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://storage.test/co-1/certs/lub-retest.jpg?ttl=300");
    // The BOP test is current: no retest paper behind this tag for it.
    expect((await open(TOKEN, BOP, "?retest=1")).status).toBe(404);
    // Once the new cert is in and "cert on the way" is off, the retest paper is gone too.
    const t = tables();
    t.saas_compliance_items = t.saas_compliance_items.map((i) => (i.id === LUB ? { ...i, expiration_date: "2099-01-01", pending_until: null } : i));
    dbHolder.current = fakeDb(t).db;
    expect((await open(TOKEN, LUB, "?retest=1")).status).toBe(404);
  });

  it("won't open another piece's cert, or another shop's, through this tag", async () => {
    const f = fakeDb(tables());
    dbHolder.current = f.db;
    expect((await open(TOKEN, OTHER_PIECE)).status).toBe(404);
    expect((await open(TOKEN, OTHER_SHOP)).status).toBe(404);
    expect((await open(TOKEN, OTHER_SHOP, "?retest=1")).status).toBe(404);
    expect(f.signed).toEqual([]);
  });

  it("refuses a tag that isn't there and a bad id", async () => {
    dbHolder.current = fakeDb(tables()).db;
    expect((await open("99".repeat(16), BOP)).status).toBe(404);
    expect((await open("not-a-token", BOP)).status).toBe(404);
    expect((await open(TOKEN, "u1")).status).toBe(404);
  });

  it("a demo yard's sample cert opens the sample page", async () => {
    const t = tables({
      saas_cert_uploads: [{ id: "d1", company_id: "co-1", item_id: DEMO, storage_path: `${DEMO_PAPER}${DEMO}`, evidence: "cert", status: "applied" }],
    });
    t.saas_compliance_items.push({ id: DEMO, company_id: "co-1", parent_type: "asset", parent_id: "a1", title: "Demo test", issued_date: "2026-01-01", expiration_date: "2099-01-01", reminder_days: 30, pending_until: null, last_upload_id: "d1" });
    const f = fakeDb(t);
    dbHolder.current = f.db;
    const res = await open(TOKEN, DEMO);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(`https://www.synnr.io/demo-cert/${DEMO}`);
    expect(f.signed).toEqual([]);
  });
});

describe("tag page for a piece flagged missing", () => {
  const missing = () => {
    const t = tables();
    t.saas_assets = t.saas_assets.map((a) => (a.id === "a1" ? { ...a, status: "missing" } : a));
    return t;
  };
  it("tells someone from the shop to open it and say where it is", async () => {
    who.user = { id: "user-1" };
    dbHolder.current = fakeDb(missing()).db;
    const html = await render();
    expect(html).toContain("Found it? Open it in RollReady and say where it is");
    expect(html).toContain('href="/app/assets/a1"');
  });
  it("keeps the usual line on a piece that isn't missing", async () => {
    who.user = { id: "user-1" };
    dbHolder.current = fakeDb(tables()).db;
    const html = await render();
    expect(html).toContain("Open it in RollReady to move it or upload a new cert");
    expect(html).not.toContain("Found it?");
  });
  it("shows no way into the app to someone outside the shop", async () => {
    who.user = { id: "user-9" };
    dbHolder.current = fakeDb(missing()).db;
    const html = await render();
    expect(html).not.toContain("/app/assets/");
    expect(html).toContain("Flagged missing");
  });
});
