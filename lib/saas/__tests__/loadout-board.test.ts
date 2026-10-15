import { describe, it, expect } from "vitest";
import { buildLoadOutTrucks } from "../loadout-board";
import type { UnitTile } from "../readiness";
import type { EquipRow } from "../equipment";

const unit = (id: string, state: UnitTile["state"]): UnitTile =>
  ({ id, name: id.toUpperCase(), type: "coil_tubing_unit", yardId: "y", yardName: "Yard", state, why: `${id} why`, crewWorst: null });
const row = (unitId: string | null, state: EquipRow["state"] = "ok") => ({ unitId, state } as EquipRow);

describe("the Load out board", () => {
  it("worst trucks first, and among equals the ones not loaded out today come first", () => {
    const { trucks } = buildLoadOutTrucks(
      [unit("ready1", "ready"), unit("red", "not_ready"), unit("ready2", "ready"), unit("due", "due_soon")],
      [],
      [{ unit_id: "ready1", finished_at: "2026-10-14T10:00:00Z", scanned_by: "Ray", scanned: 5, expected: 5 }],
      "2026-10-14",
    );
    expect(trucks.map((t) => t.t.id)).toEqual(["red", "due", "ready2", "ready1"]);
  });

  it("counts iron per truck, leaving out retired pieces", () => {
    const { trucks } = buildLoadOutTrucks([unit("ct3", "ready")], [row("ct3"), row("ct3"), row("ct3", "retired"), row(null)], [], "2026-10-14");
    expect(trucks[0].pieces).toBe(2);
  });

  it("words today's load-out and an older one differently, in yard time", () => {
    const scans = [
      { unit_id: "a", finished_at: "2026-10-14T10:40:00Z", scanned_by: "Ray Hinojosa", scanned: 5, expected: 5 },
      { unit_id: "b", finished_at: "2026-10-09T11:50:00Z", scanned_by: null, scanned: 4, expected: 5 },
    ];
    const { trucks, summary } = buildLoadOutTrucks([unit("a", "ready"), unit("b", "ready"), unit("c", "ready")], [], scans, "2026-10-14");
    const byId = Object.fromEntries(trucks.map((t) => [t.t.id, t]));
    expect(byId.a.doneToday).toBe(true);
    expect(byId.a.loadoutLine).toBe("Loaded out today 5:40 AM by Ray Hinojosa, 5 of 5 scanned");
    expect(byId.b.loadoutLine).toBe("Last load-out Oct 9, 4 of 5 scanned");
    expect(byId.c.loadoutLine).toBeNull();
    expect(summary).toBe("3 trucks. 1 loaded out today. None held up.");
  });
});
