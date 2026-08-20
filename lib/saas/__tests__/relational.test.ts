import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase } from "./fake-supabase";

/**
 * Relational pressure tests — the REAL production functions run against an
 * in-memory Supabase stand-in. Three contracts a customer's money rides on:
 *
 *   1. Frankenstein fleet: a healthy parent unit with one bad child asset
 *      reads NOT READY — child failures always break the parent's rollout.
 *   2. The alert sweep batches per recipient (one email each, all due items
 *      aggregated) and logs exactly one ledger row per item — and a second
 *      sweep sends NOTHING (dedup holds).
 *   3. Unassigning a hand breaks only the join row; the worker and their
 *      cards survive untouched. (Hard DELETE purging its own certs is the
 *      documented, admin-gated opposite — not tested here as a defect.)
 */

// sendEmail/sendSms/smsConfigured are the only outbound edges of the sweep —
// stubbed so the sweep's routing logic runs for real with no network.
vi.mock("../notify", () => ({
  sendEmail: vi.fn(async () => true),
  sendSms: vi.fn(async () => true),
  smsConfigured: () => false,
  notifyEvent: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
}));

import { sendEmail, sendSms } from "../notify";
import { computeDispatchCheck } from "../dispatch-check";
import { sweepAlerts } from "../alerts";

const CO = "co-1";
const FUTURE = "2099-01-01";
const PAST = "2020-01-01";

// ── 1. Frankenstein fleet ───────────────────────────────────────────────────

function fleetTables(assetCertExpiration: string | null, assetStatus = "in_service") {
  return {
    saas_units: [{ id: "u1", name: "Rig 4", type: "truck", yard_id: "y1", company_id: CO }],
    saas_loadout_templates: [],
    saas_assets: [{ id: "a1", name: "Quad BOP #11", status: assetStatus, unit_id: "u1", company_id: CO }],
    saas_unit_crew: [],
    saas_crew_members: [],
    saas_compliance_items_with_status: [
      // parent unit's own paper: perfectly healthy
      { id: "c-unit", title: "Annual DOT inspection", expiration_date: FUTURE, status: "valid", parent_type: "unit", parent_id: "u1", company_id: CO },
      // child asset's paper: the variable under test
      { id: "c-asset", title: "BOP pressure test", expiration_date: assetCertExpiration, status: assetCertExpiration === null ? "none" : assetCertExpiration < "2026" ? "expired" : "valid", parent_type: "asset", parent_id: "a1", company_id: CO },
    ],
  };
}

describe("Frankenstein fleet — a bad child asset breaks the healthy parent", () => {
  it("control: healthy unit + healthy asset → READY", async () => {
    const { client } = fakeSupabase(fleetTables(FUTURE));
    const r = await computeDispatchCheck(client as unknown as SupabaseClient, CO, "u1");
    expect(r?.verdict).toBe("ready");
  });

  it("EXPIRED child asset cert flips the parent to NOT READY, named in failures", async () => {
    const { client } = fakeSupabase(fleetTables(PAST));
    const r = await computeDispatchCheck(client as unknown as SupabaseClient, CO, "u1");
    expect(r?.verdict).toBe("not_ready");
    expect(r?.failures.join(" | ")).toContain("BOP pressure test");
    expect(r?.failures.join(" | ")).toContain("Quad BOP #11");
  });

  it("child asset cert with NO DATE also breaks the parent (unverifiable = failing)", async () => {
    const { client } = fakeSupabase(fleetTables(null));
    const r = await computeDispatchCheck(client as unknown as SupabaseClient, CO, "u1");
    expect(r?.verdict).toBe("not_ready");
    expect(r?.failures.join(" | ")).toContain("no expiration on file");
  });

  it("child asset FLAGGED MISSING breaks the parent even with all paper valid", async () => {
    const { client } = fakeSupabase(fleetTables(FUTURE, "missing"));
    const r = await computeDispatchCheck(client as unknown as SupabaseClient, CO, "u1");
    expect(r?.verdict).toBe("not_ready");
    expect(r?.failures.join(" | ")).toContain("flagged missing");
  });
});

// ── 2. Alert sweep: aggregation + ledger dedup ──────────────────────────────

function sweepTables(alreadySent: string[]) {
  return {
    saas_companies: [{ id: CO, name: "Spy Coil Tubing", subscription_status: "active", comped: false }],
    saas_notification_settings: [],
    saas_compliance_items: [
      { id: "i1", title: "BOP pressure test", kind: "test", expiration_date: PAST, parent_type: "unit", parent_id: "u1", company_id: CO },
      { id: "i2", title: "H2S Clear", kind: "cert", expiration_date: PAST, parent_type: "crew", parent_id: "w1", company_id: CO },
      { id: "i3", title: "DOT sticker", kind: "inspection", expiration_date: null, parent_type: "unit", parent_id: "u1", company_id: CO },
    ],
    saas_alerts_sent: alreadySent.map((id) => ({ compliance_item_id: id, company_id: CO })),
    saas_units: [{ id: "u1", yard_id: "y1", company_id: CO }],
    saas_assets: [],
    saas_alert_recipients: [
      { name: "Caden", email: "caden@example.com", phone: null, channels: ["email"], yard_ids: null, company_id: CO },
      { name: "Ryan", email: "ryan@example.com", phone: null, channels: ["email"], yard_ids: null, company_id: CO },
    ],
  };
}

describe("alert sweep — one payload per recipient, one ledger row per item", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear();
    vi.mocked(sendSms).mockClear();
  });

  it("3 simultaneous expirations, 2 recipients → exactly 2 emails, each carrying all 3 items", async () => {
    const { client, writes } = fakeSupabase(sweepTables([]));
    const res = await sweepAlerts(client as unknown as SupabaseClient);

    expect(res.items_due).toBe(3);
    expect(res.errors).toEqual([]);
    // one aggregated email per recipient — never one email per item
    expect(vi.mocked(sendEmail)).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(sendEmail).mock.calls) {
      const body = String(call[2]);
      expect(body).toContain("BOP pressure test");
      expect(body).toContain("H2S Clear");
      expect(body).toContain("DOT sticker");
    }
    expect(vi.mocked(sendSms)).not.toHaveBeenCalled(); // smsConfigured() false → never attempted

    // the ledger gets exactly one row per ITEM (not per item×recipient)
    const ledger = writes.filter((w) => w.table === "saas_alerts_sent" && w.kind === "insert");
    expect(ledger).toHaveLength(1);
    const rows = ledger[0].payload as { compliance_item_id: string; channel: string }[];
    expect(rows.map((r) => r.compliance_item_id).sort()).toEqual(["i1", "i2", "i3"]);
    expect(res.items_logged).toBe(3);

    // the sweep NEVER edits or deletes ledger rows — append-only by
    // construction here, and enforced at the DB by the 0006 no-update trigger
    expect(writes.filter((w) => w.table === "saas_alerts_sent" && w.kind !== "insert")).toHaveLength(0);
  });

  it("re-arm (clearAlertLog) deletes ONLY the renewed item's rows, tenant-scoped", async () => {
    const { client, writes } = fakeSupabase(sweepTables(["i1", "i2", "i3"]));
    dbHolder.current = client;
    const { clearAlertLog } = await import("../alert-log");
    await clearAlertLog(CO, ["i1", "i2"]);
    const deletes = writes.filter((w) => w.kind === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].table).toBe("saas_alerts_sent");
    expect(deletes[0].filters).toMatchObject({ company_id: CO, compliance_item_id: ["i1", "i2"] });
    // never a blanket wipe, never another table
    expect(writes.some((w) => w.kind === "delete" && w.table !== "saas_alerts_sent")).toBe(false);
  });

  it("second sweep over the same state sends NOTHING — the ledger dedupes", async () => {
    const { client, writes } = fakeSupabase(sweepTables(["i1", "i2", "i3"]));
    const res = await sweepAlerts(client as unknown as SupabaseClient);

    expect(res.items_due).toBe(0);
    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled();
    expect(writes.filter((w) => w.table === "saas_alerts_sent" && w.kind === "insert")).toHaveLength(0);
  });
});

// ── 3. Relational assignment safety ─────────────────────────────────────────

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

describe("unassigning a hand breaks the join row and NOTHING else", () => {
  it("delete lands on saas_unit_crew only; the worker and their cards survive", async () => {
    const { client, writes } = fakeSupabase({
      saas_unit_crew: [{ unit_id: "u1", crew_member_id: "w1", company_id: CO }],
      saas_crew_members: [{ id: "w1", name: "Dale Wooten", company_id: CO }],
      saas_compliance_items: [{ id: "c1", parent_type: "crew", parent_id: "w1", company_id: CO }],
    });
    dbHolder.current = client;
    const { unassignCrewFromUnit } = await import("../../../app/app/_actions");

    const fd = new FormData();
    fd.set("unit_id", "u1");
    fd.set("crew_member_id", "w1");
    await unassignCrewFromUnit(fd);

    const deletes = writes.filter((w) => w.kind === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].table).toBe("saas_unit_crew");
    expect(deletes[0].filters).toMatchObject({ unit_id: "u1", crew_member_id: "w1", company_id: CO });
    // the master records were never touched
    expect(writes.some((w) => w.table === "saas_crew_members")).toBe(false);
    expect(writes.some((w) => w.table === "saas_compliance_items")).toBe(false);
  });
});
