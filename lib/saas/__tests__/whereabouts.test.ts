import { describe, it, expect } from "vitest";
import { placeOf, daysOut, truckOut, PLACE_LABEL } from "../whereabouts";

const NOW = Date.parse("2026-10-20T12:00:00Z");

describe("where a piece is", () => {
  it("red tags and missing win over everything", () => {
    expect(placeOf({ status: "out_of_service", unit_id: "t", out_since: "2026-10-01T00:00:00Z" }, NOW)).toBe("red_tagged");
    expect(placeOf({ status: "missing", unit_id: null }, NOW)).toBe("missing");
  });
  it("out on a job until checked in, out too long past the limit", () => {
    expect(placeOf({ status: "in_service", unit_id: "t", out_since: "2026-10-18T12:00:00Z" }, NOW, 7)).toBe("out");
    expect(placeOf({ status: "in_service", unit_id: "t", out_since: "2026-10-13T12:00:00Z" }, NOW, 7)).toBe("out_too_long");
    expect(placeOf({ status: "in_service", unit_id: "t", out_since: "2026-10-18T12:00:00Z" }, NOW, 2)).toBe("out_too_long");
  });
  it("back in the yard: on a truck or on a rack", () => {
    expect(placeOf({ status: "in_service", unit_id: "t", out_since: null }, NOW)).toBe("on_truck");
    expect(placeOf({ status: "in_service", unit_id: null }, NOW)).toBe("in_yard");
    expect(PLACE_LABEL.out_too_long).toBe("Out too long");
  });
  it("counts whole days", () => {
    expect(daysOut("2026-10-20T01:00:00Z", NOW)).toBe(0);
    expect(daysOut("2026-10-18T11:00:00Z", NOW)).toBe(2);
    expect(daysOut(null, NOW)).toBe(0);
  });
});

describe("is a truck out", () => {
  const lo = (id: string, unit_id: string, finished_at: string, rolled = true) => ({ id, unit_id, finished_at, rolled });
  it("out from a load-out that rolled until a check-in after it", () => {
    const m = truckOut([lo("a", "ct1", "2026-10-15T10:00:00Z")], []);
    expect(m.get("ct1")).toEqual({ since: "2026-10-15T10:00:00Z", loadoutId: "a" });
    expect(truckOut([lo("a", "ct1", "2026-10-15T10:00:00Z")], [{ unit_id: "ct1", finished_at: "2026-10-16T10:00:00Z" }]).size).toBe(0);
  });
  it("a check-in before the latest load-out doesn't count", () => {
    const m = truckOut([lo("a", "ct1", "2026-10-15T10:00:00Z"), lo("b", "ct1", "2026-10-18T10:00:00Z")], [{ unit_id: "ct1", finished_at: "2026-10-16T10:00:00Z" }]);
    expect(m.get("ct1")?.loadoutId).toBe("b");
  });
  it("a blocked load-out nobody overrode never left", () => {
    expect(truckOut([lo("a", "ct1", "2026-10-15T10:00:00Z", false)], []).size).toBe(0);
  });
});

import { outDigest } from "../out-alerts";
describe("the out-too-long email", () => {
  it("one line per truck, loose pieces by name", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    const text = outDigest([
      { id: "a", name: "Quad BOP stack #8", identifier: "QB-4476", unit_id: "ct8", out_since: "2026-10-11T12:00:00Z" },
      { id: "b", name: "Reel R-8", identifier: "R-8", unit_id: "ct8", out_since: "2026-10-11T12:00:00Z" },
      { id: "c", name: "Spare lubricator #3", identifier: "LB-813", unit_id: null, out_since: "2026-10-08T12:00:00Z" },
    ], new Map([["ct8", "CT-08"]]), now);
    expect(text).toBe("CT-08: 2 pieces, out 9 days · Spare lubricator #3 LB-813, out 12 days");
  });
});
