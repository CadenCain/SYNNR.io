import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Certs, uploads and review fixes, run against the REAL upload pipeline
 * (lib/saas/cert-upload.ts) and routes on an in-memory database:
 *   1. A DOT annual inspection report prints the day it was done. The hand
 *      enters that day, it's checked against the photo, and it counts for a
 *      year. A quarterly inspection never gets that year.
 *   2. A hand's photo can't clear a piece with no serial, or one whose serial
 *      another piece carries too, without a manager.
 *   3. Approve writes a date the paper shows: one read off the photo, or the
 *      typed one only when the manager says they see it on the paper.
 *   4. "It lapsed <date>" only once that date has passed.
 *   5. Adding an item whose name is already on the truck renews that one.
 */

vi.mock("../notify", () => ({
  logEvent: vi.fn(async () => {}),
  notifyEvent: vi.fn(async () => {}),
}));
vi.mock("../alert-log", () => ({ clearAlertLog: vi.fn(async () => {}) }));
const ocr = vi.hoisted(() => ({ text: "" as string | null }));
vi.mock("../cert-read", () => ({ readPhotoText: vi.fn(async () => ocr.text) }));
const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({ saasAdmin: () => dbHolder.current, saasDb: async () => dbHolder.current }));
const caller = vi.hoisted(() => ({ role: "member" }));
vi.mock("@/app/api/saas/certs/_auth", () => ({
  certCaller: vi.fn(async () => ({
    ok: true, user: { id: "user-1" }, name: "Cody",
    company: { id: "co-1", name: "Test Wireline", role: caller.role, subscription_status: "active", comped: false },
  })),
}));

import { verifyUpload, isAnnualInspection, oneYearAfter, type VerifyInput } from "../cert-verify";
import { processUpload, applyUpload, piecesSharingSerial } from "../cert-upload";
import { POST as uploadPOST } from "@/app/api/saas/certs/upload/route";
import { POST as reviewPOST } from "@/app/api/saas/certs/review/route";

type Row = Record<string, unknown>;
interface Write { table: string; kind: "insert" | "update" | "delete"; payload: Row | null; ids: unknown[] }

/** Just enough PostgREST: filters filter, writes apply to the rows and are logged. */
function fakeDb(tables: Record<string, Row[]>) {
  const writes: Write[] = [];
  let n = 0;
  const from = (table: string) => {
    const t = (tables[table] ??= []);
    const preds: ((r: Row) => boolean)[] = [];
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | null = null;
    let single = false;
    let sort: [string, boolean] | null = null;
    let lo = 0, hi = Infinity, lim = Infinity;
    const q = {
      select: () => q,
      eq: (c: string, v: unknown) => { preds.push((r) => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { preds.push((r) => r[c] !== v); return q; },
      in: (c: string, v: unknown[]) => { preds.push((r) => v.includes(r[c])); return q; },
      ilike: (c: string, pat: string) => {
        const re = new RegExp(`^${pat.split("%").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "i");
        preds.push((r) => typeof r[c] === "string" && re.test(r[c] as string));
        return q;
      },
      order: (c: string, o?: { ascending?: boolean }) => { sort = [c, o?.ascending !== false]; return q; },
      range: (a: number, b: number) => { lo = a; hi = b; return q; },
      limit: (k: number) => { lim = k; return q; },
      maybeSingle: () => { single = true; return q; },
      single: () => { single = true; return q; },
      insert: (p: Row) => { mode = "insert"; payload = p; return q; },
      update: (p: Row) => { mode = "update"; payload = p; return q; },
      delete: () => { mode = "delete"; return q; },
      then: <T>(res: (v: { data: unknown; error: null; count?: number }) => T) => {
        if (mode === "insert") {
          const row = { id: `new-${++n}`, ...payload };
          t.push(row);
          writes.push({ table, kind: "insert", payload: row, ids: [row.id] });
          return res({ data: single ? row : [row], error: null });
        }
        const hit = t.filter((r) => preds.every((p) => p(r)));
        if (mode === "update") {
          hit.forEach((r) => Object.assign(r, payload));
          writes.push({ table, kind: "update", payload, ids: hit.map((r) => r.id) });
          return res({ data: hit, error: null });
        }
        if (mode === "delete") {
          for (const r of hit) t.splice(t.indexOf(r), 1);
          writes.push({ table, kind: "delete", payload: null, ids: hit.map((r) => r.id) });
          return res({ data: hit, error: null });
        }
        let rows = [...hit];
        if (sort) { const [c, asc] = sort; rows.sort((a, b) => String(a[c] ?? "").localeCompare(String(b[c] ?? "")) * (asc ? 1 : -1)); }
        rows = rows.slice(lo, hi + 1).slice(0, lim);
        return res({ data: single ? rows[0] ?? null : rows, error: null, count: hit.length });
      },
    };
    return q;
  };
  const storage = {
    from: () => ({
      upload: async () => ({ error: null }),
      createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ signedUrl: `https://signed/${p}` })) }),
    }),
  };
  return { client: { from, storage }, writes, tables };
}

const CO = "co-1";
const TODAY = "2026-11-10";
const company = { id: CO, name: "Test Wireline" };
const photo = { bytes: Buffer.from("not really a jpeg"), contentType: "image/jpeg" };

const DOT_REPORT = `ANNUAL VEHICLE INSPECTION REPORT
Motor carrier: Test Wireline   Vehicle: P-02
Inspection date: 11/10/2026
Inspector: J. Garza, qualified inspector
All items passed. DOT 49 CFR 396`;

const SLING_SHEET = `QUARTERLY SLING INSPECTION
Wire rope sling set   ID: SL-A
Inspected 09/24/2026   Next due 12/24/2026
Inspector signature on file`;

const BOP_CERT = `PERMIAN PRESSURE TESTING
CERTIFICATE OF PRESSURE TEST - BOP   Serial No: QB-4471
Date tested: 09/15/2026   Expires: 03/15/2027   PASS`;

const base = (over: Partial<VerifyInput> = {}): VerifyInput => ({
  evidence: "cert", claimedExpiration: "2027-11-10", today: TODAY, readText: DOT_REPORT,
  itemTitle: "Annual DOT inspection", holderName: null, identifier: "P-02",
  prevExpiration: "2026-10-17", itemWasFailing: true, claimedIssued: "2026-11-10", sameHashOn: [],
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T19:00:00Z`)); // 1 PM in the yard
  caller.role = "member";
});
afterEach(() => { vi.useRealTimers(); });

describe("a DOT annual inspection report (it prints the day it was done)", () => {
  it("only yearly items get the year: a quarterly sling inspection is an inspection too", () => {
    expect(isAnnualInspection("inspection", "Annual DOT inspection")).toBe(true);
    expect(isAnnualInspection("dot_sticker", "DOT sticker")).toBe(true);
    expect(isAnnualInspection("inspection", "Sling quarterly inspection")).toBe(false);
    expect(isAnnualInspection("inspection", "Chart recorder calibration")).toBe(false);
    expect(isAnnualInspection("registration", "DOT registration")).toBe(false);
    // The quick screen starts on "Cert": an inspection named yearly still counts.
    expect(isAnnualInspection("cert", "Annual DOT inspection")).toBe(true);
    expect(isAnnualInspection("cert", "DOT medical card")).toBe(false);
  });

  it("the day of the inspection typed as the expiration: says what to enter, not 'old paper'", async () => {
    ocr.text = DOT_REPORT;
    const db = fakeDb({
      saas_compliance_items_with_status: [{ id: "i-dot", company_id: CO, title: "Annual DOT inspection", kind: "inspection", parent_type: "unit", parent_id: "u-p02", expiration_date: "2026-10-17", pending_until: null, status: "expired" }],
      saas_compliance_items: [{ id: "i-dot", company_id: CO }],
      saas_units: [{ id: "u-p02", company_id: CO, name: "P-02", identifier: "P-02" }],
    });
    const r = await processUpload({
      admin: db.client as never, company, actor: { userId: "user-1", name: "Cody", role: "member" },
      itemId: "i-dot", evidence: "cert", claimedExpiration: "2026-11-10", claimedIssued: null, force: false, photo,
    });
    expect(r.outcome).toBe("rejected");
    expect(r.message).toContain("Enter 11/10/2027");
    expect(r.message).not.toContain("old one");
  });

  it("one year after the day it was done (Feb 29 lands on Feb 28)", () => {
    expect(oneYearAfter("2026-11-10")).toBe("2027-11-10");
    expect(oneYearAfter("2028-02-29")).toBe("2029-02-28");
  });

  it("the inspection day on the paper clears it for a year, with no made-up-date flag", () => {
    const v = verifyUpload(base({ annual: true }));
    expect(v.verdict).toBe("verified");
    expect(v.flags).toEqual([]);
    expect(v.issued).toBe("2026-11-10");
    expect(v.checks.find((c) => c.key === "date")!.detail).toContain("inspection date 11/10/2026");
  });

  it("before the fix the same honest report waited on a manager with a round-year flag", () => {
    const v = verifyUpload(base({ annual: false }));
    expect(v.verdict).toBe("needs_review");
    expect(v.flags.join(" ")).toContain("exactly 1 year");
  });

  it("a report that prints a sooner due date doesn't get the year", () => {
    const v = verifyUpload(base({ annual: true, readText: `${DOT_REPORT}\nNext due 05/10/2027` }));
    expect(v.verdict).toBe("needs_review");
    expect(v.checks.find((c) => c.key === "date")!.detail).toContain("05/10/2027");
  });

  it("a hand's renewal on the truck goes green on its own, good to a year from the inspection", async () => {
    ocr.text = DOT_REPORT;
    const db = fakeDb({
      saas_compliance_items_with_status: [{ id: "i-dot", company_id: CO, title: "Annual DOT inspection", kind: "inspection", parent_type: "unit", parent_id: "u-p02", expiration_date: "2026-10-17", pending_until: null, status: "expired" }],
      saas_compliance_items: [{ id: "i-dot", company_id: CO }],
      saas_units: [{ id: "u-p02", company_id: CO, name: "P-02", identifier: "P-02" }],
    });
    const r = await processUpload({
      admin: db.client as never, company, actor: { userId: "user-1", name: "Cody", role: "member" },
      itemId: "i-dot", evidence: "cert", claimedExpiration: "2027-11-10", claimedIssued: "2026-11-10", force: false, photo,
    });
    expect(r.outcome).toBe("applied");
    const write = db.writes.find((w) => w.table === "saas_compliance_items" && w.kind === "update" && w.payload?.expiration_date);
    expect(write?.payload).toMatchObject({ expiration_date: "2027-11-10", issued_date: "2026-11-10" });
  });
});

describe("a hand's photo has to name the piece, and only that piece", () => {
  const tables = (setB: Row) => ({
    saas_compliance_items_with_status: [{ id: "i-b", company_id: CO, title: "Sling quarterly inspection", kind: "inspection", parent_type: "asset", parent_id: "a-b", expiration_date: null, pending_until: null, status: "none" }],
    saas_compliance_items: [{ id: "i-b", company_id: CO }],
    saas_assets: [
      { id: "a-a", company_id: CO, name: "Wire rope slings, set A", identifier: "SL A", unit_id: "u-cr01", status: "out_of_service" },
      { id: "a-b", company_id: CO, name: "Wire rope slings, set B", unit_id: "u-cr01", status: "in_service", ...setB },
    ],
  });
  const send = (db: ReturnType<typeof fakeDb>, role: "member" | "admin") => processUpload({
    admin: db.client as never, company, actor: { userId: "user-1", name: "Cody", role },
    itemId: "i-b", evidence: "cert", claimedExpiration: "2026-12-24", claimedIssued: null, force: false, photo,
  });
  beforeEach(() => { ocr.text = SLING_SHEET; });

  it("a piece with no serial: the hand's upload waits on a manager, and says why", async () => {
    const db = fakeDb(tables({ identifier: null }));
    const r = await send(db, "member");
    expect(r.outcome).toBe("waiting");
    expect(r.message).toContain("no serial to check the paper against");
    expect(r.checks!.find((c) => c.key === "serial_none")!.ok).toBe(false);
    expect(db.writes.some((w) => w.table === "saas_compliance_items" && w.payload?.expiration_date)).toBe(false);
  });

  it("a piece given another piece's serial: waits, naming the other piece", async () => {
    const db = fakeDb(tables({ identifier: "SL-A" }));
    const r = await send(db, "member");
    expect(r.outcome).toBe("waiting");
    expect(r.checks!.find((c) => c.key === "serial_shared")!.detail).toContain("Wire rope slings, set A");
  });

  it("a manager's own upload isn't held for it", async () => {
    const db = fakeDb(tables({ identifier: null }));
    const r = await send(db, "admin");
    expect(r.outcome).toBe("applied");
  });

  it("the real piece, its own serial on the paper, still goes green for a hand", async () => {
    const db = fakeDb(tables({ identifier: "SL-A" }));
    db.tables.saas_assets.splice(0, 1); // set A is the only SL-A
    const r = await send(db, "member");
    expect(r.outcome).toBe("applied");
  });

  it("serials compare with spaces and dashes stripped, and retired iron doesn't count", async () => {
    const db = fakeDb({ saas_assets: [
      { id: "x1", company_id: CO, name: "Plug valve", identifier: "pv 2231", status: "in_service" },
      { id: "x2", company_id: CO, name: "Old plug valve", identifier: "PV-2231", status: "retired" },
      { id: "x3", company_id: CO, name: "Spool", identifier: "PV-22310", status: "in_service" },
      { id: "x4", company_id: CO, name: "Swivel", identifier: "PV-2213", status: "in_service" },
    ] });
    // The spool's cert prints PV-22310, and PV-2231 reads as found on it.
    expect(await piecesSharingSerial(db.client as never, CO, "me", "PV-2231")).toEqual(["Plug valve", "Spool"]);
  });

  it("a hand's new BOP given the tail of another stack's serial waits on a manager", async () => {
    ocr.text = BOP_CERT;
    const db = fakeDb({
      saas_compliance_items_with_status: [{ id: "i-9", company_id: CO, title: "BOP pressure test", kind: "test", parent_type: "asset", parent_id: "a-9", expiration_date: null, pending_until: null, status: "none" }],
      saas_compliance_items: [{ id: "i-9", company_id: CO }],
      saas_assets: [
        { id: "a-3", company_id: CO, name: "Quad BOP stack #3", identifier: "QB-4471", unit_id: "u-ct03", status: "in_service" },
        { id: "a-9", company_id: CO, name: "Quad BOP stack #9", identifier: "4471", unit_id: "u-ct03", status: "in_service" },
      ],
    });
    const r = await processUpload({
      admin: db.client as never, company, actor: { userId: "user-1", name: "Logan", role: "member" },
      itemId: "i-9", evidence: "cert", claimedExpiration: "2027-03-15", claimedIssued: null, force: false, photo,
    });
    expect(r.outcome).toBe("waiting");
    expect(r.checks!.find((c) => c.key === "serial_shared")!.detail).toContain("Quad BOP stack #3");
  });
});

describe("Approve writes a date the paper shows", () => {
  const waiting = (over: Row = {}): Row => ({
    id: "up-1", company_id: CO, item_id: "i-bop", status: "waiting", evidence: "cert",
    claimed_expiration: "2027-11-09", claimed_issued: "2026-09-15", pending_until: null, created_at: "2026-11-09T11:40:00Z",
    storage_path: `${CO}/cert/i-bop/1.jpg`, content_type: "image/jpeg", uploaded_by_name: "Logan", verdict: "needs_review",
    read_dates: ["2026-09-15", "2027-03-15"],
    checks: [
      { key: "readable", label: "Photo is readable", ok: true, detail: "Read it clearly" },
      { key: "date", label: "Expiration is on the paper", ok: false, detail: "Couldn't find 11/09/2027 on the photo. Dates on it: 09/15/2026, 03/15/2027" },
    ],
    ...over,
  });
  const world = (up: Row) => fakeDb({
    saas_cert_uploads: [up],
    saas_compliance_items_with_status: [{ id: "i-bop", company_id: CO, title: "BOP pressure test", kind: "test", parent_type: "asset", parent_id: "a-bop", expiration_date: "2026-11-01", pending_until: null, status: "expired" }],
    saas_compliance_items: [{ id: "i-bop", company_id: CO }],
    saas_assets: [{ id: "a-bop", company_id: CO, name: "Quad BOP stack #3", identifier: "QB-4471", unit_id: "u-ct03" }],
  });
  const kevin = { userId: "mgr-1", name: "Kevin" };
  const written = (db: ReturnType<typeof fakeDb>) =>
    db.writes.find((w) => w.table === "saas_compliance_items" && w.kind === "update" && w.payload?.expiration_date)?.payload?.expiration_date ?? null;

  it("picking the date read off the photo writes that date", async () => {
    const db = world(waiting());
    const r = await applyUpload(db.client as never, CO, "up-1", { ...kevin, expiration: "2027-03-15" });
    expect(r.ok).toBe(true);
    expect(r.message).toContain("03/15/2027");
    expect(written(db)).toBe("2027-03-15");
  });

  it("a date that wasn't read off the photo is refused", async () => {
    const db = world(waiting());
    const r = await applyUpload(db.client as never, CO, "up-1", { ...kevin, expiration: "2027-06-01" });
    expect(r.ok).toBe(false);
    expect(written(db)).toBeNull();
  });

  it("a plain approve can't write a typed date the photo doesn't show", async () => {
    const db = world(waiting());
    const r = await applyUpload(db.client as never, CO, "up-1", kevin);
    expect(r.ok).toBe(false);
    expect(written(db)).toBeNull();
  });

  it("the typed date goes on only when the manager says they see it on the paper", async () => {
    const db = world(waiting());
    const r = await applyUpload(db.client as never, CO, "up-1", { ...kevin, typedOk: true });
    expect(r.ok).toBe(true);
    expect(written(db)).toBe("2027-11-09");
  });

  it("a date the photo check found approves as before", async () => {
    const db = world(waiting({ checks: [{ key: "date", label: "Expiration is on the paper", ok: true, detail: "Found it" }] }));
    const r = await applyUpload(db.client as never, CO, "up-1", kevin);
    expect(r.ok).toBe(true);
    expect(written(db)).toBe("2027-11-09");
  });

  it("through the review route: a manager's pick from the paper is what's written", async () => {
    caller.role = "admin";
    const db = world(waiting());
    dbHolder.current = db.client;
    const res = await reviewPOST(new Request("http://x/api/saas/certs/review", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_id: "up-1", action: "approve", expiration: "2027-03-15" }),
    }));
    expect(res.status).toBe(200);
    expect(written(db)).toBe("2027-03-15");
  });
});

describe("the 'it lapsed' flag", () => {
  it("doesn't fire on the first paper for a date typed from the binder that hasn't come yet", () => {
    const v = verifyUpload(base({
      annual: false, itemTitle: "UT + hydro recert", identifier: null, claimedIssued: null,
      readText: "SHOP CERT UT and hydro recert test passed. Tested 11/04/2026 Expires 11/04/2027 Pressure 15000 psi",
      claimedExpiration: "2027-11-04", prevExpiration: "2027-11-04", itemWasFailing: true,
    }));
    expect(v.flags.join(" ")).not.toContain("lapsed");
  });
  it("still fires when it really lapsed and the new paper is dated before that", () => {
    const v = verifyUpload(base({
      annual: false, itemTitle: "BOP pressure test", identifier: "QB-4471", claimedIssued: null,
      readText: BOP_CERT, claimedExpiration: "2027-03-15", prevExpiration: "2026-10-01", itemWasFailing: true,
    }));
    expect(v.flags.join(" ")).toContain("lapsed");
  });
});

describe("adding an item by a name the truck already has", () => {
  it("renews the one on file instead of making a second one", async () => {
    ocr.text = DOT_REPORT;
    const db = fakeDb({
      saas_units: [{ id: "u-p02", company_id: CO, name: "P-02", identifier: "P-02" }],
      saas_compliance_items: [{ id: "i-dot", company_id: CO, parent_type: "unit", parent_id: "u-p02", title: "Annual DOT inspection" }],
      saas_compliance_items_with_status: [{ id: "i-dot", company_id: CO, title: "Annual DOT inspection", kind: "inspection", parent_type: "unit", parent_id: "u-p02", expiration_date: "2026-10-17", pending_until: null, status: "expired" }],
    });
    dbHolder.current = db.client;
    const fd = new FormData();
    fd.set("parent_type", "unit"); fd.set("parent_id", "u-p02"); fd.set("title", "annual  DOT inspection "); fd.set("kind", "inspection");
    fd.set("evidence", "cert"); fd.set("expiration", "2027-11-10"); fd.set("issued", "2026-11-10");
    fd.set("photo", new File([Buffer.from("jpeg")], "dot.jpg", { type: "image/jpeg" }));
    const res = await uploadPOST(new Request("http://x/api/saas/certs/upload", { method: "POST", body: fd }));
    const body = await res.json() as { ok: boolean; outcome: string; itemId: string };
    expect(body.ok).toBe(true);
    expect(body.itemId).toBe("i-dot");
    expect(db.writes.some((w) => w.table === "saas_compliance_items" && w.kind === "insert")).toBe(false);
    expect(db.tables.saas_compliance_items).toHaveLength(1);
  });
});
