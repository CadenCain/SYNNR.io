import { describe, it, expect } from "vitest";
import { judgeItem, isNoPaper, type JItem } from "../judge";
import { localToday } from "../status";
import { buildEquipment, stateLabel, type RawAsset, type RawItem } from "../equipment";
import { placeOf, PLACE_LABEL } from "../whereabouts";
import { searchPieces, type SearchablePiece } from "../search";
import { categoryLabel } from "../taxonomy";

/**
 * The yard runs on Central time. The server runs on UTC. A test that expires
 * "today" is good through the end of today in Odessa, not 6 PM.
 */

const item = (exp: string | null, extra: Partial<JItem> = {}): JItem =>
  ({ id: "t1", title: "BOP pressure test", expiration_date: exp, last_upload_id: "cert", reminder_days: 30, pending_until: null, ...extra });
const at = (iso: string) => localToday(new Date(iso));

describe("expires today vs tomorrow, around midnight UTC (Central time)", () => {
  it("6:30 PM Sunday in Odessa is already Monday in UTC, but the yard's day is still Sunday", () => {
    expect(at("2026-11-09T00:30:00Z")).toBe("2026-11-08");
  });
  it("11:30 PM Monday CST (05:30 UTC Tuesday): a test expiring Monday is still good, 'expires today'", () => {
    const today = at("2026-11-10T05:30:00Z");
    expect(today).toBe("2026-11-09");
    expect(judgeItem(item("2026-11-09"), today, today)).toEqual({ result: "due_soon", detail: "expires today" });
  });
  it("12:30 AM Tuesday CST: the same test is out of test, 1 day ago", () => {
    const today = at("2026-11-10T06:30:00Z");
    expect(today).toBe("2026-11-10");
    expect(judgeItem(item("2026-11-09"), today, today)).toEqual({ result: "expired", detail: "expired Nov 9, 2026 (1d ago)" });
  });
  it("a test expiring tomorrow reads 'in 1d' late tonight, and 'today' after midnight", () => {
    expect(judgeItem(item("2026-11-10"), at("2026-11-10T05:30:00Z"), at("2026-11-10T05:30:00Z")).detail).toBe("expires Nov 10, 2026 (in 1d)");
    expect(judgeItem(item("2026-11-10"), at("2026-11-10T06:30:00Z"), at("2026-11-10T06:30:00Z")).detail).toBe("expires today");
  });
  it("in summer (CDT, UTC-5) the day turns at 05:00 UTC", () => {
    expect(at("2026-07-15T04:59:00Z")).toBe("2026-07-14");
    expect(at("2026-07-15T05:01:00Z")).toBe("2026-07-15");
  });
  it("the night the clocks fall back (Nov 1 2026) still turns at local midnight", () => {
    expect(at("2026-11-01T04:59:00Z")).toBe("2026-10-31");
    expect(at("2026-11-01T05:01:00Z")).toBe("2026-11-01");
  });
  it("a Thursday job checked on Monday: good today, lapses Wednesday, so NOT good for the job", () => {
    const j = judgeItem(item("2026-11-11"), "2026-11-12", "2026-11-09");
    expect(j).toEqual({ result: "expired", detail: "expires Nov 11, 2026, before the Nov 12, 2026 job" });
  });
});

describe("no paper, pending, and how a piece reads on the equipment list", () => {
  const yards = [{ id: "ody", name: "Odessa Yard" }];
  const units = [{ id: "ct3", name: "CT-03", yard_id: "ody" }];
  const asset = (id: string, name: string, extra: Partial<RawAsset> = {}): RawAsset =>
    ({ id, name, category: "pressure_control", identifier: id.toUpperCase(), status: "in_service", yard_id: "ody", unit_id: "ct3", ...extra });
  const it_ = (id: string, parent: string, exp: string | null, extra: Partial<RawItem> = {}): RawItem =>
    ({ id, title: "Pressure test", expiration_date: exp, reminder_days: 30, pending_until: null, parent_id: parent, last_upload_id: "cert", ...extra });

  const list = buildEquipment({
    assets: [
      asset("ok", "Quad BOP stack #3"),
      asset("nopaper", "Lubricator #1"),
      asset("pending", "Lubricator #2"),
      asset("expired", "Plug valve 2\" #3", { category: "flow_iron" }),
      asset("due", "Injector head #1", { category: "equipment" }),
      asset("untracked", "Reel R-3", { category: "equipment" }),
      asset("tagged", "Plug valve 2\" #2", { category: "flow_iron", status: "out_of_service" }),
      asset("lost", "Plug valve 3\" #9", { category: "flow_iron", status: "missing", unit_id: null }),
      asset("redress", "Silver Fox setting tool #2", { category: "tool", unit_id: null, needs_redress_since: "2026-11-07T15:00:00Z" }),
      asset("scrap", "Old swivel", { status: "retired" }),
    ],
    units, yards,
    items: [
      it_("i1", "ok", "2027-03-01"),
      it_("i2", "nopaper", "2027-01-15", { last_upload_id: null }),
      it_("i3", "pending", "2026-11-05", { pending_until: "2026-11-12" }),
      it_("i4", "expired", "2026-11-08"),
      it_("i5", "due", "2026-11-20"),
      it_("i6", "tagged", "2027-03-01"),
    ],
  }, "2026-11-09");
  const row = (id: string) => list.rows.find((r) => r.id === id)!;

  it("every state, worst first, worded the way a yard reads it", () => {
    expect(stateLabel(row("ok"))).toBe("Current");
    expect(row("nopaper").next?.detail).toBe("no cert attached");
    expect(isNoPaper({ result: row("nopaper").next!.result, detail: row("nopaper").next!.detail })).toBe(true);
    expect(stateLabel(row("pending"))).toBe("Due soon");
    expect(row("pending").next?.detail).toBe("retested, cert on the way (counts through Nov 12, 2026)");
    expect(stateLabel(row("expired"))).toBe("Overdue");
    expect(stateLabel(row("due"))).toBe("Due soon");
    expect(stateLabel(row("untracked"))).toBe("No paper yet");
    expect(stateLabel(row("tagged"))).toBe("Red-tagged");
    expect(stateLabel(row("lost"))).toBe("Missing");
    expect(stateLabel(row("redress"))).toBe("Needs redress");
    expect(stateLabel(row("scrap"))).toBe("Retired");
  });

  it("a test good to Jan 2027 with no cert photo isn't called Overdue (it needs its paper, not a retest)", () => {
    // Red is right: it can't go out. "Overdue" (tile: "test or cert past due") sends the manager to book a retest.
    expect(row("nopaper").state).not.toBe("ok");
    expect(stateLabel(row("nopaper"))).not.toBe("Overdue");
  });

  it("counts leave retired iron out", () => {
    expect(list.counts).toEqual({ tracked: 9, overdue: 2, due: 2, down: 3, noPaper: 1, retired: 1 });
  });

  it("a red-tagged piece sitting on a truck is Red-tagged wherever it sits", () => {
    expect(placeOf({ status: "out_of_service", unit_id: "ct3", out_since: null }, Date.now())).toBe("red_tagged");
    expect(row("tagged").where).toBe("CT-03 · Odessa Yard");
  });
});

describe("a tool signed out to a person, on the equipment list and in search", () => {
  // signOutTools() clears unit_id and writes this note.
  const NOW = Date.parse("2026-11-09T14:00:00Z");
  const list = buildEquipment({
    assets: [
      { id: "sf3", name: "Silver Fox setting tool #3", category: "tool", identifier: "SF-3", status: "in_service", yard_id: "ody", unit_id: null,
        out_since: "2026-10-31T13:00:00Z", out_with_name: "Dale Wooten", last_seen_where: "signed out to Dale Wooten Oct 31 (Midland frac job)" },
      { id: "sf4", name: "Silver Fox setting tool #4", category: "tool", identifier: "SF-4", status: "in_service", yard_id: "ody", unit_id: null,
        out_since: "2026-11-08T13:00:00Z", out_with_name: "Lupe Cardenas", last_seen_where: "signed out to Lupe Cardenas Nov 8" },
      { id: "bop", name: "Quad BOP stack #3", category: "pressure_control", identifier: "QB-4471", status: "in_service", yard_id: "ody", unit_id: "ct3" },
    ],
    units: [{ id: "ct3", name: "CT-03", yard_id: "ody" }], yards: [{ id: "ody", name: "Odessa Yard" }], items: [],
  }, "2026-11-09");
  const searchable: SearchablePiece[] = list.rows.map((r) => ({
    ...r, serial: r.identifier, typeLabel: categoryLabel(r.category), nextTitle: r.next?.title ?? null,
    place: placeOf({ status: r.status, unit_id: r.unitId, out_since: r.outSince }, NOW, 7),
  }));
  const ids = (q: string) => searchPieces(searchable, q).map((p) => p.id);

  it("reads 'With Dale Wooten', keeps the job note, and counts as out too long after 7 days", () => {
    const sf3 = list.rows.find((r) => r.id === "sf3")!;
    expect(sf3.where).toBe("With Dale Wooten");
    expect(sf3.note).toBe("Midland frac job");
    expect(sf3.outWith).toBe("Dale Wooten");
    expect(PLACE_LABEL[searchable.find((p) => p.id === "sf3")!.place]).toBe("Out too long");
    expect(PLACE_LABEL[searchable.find((p) => p.id === "sf4")!.place]).toBe("Out on job");
    expect(list.rows.find((r) => r.id === "sf4")!.note).toBeNull();
  });

  it("search finds it by who has it, the job, the serial, and 'out' / 'out too long'", () => {
    expect(ids("dale")).toEqual(["sf3"]);
    expect(ids("midland")).toEqual(["sf3"]);
    expect(ids("SF 3")).toEqual(["sf3"]);
    expect(ids("out too long")).toEqual(["sf3"]);
    expect(ids("out")).toEqual(["sf3", "sf4"]);
    expect(ids("silver fox out")).toEqual(["sf3", "sf4"]);
    expect(ids("on truck")).toEqual(["bop"]);
    expect(ids("in yard")).toEqual([]);
  });
});
