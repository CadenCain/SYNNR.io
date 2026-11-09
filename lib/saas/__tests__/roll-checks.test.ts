import { describe, it, expect } from "vitest";
import { cleanChecks, requiredChecks, missingChecks } from "../roll-checks";
import { loadoutVerdict } from "../loadout-lines";
import { buildEquipment, stateLabel } from "../equipment";

describe("roll checks", () => {
  it("keeps a manager's list short and clean", () => {
    expect(cleanChecks(["  BOP rams closed   for travel ", "", "bop rams closed for travel", "Everything strapped and padded", "Lubricator capped", "One too many"]))
      .toEqual(["BOP rams closed for travel", "Everything strapped and padded", "Lubricator capped"]);
    expect(cleanChecks(["x".repeat(90)])[0]).toHaveLength(60);
  });
  it("asks for the kit's and the job's checks once each", () => {
    expect(requiredChecks(["BOP rams closed for travel"], ["Everything strapped and padded", "BOP rams closed for travel"], null))
      .toEqual(["BOP rams closed for travel", "Everything strapped and padded"]);
  });
  it("finds the ones the hand didn't tap", () => {
    expect(missingChecks(["BOP rams closed for travel", "Everything strapped and padded"], ["bop rams closed for travel"]))
      .toEqual(["Everything strapped and padded"]);
  });
});

describe("needs redress", () => {
  it("blocks the truck by name", () => {
    const v = loadoutVerdict({ lines: [], bad: [{ name: "Silver Fox setting tool #2", serial: "SF-2", why: "needs_redress" }], cantFind: [], truckPaper: [], scanned: 1 });
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toEqual(["Needs redress: Silver Fox setting tool #2 SF-2"]);
  });
  it("reads as down (red) on every list until it's redressed, and says why", () => {
    const list = buildEquipment({
      assets: [
        { id: "a", name: "Silver Fox setting tool #2", category: "tools", identifier: "SF-2", status: "in_service", yard_id: "y", unit_id: null, needs_redress_since: "2026-11-07T12:00:00Z" },
        { id: "b", name: "Silver Fox setting tool #3", category: "tools", identifier: "SF-3", status: "in_service", yard_id: "y", unit_id: null, out_since: "2026-11-01T12:00:00Z", out_with_name: "Dale Wooten" },
      ],
      units: [], yards: [{ id: "y", name: "Odessa Yard" }], items: [],
    }, "2026-11-08");
    const a = list.rows.find((r) => r.id === "a")!;
    const b = list.rows.find((r) => r.id === "b")!;
    expect(a.state).toBe("down");
    expect(stateLabel(a)).toBe("Needs redress");
    expect(b.where).toBe("With Dale Wooten");
    expect(b.outWith).toBe("Dale Wooten");
  });
});
