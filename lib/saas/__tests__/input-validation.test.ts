import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeSupabase, type CapturedWrite } from "./fake-supabase";

/**
 * Human-input pressure tests on the REAL cert mutations.
 *
 * The contract these pin is deliberately NOT the naive one:
 *   · IMPOSSIBLE dates ("banana", Feb 30) die before any write, with the
 *     field named in plain English — never a raw Postgres error.
 *   · PAST dates SAVE. An expired cert is real data; recording a binder full
 *     of lapsed paper is the product's day-one job. The UI flags it red —
 *     blocking it would break onboarding.
 *   · FAR-FUTURE dates SAVE. Tank certs run ten years; MTRs don't expire.
 *     "2050 is unrealistic" is a spreadsheet instinct, not a yard fact.
 */

vi.mock("../notify", () => ({
  sendEmail: vi.fn(async () => true),
  sendSms: vi.fn(async () => true),
  smsConfigured: () => false,
  notifyEvent: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
}));
const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Spy Coil Tubing", role: "owner", subscription_status: "active", comped: false, yard_quantity: 1, npt_day_estimate: 10000 },
  user: { id: "user-1", email: "caden@example.com", user_metadata: {} },
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
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const CO = "co-1";

function freshDb() {
  const fake = fakeSupabase({
    saas_units: [{ id: "u1", name: "Rig 4", company_id: CO }],
    saas_compliance_items: [],
    saas_alerts_sent: [],
    saas_item_customers: [],
    saas_attachments: [],
  });
  dbHolder.current = fake.client;
  return fake;
}
const itemWrites = (writes: CapturedWrite[]) => writes.filter((w) => w.table === "saas_compliance_items");

async function actions() {
  const unit = await import("../../../app/app/units/[unitId]/actions");
  const shared = await import("../../../app/app/_actions");
  return { ...unit, ...shared };
}

function updateFd(expiration: string, issued = "") {
  const fd = new FormData();
  fd.set("id", "item-1");
  fd.set("title", "BOP pressure test");
  fd.set("kind", "test");
  fd.set("issued_date", issued);
  fd.set("expiration_date", expiration);
  fd.set("redirect_path", "");
  return fd;
}
function addFd(expiration: string) {
  const fd = new FormData();
  fd.set("parent_type", "unit");
  fd.set("parent_id", "u1");
  fd.set("title", "Coil string fatigue inspection");
  fd.set("kind", "inspection");
  fd.set("expiration_date", expiration);
  fd.set("issued_date", "");
  fd.set("redirect_path", "");
  return fd;
}

describe("impossible dates die before the write, with the field named", () => {
  beforeEach(() => freshDb());

  it('renew with "banana" → clean error, ZERO writes', async () => {
    const { renewComplianceItem } = await actions();
    const { writes } = freshDb();
    await expect(renewComplianceItem({ itemId: "item-1", expiration_date: "banana" }))
      .rejects.toThrow(/New expiration date: bad date/);
    expect(itemWrites(writes)).toHaveLength(0);
  });

  it("edit form with Feb 30 → clean error naming the field, ZERO writes", async () => {
    const { updateComplianceItem } = await actions();
    const { writes } = freshDb();
    await expect(updateComplianceItem(updateFd("2026-02-30")))
      .rejects.toThrow(/Expires: impossible date/);
    expect(itemWrites(writes)).toHaveLength(0);
  });

  it("add form with month 13 → clean error, ZERO writes", async () => {
    const { addComplianceItem } = await actions();
    const { writes } = freshDb();
    await expect(addComplianceItem(addFd("2026-13-01")))
      .rejects.toThrow(/Expires: impossible date/);
    expect(itemWrites(writes)).toHaveLength(0);
  });

  it("a bad ISSUED date is caught under its own name", async () => {
    const { updateComplianceItem } = await actions();
    freshDb();
    await expect(updateComplianceItem(updateFd("2027-01-01", "not a date")))
      .rejects.toThrow(/Issued: bad date/);
  });
});

describe("the dates the naive spec would block are LEGAL — pinned on purpose", () => {
  it("a PAST expiration SAVES (expired paper is the product, the UI flags it red)", async () => {
    const { renewComplianceItem } = await actions();
    const { writes } = freshDb();
    await renewComplianceItem({ itemId: "item-1", expiration_date: "2020-01-01" });
    const w = itemWrites(writes).filter((x) => x.kind === "update");
    expect(w).toHaveLength(1);
    expect((w[0].payload as { expiration_date: string }).expiration_date).toBe("2020-01-01");
  });

  it("2050 SAVES (ten-year tank certs are real; no arbitrary future ceiling)", async () => {
    const { addComplianceItem } = await actions();
    const { writes } = freshDb();
    await addComplianceItem(addFd("2050-06-01"));
    const w = itemWrites(writes).filter((x) => x.kind === "insert");
    expect(w).toHaveLength(1);
    expect((w[0].payload as { expiration_date: string }).expiration_date).toBe("2050-06-01");
  });

  it("Excel-style M/D/YYYY normalizes to ISO on the way in", async () => {
    const { updateComplianceItem } = await actions();
    const { writes } = freshDb();
    await updateComplianceItem(updateFd("7/4/2027"));
    const w = itemWrites(writes).filter((x) => x.kind === "update");
    expect((w[0].payload as { expiration_date: string }).expiration_date).toBe("2027-07-04");
  });
});

describe("fingerprints — a changed date is never silent (the Collide pencil-whip finding)", () => {
  it("renew WITHOUT proof: flag set, feed shows old → new and NO PROOF ATTACHED", async () => {
    const { renewComplianceItem } = await actions();
    const { logEvent } = await import("../notify");
    vi.mocked(logEvent).mockClear();
    const fake = fakeSupabase({
      saas_units: [{ id: "u1", name: "Rig 4", company_id: CO }],
      saas_compliance_items: [{ id: "item-1", title: "BOP pressure test", expiration_date: "2026-03-01", company_id: CO }],
      saas_alerts_sent: [],
      saas_attachments: [],
    });
    dbHolder.current = fake.client;
    await renewComplianceItem({ itemId: "item-1", expiration_date: "2027-03-01" });
    const upd = fake.writes.find((w) => w.table === "saas_compliance_items" && w.kind === "update");
    expect((upd?.payload as { renewed_without_proof: boolean }).renewed_without_proof).toBe(true);
    const msg = String(vi.mocked(logEvent).mock.calls.at(-1)?.[0]?.message);
    expect(msg).toContain("2026-03-01 → 2027-03-01");
    expect(msg).toContain("NO PROOF ATTACHED");
  });

  it("renew WITH proof photo: flag cleared, feed says proof attached", async () => {
    const { renewComplianceItem } = await actions();
    const { logEvent } = await import("../notify");
    vi.mocked(logEvent).mockClear();
    const fake = fakeSupabase({
      saas_units: [{ id: "u1", name: "Rig 4", company_id: CO }],
      saas_compliance_items: [{ id: "item-1", title: "BOP pressure test", expiration_date: "2026-03-01", company_id: CO }],
      saas_alerts_sent: [],
      saas_attachments: [],
    });
    dbHolder.current = fake.client;
    await renewComplianceItem({ itemId: "item-1", expiration_date: "2027-03-01", storage_path: `${CO}/compliance_item/item-1/x.jpg` });
    const upd = fake.writes.find((w) => w.table === "saas_compliance_items" && w.kind === "update");
    expect((upd?.payload as { renewed_without_proof: boolean }).renewed_without_proof).toBe(false);
    expect(String(vi.mocked(logEvent).mock.calls.at(-1)?.[0]?.message)).toContain("proof photo attached");
  });

  it("edit-form date change: flagged proofless + old → new logged", async () => {
    const { updateComplianceItem } = await actions();
    const { logEvent } = await import("../notify");
    vi.mocked(logEvent).mockClear();
    const fake = fakeSupabase({
      saas_compliance_items: [{ id: "item-1", title: "BOP pressure test", expiration_date: "2026-03-01", company_id: CO }],
      saas_alerts_sent: [],
      saas_item_customers: [],
      saas_customers: [],
    });
    dbHolder.current = fake.client;
    await updateComplianceItem(updateFd("2027-06-01"));
    const upd = fake.writes.find((w) => w.table === "saas_compliance_items" && w.kind === "update");
    expect((upd?.payload as { renewed_without_proof?: boolean }).renewed_without_proof).toBe(true);
    expect(String(vi.mocked(logEvent).mock.calls.at(-1)?.[0]?.message)).toContain("2026-03-01 → 2027-06-01");
  });
});

describe("unit mutations are single atomic statements — sequencing is Postgres's job", () => {
  it("updateUnit issues exactly ONE tenant-scoped UPDATE (no torn multi-write)", async () => {
    const { updateUnit } = await actions();
    const { writes } = freshDb();
    const fd = new FormData();
    fd.set("id", "u1");
    fd.set("name", "Rig 4 — renamed");
    fd.set("type", "truck");
    fd.set("identifier", "1482");
    await updateUnit(fd);
    const w = writes.filter((x) => x.table === "saas_units");
    expect(w).toHaveLength(1);
    expect(w[0].kind).toBe("update");
    expect(w[0].filters).toMatchObject({ id: "u1", company_id: CO });
    expect(w[0].payload).toMatchObject({ name: "Rig 4 — renamed", type: "truck", identifier: "1482" });
  });

  it("two back-to-back edits both land whole — neither corrupts the other", async () => {
    const { updateUnit } = await actions();
    const { writes } = freshDb();
    const a = new FormData();
    a.set("id", "u1"); a.set("name", "Rig 4"); a.set("type", "truck"); a.set("identifier", "1482");
    const b = new FormData();
    b.set("id", "u1"); b.set("name", "Rig 4"); b.set("type", "service_rig"); b.set("identifier", "1482");
    await Promise.all([updateUnit(a), updateUnit(b)]);
    const w = writes.filter((x) => x.table === "saas_units");
    expect(w).toHaveLength(2);
    for (const x of w) expect(Object.keys(x.payload as object).sort()).toEqual(["identifier", "name", "type"]);
    // HONEST LIMIT, stated in the test so nobody over-reads it: each edit is
    // one atomic UPDATE and Postgres row-locking sequences them — no torn or
    // corrupted rows, which is what's provable here. But the edit form sends
    // ALL its fields, so two humans editing the same unit at the same moment
    // resolve last-write-wins at the FORM level. True field-merge would need
    // per-field PATCH — a product decision, not a bug, at one-user-per-shop
    // scale. Real interleaving lives in Postgres and would need a live branch
    // database to exercise, not a unit test claiming "absolute" safety.
  });
});
