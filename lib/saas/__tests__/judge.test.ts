import { describe, it, expect } from "vitest";
import { judgeUnit, judgeItem, type UnitScope } from "../judge";

/**
 * The readiness rules, pinned. Every screen (tiles, the readiness check, the
 * public proof link) runs these, so a truck can't read two ways.
 */

const TODAY = "2026-09-28";
const empty = (): UnitScope => ({ unitItems: [], assets: [], assetItems: [], crew: [], crewItems: [] });
const item = (id: string, title: string, exp: string | null, extra: Partial<{ pending_until: string; parent_id: string; reminder_days: number }> = {}) =>
  ({ id, title, expiration_date: exp, ...extra });

describe("judgeItem", () => {
  it("expires later than the window → ok", () => {
    expect(judgeItem(item("a", "DOT", "2027-02-01"), TODAY, TODAY).result).toBe("ok");
  });
  it("expires inside its reminder window → due soon", () => {
    expect(judgeItem(item("a", "DOT", "2026-10-10"), TODAY, TODAY).result).toBe("due_soon");
  });
  it("expires today → still good today (due soon, not expired)", () => {
    expect(judgeItem(item("a", "DOT", TODAY), TODAY, TODAY).result).toBe("due_soon");
  });
  it("expired yesterday → expired, with how long ago", () => {
    const j = judgeItem(item("a", "DOT", "2026-09-27"), TODAY, TODAY);
    expect(j.result).toBe("expired");
    expect(j.detail).toContain("1d ago");
  });
  it("no date → missing", () => {
    expect(judgeItem(item("a", "DOT", null), TODAY, TODAY).result).toBe("missing");
  });
  it("fine today but lapses before a future job → expired for that job", () => {
    const j = judgeItem(item("a", "DOT", "2026-10-02"), "2026-10-05", TODAY);
    expect(j.result).toBe("expired");
    expect(j.detail).toContain("before the 2026-10-05 job");
  });
  it("cert on the way covers a lapsed item while the window is open", () => {
    expect(judgeItem(item("a", "BOP", "2026-09-20", { pending_until: "2026-10-03" }), TODAY, TODAY).result).toBe("pending");
  });
  it("cert on the way does NOT cover a job after its window closes", () => {
    expect(judgeItem(item("a", "BOP", "2026-09-20", { pending_until: "2026-10-03" }), "2026-10-04", TODAY).result).toBe("expired");
  });
  it("a closed window is red again on its own, no cron needed", () => {
    expect(judgeItem(item("a", "BOP", "2026-09-20", { pending_until: "2026-09-27" }), TODAY, TODAY).result).toBe("expired");
  });
  it("pending never masks a current cert's due-soon", () => {
    expect(judgeItem(item("a", "BOP", "2026-10-01", { pending_until: "2026-10-03" }), TODAY, TODAY).result).toBe("due_soon");
  });
});

describe("judgeUnit — what makes a truck NOT READY", () => {
  it("nothing tracked → not set up, never green", () => {
    expect(judgeUnit(empty(), TODAY, TODAY).verdict).toBe("not_setup");
  });
  it("gear in service with no paper at all → still not set up", () => {
    const s = empty();
    s.assets = [{ id: "g1", name: "BOP #3", status: "in_service" }];
    expect(judgeUnit(s, TODAY, TODAY).verdict).toBe("not_setup");
  });
  it("RED-TAGGED gear fails the truck even with no paper and no gear list", () => {
    const s = empty();
    s.assets = [{ id: "g1", name: "BOP #3", status: "out_of_service" }];
    const j = judgeUnit(s, TODAY, TODAY);
    expect(j.verdict).toBe("not_ready");
    expect(j.why).toBe("BOP #3: red-tagged");
  });
  it("gear flagged missing fails the truck", () => {
    const s = empty();
    s.unitItems = [item("d", "Annual DOT", "2027-05-01")];
    s.assets = [{ id: "g1", name: "Lubricator #2", status: "missing" }];
    expect(judgeUnit(s, TODAY, TODAY).verdict).toBe("not_ready");
  });
  it("an assigned hand with NO cards fails the truck (tile and check agree now)", () => {
    const s = empty();
    s.unitItems = [item("d", "Annual DOT", "2027-05-01")];
    s.crew = [{ id: "c1", name: "Braden" }];
    const j = judgeUnit(s, TODAY, TODAY);
    expect(j.verdict).toBe("not_ready");
    expect(j.why).toBe("Braden: no cards on file");
  });
  it("a hand's expired card fails the truck", () => {
    const s = empty();
    s.unitItems = [item("d", "Annual DOT", "2027-05-01")];
    s.crew = [{ id: "c1", name: "Kevin Odom" }];
    s.crewItems = [item("h", "H2S Clear", "2026-09-27", { parent_id: "c1" })];
    const j = judgeUnit(s, TODAY, TODAY);
    expect(j.verdict).toBe("not_ready");
    expect(j.why).toBe("H2S Clear (Kevin Odom): expired 1d ago");
  });
  it("gear's cert is labeled with the gear", () => {
    const s = empty();
    s.assets = [{ id: "g1", name: "Quad BOP stack #3", status: "in_service" }];
    s.assetItems = [item("b", "BOP pressure test", "2026-09-23", { parent_id: "g1" })];
    expect(judgeUnit(s, TODAY, TODAY).why).toBe("BOP pressure test (Quad BOP stack #3): expired 5d ago");
  });
  it("the worst reason wins the tile: gear, then oldest lapse, then no date", () => {
    const s = empty();
    s.unitItems = [item("n", "Registration", null), item("x", "DOT sticker", "2026-09-01"), item("y", "Annual DOT", "2026-09-20")];
    expect(judgeUnit(s, TODAY, TODAY).why).toBe("DOT sticker: expired 27d ago");
    s.assets = [{ id: "g", name: "Crane line", status: "missing" }];
    expect(judgeUnit(s, TODAY, TODAY).why).toBe("Crane line: missing");
  });
  it("cert on the way → due soon (yellow), named, not blocked", () => {
    const s = empty();
    s.unitItems = [item("b", "BOP pressure test", "2026-09-23", { pending_until: "2026-10-02" })];
    const j = judgeUnit(s, TODAY, TODAY);
    expect(j.verdict).toBe("due_soon");
    expect(j.pending).toHaveLength(1);
    expect(j.why).toBe("BOP pressure test: cert on the way");
  });
  it("everything current → ready", () => {
    const s = empty();
    s.unitItems = [item("d", "Annual DOT", "2027-05-01")];
    s.crew = [{ id: "c1", name: "Kevin" }];
    s.crewItems = [item("h", "H2S", "2027-05-01", { parent_id: "c1" })];
    expect(judgeUnit(s, TODAY, TODAY).verdict).toBe("ready");
  });
  it("a job date is honored: a cert lapsing before it fails the check", () => {
    const s = empty();
    s.unitItems = [item("d", "Annual DOT", "2026-10-02")];
    expect(judgeUnit(s, TODAY, TODAY).verdict).toBe("due_soon");
    expect(judgeUnit(s, "2026-10-05", TODAY, { soonDays: 21 }).verdict).toBe("not_ready");
  });
});
