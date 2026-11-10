import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Team, exports and settings, round two:
 *  - Test history and the cert photo link behind it are iron and truck paper
 *    only, like every other export: a crew card (and a photo sent through a
 *    crew card link) stays out, and its photo doesn't open.
 *  - The load-out and check-in spreadsheets read on each yard's clock with
 *    the zone on every time, and a date range counts the picked yard's days
 *    (or the one zone all the yards share).
 */

const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Renegade Wireline", role: "member", subscription_status: "active", comped: false, yard_quantity: 1, is_demo: false },
  user: { id: "user-dale", email: "dale@example.com", user_metadata: { full_name: "Dale" } },
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

import { equipmentUploads, isCrewCardPhoto, checkinRows, testHistoryRows, type ItemRec } from "@/app/api/saas/export/rows";
import { when, companyYardZones } from "@/app/api/saas/export/csv";
import { rangeOf, rangeZone, loadoutFilters } from "@/app/app/loadouts/export/filters";
import { GET as testsCsv } from "@/app/api/saas/export/tests/route";
import { GET as certPhoto } from "@/app/api/saas/export/cert/[uploadId]/route";
import { GET as loadoutsCsv } from "@/app/app/loadouts/export/route";
import { GET as checkinsCsv } from "@/app/api/saas/export/checkins/route";

const CO = "co-1";

// ------------------------------------------------------------- a small db
type Row = Record<string, unknown>;
type Filter = [string, string, unknown];

/** `broken` lists table:column pairs whose select errors (a column not in yet). */
function fakeDb(tables: Record<string, Row[]>, broken: string[] = []) {
  const reads: { table: string; filters: Filter[] }[] = [];
  const signed: string[] = [];
  const matchOne = (r: Row, [c, op, v]: Filter): boolean => {
    if (op === "eq") return r[c] === v;
    if (op === "neq") return r[c] !== v;
    if (op === "is") return (r[c] ?? null) === v;
    if (op === "in") return (v as unknown[]).includes(r[c]);
    if (op === "gte") return String(r[c] ?? "") >= String(v);
    if (op === "lt") return String(r[c] ?? "") < String(v);
    if (op === "or") return String(v).split(",").some((part) => { const [col, o, ...rest] = part.split("."); return matchOne(r, [col, o, rest.join(".") === "null" ? null : rest.join(".")]); });
    return true;
  };
  class Q {
    private filters: Filter[] = [];
    private span: [number, number] | null = null;
    private single = false;
    private cols = "";
    constructor(private table: string) {}
    select(c?: string) { this.cols = c ?? ""; return this; }
    eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
    neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
    is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
    in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
    gte(c: string, v: unknown) { this.filters.push([c, "gte", v]); return this; }
    lt(c: string, v: unknown) { this.filters.push([c, "lt", v]); return this; }
    ilike() { return this; }
    or(f: string) { this.filters.push(["", "or", f]); return this; }
    order() { return this; }
    range(a: number, b: number) { this.span = [a, b]; return this; }
    maybeSingle() { this.single = true; return this; }
    then<T>(resolve: (v: { data: unknown; error: unknown; count?: number }) => T): T {
      reads.push({ table: this.table, filters: this.filters });
      if (broken.some((b) => { const [t, col] = b.split(":"); return t === this.table && this.cols.includes(col); })) {
        return resolve({ data: null, error: { message: "column does not exist" } });
      }
      const hit = (tables[this.table] ?? []).filter((r) => this.filters.every((f) => matchOne(r, f)));
      if (this.single) return resolve({ data: hit[0] ?? null, error: null });
      const page = this.span ? hit.slice(this.span[0], this.span[1] + 1) : hit;
      return resolve({ data: page, error: null, count: hit.length });
    }
  }
  const db = {
    from: (t: string) => new Q(t),
    storage: { from: () => ({ createSignedUrl: async (path: string) => { signed.push(path); return { data: { signedUrl: `https://files.example.com/${path}` } }; } }) },
  };
  return { db: db as unknown as SupabaseClient, reads, signed };
}

const csvRows = (text: string) => text.trim().split("\n");

const upload = (id: string, item_id: string | null, storage_path: string, extra: Row = {}) => ({
  id, company_id: CO, item_id, storage_path, created_at: "2026-10-01T15:00:00Z", uploaded_by_name: "Dale", evidence: "cert",
  claimed_issued: null, claimed_expiration: "2027-10-01", pending_until: null, verdict: "verified", status: "applied",
  applied_at: "2026-10-01T15:00:00Z", reviewed_by_name: null, reviewed_at: null, review_note: null, ...extra,
});
const UP_BOP = "11111111-1111-4111-8111-111111111111";
const UP_CARD = "22222222-2222-4222-8222-222222222222";
const UP_CARD_GONE = "33333333-3333-4333-8333-333333333333";
const UP_TRUCK = "44444444-4444-4444-8444-444444444444";
const UP_GONE = "55555555-5555-4555-8555-555555555555";

function paperDb() {
  return fakeDb({
    saas_cert_uploads: [
      upload(UP_BOP, "it-bop", `${CO}/cert/it-bop/1.jpg`),
      upload(UP_CARD, "it-med", `${CO}/cert/it-med/1.jpg`, { review_note: "Medical card, renewed" }),
      upload(UP_CARD_GONE, null, `${CO}/docreq/req-1/1-card.jpg`),
      upload(UP_TRUCK, "it-dot", `${CO}/cert/it-dot/1.jpg`),
      upload(UP_GONE, null, `${CO}/cert/it-old/1.jpg`),
    ],
    saas_compliance_items: [
      { id: "it-bop", company_id: CO, title: "Pressure test", parent_type: "asset", parent_id: "a-bop", expiration_date: "2027-10-01", last_upload_id: UP_BOP },
      { id: "it-med", company_id: CO, title: "DOT medical card", parent_type: "crew", parent_id: "c-dale", expiration_date: "2027-10-01", last_upload_id: UP_CARD },
      { id: "it-dot", company_id: CO, title: "Annual DOT inspection", parent_type: "unit", parent_id: "u-ct03", expiration_date: "2027-10-01", last_upload_id: UP_TRUCK },
    ],
    saas_assets: [{ id: "a-bop", company_id: CO, name: "Quad BOP #11", identifier: "QB-4471" }],
    saas_units: [{ id: "u-ct03", company_id: CO, name: "CT-03" }],
  });
}

// ------------------------------------------------------------- crew paper stays out
describe("test history is iron and truck paper only", () => {
  it("a crew card's uploads drop out; a deleted test stays unless its photo came through a crew card link", () => {
    const items: ItemRec[] = [
      { id: "it-bop", title: "Pressure test", parent_type: "asset", parent_id: "a-bop", expiration_date: null, last_upload_id: null },
      { id: "it-med", title: "DOT medical card", parent_type: "crew", parent_id: "c-dale", expiration_date: null, last_upload_id: null },
    ];
    const kept = equipmentUploads([
      { id: "a", item_id: "it-bop", storage_path: `${CO}/cert/it-bop/1.jpg` },
      { id: "b", item_id: "it-med", storage_path: `${CO}/cert/it-med/1.jpg` },
      { id: "c", item_id: null, storage_path: `${CO}/docreq/req-1/1-card.jpg` },
      { id: "d", item_id: null, storage_path: `${CO}/cert/it-old/1.jpg` },
      { id: "e", item_id: "it-not-read", storage_path: `${CO}/cert/x/1.jpg` },
    ], items);
    expect(kept.map((u) => u.id)).toEqual(["a", "d"]);
    expect(isCrewCardPhoto(`${CO}/docreq/req-1/x.jpg`)).toBe(true);
    expect(isCrewCardPhoto(`${CO}/cert/it-bop/docreq.jpg`)).toBe(false);
    expect(isCrewCardPhoto(null)).toBe(false);
  });

  it("the spreadsheet has the BOP, the truck paper and the deleted test, never the medical card", async () => {
    const f = paperDb();
    dbHolder.current = f.db;
    const text = await (await testsCsv()).text();
    expect(text).toContain("Quad BOP #11");
    expect(text).toContain("CT-03 (truck paper)");
    expect(text).toContain("Test deleted");
    expect(text).not.toContain("DOT medical card");
    expect(text).not.toContain("Medical card, renewed");
    expect(text).not.toContain(UP_CARD);
    expect(text).not.toContain(UP_CARD_GONE);
    expect(csvRows(text)).toHaveLength(1 + 3);
    // The tests it reads leave crew cards out in the database, this company's only.
    const itemRead = f.reads.find((r) => r.table === "saas_compliance_items")!;
    expect(itemRead.filters).toContainEqual(["parent_type", "neq", "crew"]);
    expect(f.reads.every((r) => r.filters.some(([c, op, v]) => c === "company_id" && op === "eq" && v === CO))).toBe(true);
  });

  it("the cert link opens a piece's or a truck's photo, and not a crew card's", async () => {
    const open = async (id: string) => {
      const f = paperDb();
      dbHolder.current = f.db;
      const res = await certPhoto(new Request(`https://www.synnr.io/api/saas/export/cert/${id}`), { params: Promise.resolve({ uploadId: id }) });
      return { status: res.status, signed: f.signed };
    };
    const bop = await open(UP_BOP);
    expect(bop.status).toBe(307);
    expect(bop.signed).toEqual([`${CO}/cert/it-bop/1.jpg`]);
    expect((await open(UP_TRUCK)).status).toBe(307);
    expect((await open(UP_GONE)).status).toBe(307);
    for (const id of [UP_CARD, UP_CARD_GONE]) {
      const r = await open(id);
      expect(r.status).toBe(404);
      expect(r.signed).toEqual([]);
    }
  });

  it("the rows themselves don't change for iron", () => {
    const rows = testHistoryRows({
      uploads: [upload(UP_BOP, "it-bop", "x") as never],
      items: [{ id: "it-bop", title: "Pressure test", parent_type: "asset", parent_id: "a-bop", expiration_date: "2027-10-01", last_upload_id: UP_BOP }],
      pieces: new Map([["a-bop", { name: "Quad BOP #11", serial: "QB-4471" }]]), trucks: new Map(),
      certUrl: (id) => `https://www.synnr.io/api/saas/export/cert/${id}`,
    });
    expect(rows[0].slice(1, 4)).toEqual(["Quad BOP #11", "QB-4471", "Pressure test"]);
  });
});

// ------------------------------------------------------------- yard clocks
describe("times on the yard's clock", () => {
  it("with a zone passed, the time reads in it with the zone on it; without, Central as before", () => {
    const at = "2026-11-10T11:02:00Z";
    expect(when(at)).toBe("11/10/2026, 5:02 AM");
    expect(when(at, null)).toBe("11/10/2026, 5:02 AM CT");
    expect(when(at, "America/Denver")).toBe("11/10/2026, 4:02 AM MT");
    expect(when(at, "Not/AZone")).toBe("11/10/2026, 5:02 AM CT");
    expect(when(null, "America/Denver")).toBe("");
  });

  it("each yard's zone comes from this company's yards; before the column is in, none (Central)", async () => {
    const yards = [
      { id: "y-hobbs", company_id: CO, name: "Hobbs", time_zone: "America/Denver" },
      { id: "y-other", company_id: "co-2", name: "Other", time_zone: "America/New_York" },
    ];
    expect([...(await companyYardZones(fakeDb({ saas_yards: yards }).db, CO))]).toEqual([["y-hobbs", "America/Denver"]]);
    expect((await companyYardZones(fakeDb({ saas_yards: yards }, ["saas_yards:time_zone"]).db, CO)).size).toBe(0);
  });

  it("a date range counts the picked yard's days, or the one zone all the yards share", () => {
    const mixed = new Map([["y-hobbs", "America/Denver"], ["y-odessa", "America/Chicago"]]);
    const hobbsOnly = new Map([["y-hobbs", "America/Denver"]]);
    const hobbs = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(rangeZone({ yard: "" }, mixed)).toBe("America/Chicago");
    expect(rangeZone({ yard: "" }, hobbsOnly)).toBe("America/Denver");
    expect(rangeZone({ yard: "" }, new Map())).toBe("America/Chicago");
    expect(rangeZone({ yard: hobbs }, new Map([[hobbs, "America/Denver"], ["y-odessa", "America/Chicago"]]))).toBe("America/Denver");
    expect(rangeOf({ from: "2026-11-30", to: "2026-11-30" }, "America/Denver")).toEqual({ gte: "2026-11-30T07:00:00.000Z", lt: "2026-12-01T07:00:00.000Z" });
    // Left out, Central as before.
    expect(rangeOf({ from: "2026-11-30", to: "" })).toEqual({ gte: "2026-11-30T06:00:00.000Z", lt: null });
  });

  it("check-ins: a Hobbs check-in reads in Mountain, its went-out time too", () => {
    const rows = checkinRows([{
      id: "ret-1", yard_id: "y-hobbs", unit_name: "CT-07", returned_by: "Freddy", finished_at: "2026-11-11T20:10:00Z",
      pieces: [{ name: "Quad BOP #11", serial: "QB-4471", how: "nfc", at: Date.parse("2026-11-11T20:05:00Z"), to: "yard",
        went_out: { truck: "CT-07", by: "Dale", at: "2026-11-02T11:00:00Z" } }],
      not_returned: [],
    }, {
      id: "ret-2", yard_id: null, unit_name: null, returned_by: "Freddy", finished_at: "2026-11-11T20:10:00Z", pieces: [], not_returned: [],
    }], new Map([["y-hobbs", "Hobbs"]]), new Map([["y-hobbs", "America/Denver"]]));
    expect(rows[0][0]).toBe("11/11/2026, 1:10 PM MT");
    expect(rows[0][7]).toBe("11/11/2026, 1:05 PM MT");
    expect(rows[0][10]).toBe("On CT-07 11/02/2026, 4:00 AM MT, loaded by Dale");
    expect(rows[1][0]).toBe("11/11/2026, 2:10 PM CT");
  });

  it("the check-in download uses each yard's zone", async () => {
    dbHolder.current = fakeDb({
      saas_returns: [{ id: "r1", company_id: CO, yard_id: "y-hobbs", unit_name: "CT-07", returned_by: "Freddy", finished_at: "2026-11-11T20:10:00Z", pieces: [], not_returned: [] }],
      saas_yards: [{ id: "y-hobbs", company_id: CO, name: "Hobbs", time_zone: "America/Denver" }],
    }).db;
    expect(await (await checkinsCsv()).text()).toContain('"11/11/2026, 1:10 PM MT",CT-07,Hobbs');
  });
});

// ------------------------------------------------------------- the load-out spreadsheet
const HOBBS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ODESSA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const loadout = (id: string, yard_id: string, finished_at: string, extra: Row = {}) => ({
  id, company_id: CO, unit_name: "CT-07", yard_id, finished_at, scanned_by: "Dale", verdict: "ready", reasons: [],
  pieces: [{ asset_id: "a-bop", name: "Quad BOP #11", serial: null, how: "nfc", at: finished_at }], not_scanned: [],
  proof_token: `tok-${id}`, job: null, roll_checks: [{ label: "BOP rams closed for travel", ok: true, by: "Dale", at: finished_at }], photo_path: null, ...extra,
});

describe("the load-out spreadsheet on the yard's clock", () => {
  const tables = () => ({
    saas_loadout_scans: [
      // 11:30 PM in Hobbs on Nov 30 is 12:30 AM Dec 1 in Central.
      loadout("l-late", HOBBS, "2026-12-01T06:30:00Z"),
      loadout("l-odessa", ODESSA, "2026-11-30T15:00:00Z"),
    ],
    saas_yards: [
      { id: HOBBS, company_id: CO, name: "Hobbs", time_zone: "America/Denver" },
      { id: ODESSA, company_id: CO, name: "Odessa", time_zone: "America/Chicago" },
    ],
    saas_loadout_overrides: [], saas_loadout_link_offs: [],
  });

  it("every time carries its yard's zone: the load-out, each piece, and each roll check", async () => {
    dbHolder.current = fakeDb(tables()).db;
    const lines = csvRows(await (await loadoutsCsv(new Request("https://www.synnr.io/app/loadouts/export"))).text());
    const late = lines.find((l) => l.includes("tok-l-late"))!;
    expect(late.startsWith('"11/30/2026, 11:30 PM MT",CT-07,Hobbs')).toBe(true);
    expect(late).toContain("BOP rams closed for travel: done by Dale 11/30/2026, 11:30 PM MT");
    const odessa = lines.find((l) => l.includes("tok-l-odessa"))!;
    expect(odessa.startsWith('"11/30/2026, 9:00 AM CT",CT-07,Odessa')).toBe(true);
  });

  it("Hobbs picked, Nov 30 is Hobbs's Nov 30: the 11:30 PM load-out is in it", async () => {
    dbHolder.current = fakeDb(tables()).db;
    const lines = csvRows(await (await loadoutsCsv(new Request(`https://www.synnr.io/app/loadouts/export?yard=${HOBBS}&from=2026-11-30&to=2026-11-30`))).text());
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("tok-l-late");
  });

  it("the column isn't in yet: yard names still show and times read Central", async () => {
    dbHolder.current = fakeDb(tables(), ["saas_yards:time_zone"]).db;
    const lines = csvRows(await (await loadoutsCsv(new Request("https://www.synnr.io/app/loadouts/export"))).text());
    const late = lines.find((l) => l.includes("tok-l-late"))!;
    expect(late.startsWith('"12/01/2026, 12:30 AM CT",CT-07,Hobbs')).toBe(true);
    expect(loadoutFilters(new URLSearchParams("yard=nope")).yard).toBe("");
  });
});
