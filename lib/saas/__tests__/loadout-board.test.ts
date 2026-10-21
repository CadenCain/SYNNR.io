import { describe, it, expect } from "vitest";
import { buildLoadOutTrucks, weekNumbers, kitShortByTruck, type LoadoutScanRow } from "../loadout-board";
import type { UnitTile } from "../readiness";
import type { EquipRow } from "../equipment";

const unit = (id: string, state: UnitTile["state"]): UnitTile =>
  ({ id, name: id.toUpperCase(), type: "coil_tubing_unit", yardId: "y", yardName: "Yard", state, why: `${id} why`, crewWorst: null });
const row = (unitId: string | null, state: EquipRow["state"] = "ok") => ({ unitId, state } as EquipRow);
const scan = (unit_id: string, finished_at: string, extra: Partial<LoadoutScanRow> = {}): LoadoutScanRow =>
  ({ id: `lo-${unit_id}-${finished_at}`, unit_id, finished_at, scanned_by: "Ray Hinojosa", verdict: "ready", reasons: [], pieces: [], not_scanned: [], ...extra });

const TODAY = "2026-10-14";
const NOW = Date.parse("2026-10-14T18:00:00Z");
const o = (returns: { unit_id: string; finished_at: string; returned_by?: string }[] = [], alertDays = 7) => ({ returns, now: NOW, alertDays });

describe("the Load out board", () => {
  it("blocked first, then ready to load, then loaded out", () => {
    const { trucks, counts } = buildLoadOutTrucks(
      [unit("ready1", "ready"), unit("red", "not_ready"), unit("ready2", "ready"), unit("due", "due_soon")],
      [],
      [scan("ready1", "2026-10-14T10:00:00Z")],
      new Set(),
      TODAY, new Map(), o(),
    );
    expect(trucks.map((t) => [t.t.id, t.status])).toEqual([["red", "blocked"], ["due", "ready"], ["ready2", "ready"], ["ready1", "out"]]);
    expect(counts).toEqual({ ready: 2, blocked: 1, out: 1, outTooLong: 0 });
  });

  it("today's NOT READY load-out blocks the truck with its first reason, even if the records look fine", () => {
    const { trucks } = buildLoadOutTrucks([unit("a", "ready")], [], [
      scan("a", "2026-10-14T10:55:00Z", { scanned_by: "Dale Wooten", verdict: "not_ready", reasons: ["Short: Lubricator, 0 of 1 scanned", "Can't find: Plug valve PV-1"] }),
    ], new Set(), TODAY);
    expect(trucks[0].status).toBe("blocked");
    expect(trucks[0].why).toBe("Short: Lubricator, 0 of 1 scanned (and 1 more)");
    expect(trucks[0].loadoutLine).toBe("Blocked at load-out 5:55 AM by Dale Wooten");
    expect(trucks[0].loadoutId).toBe("lo-a-2026-10-14T10:55:00Z");
  });

  it("a manager's override moves a blocked truck to loaded out, and says so", () => {
    const s = scan("a", "2026-10-14T10:55:00Z", { verdict: "not_ready", reasons: ["Short: Lubricator, 0 of 1 scanned"] });
    const { trucks } = buildLoadOutTrucks([unit("a", "ready")], [], [s], new Set([s.id]), TODAY, new Map(), o());
    expect(trucks[0].status).toBe("out");
    expect(trucks[0].overridden).toBe(true);
    expect(trucks[0].loadoutLine).toBe("Out on a manager's override since today 5:55 AM by Ray Hinojosa");
  });

  it("only the latest load-out counts: a re-scan that comes back READY clears the block", () => {
    const { trucks } = buildLoadOutTrucks([unit("a", "ready")], [], [
      scan("a", "2026-10-14T10:55:00Z", { verdict: "not_ready", reasons: ["Short: Lubricator, 0 of 1 scanned"] }),
      scan("a", "2026-10-14T11:20:00Z"),
    ], new Set(), TODAY, new Map(), o());
    expect(trucks[0].status).toBe("out");
    expect(trucks[0].loadoutLine).toBe("Out on a job since today 6:20 AM by Ray Hinojosa");
  });

  it("an old record with no stored answer reads NOT READY if a bad piece went on", () => {
    const { trucks } = buildLoadOutTrucks([unit("a", "ready")], [], [
      scan("a", "2026-10-14T10:55:00Z", { verdict: null, reasons: null as never, pieces: [{ asset_id: "x", name: "BOP", serial: "Q1", how: "nfc", red: true }] }),
    ], new Set(), TODAY);
    expect(trucks[0].status).toBe("blocked");
    expect(trucks[0].why).toBe("Out of test or red-tagged: BOP Q1");
  });

  it("a truck that rolled stays out until it's checked back in", () => {
    const rolled = scan("b", "2026-10-11T11:50:00Z", { scanned_by: null });
    const stillOut = buildLoadOutTrucks([unit("b", "ready")], [], [rolled], new Set(), TODAY, new Map(), o());
    expect(stillOut.trucks[0].status).toBe("out");
    expect(stillOut.trucks[0].loadoutLine).toBe("Out on a job since Oct 11 (3 days)");
    expect(stillOut.trucks[0].outTooLong).toBe(false);
    const back = buildLoadOutTrucks([unit("b", "ready")], [], [rolled], new Set(), TODAY, new Map(), o([{ unit_id: "b", finished_at: "2026-10-13T20:00:00Z" }]));
    expect(back.trucks[0].status).toBe("ready");
    expect(back.trucks[0].loadoutLine).toBe("Checked in Oct 13");
    expect(back.trucks[0].stillOut).toBeNull();
  });

  it("checked in today: says who, starts a fresh load-out, and names iron that didn't come back", () => {
    const rolled = scan("b", "2026-10-14T09:00:00Z");
    const reel = { unitId: "b", state: "ok", name: "Reel R-5", outSince: "2026-10-14T09:00:00Z" } as EquipRow;
    const { trucks } = buildLoadOutTrucks([unit("b", "ready")], [row("b"), reel], [rolled], new Set(), TODAY, new Map(),
      o([{ unit_id: "b", finished_at: "2026-10-14T16:30:00Z", returned_by: "Freddy Carrasco" }]));
    expect(trucks[0].status).toBe("ready");
    expect(trucks[0].loadoutLine).toBe("Checked in today 11:30 AM by Freddy Carrasco");
    expect(trucks[0].stillOut).toBe("Still out on the job: Reel R-5");
    expect(trucks[0].doneToday).toBe(false);
    expect(trucks[0].loadoutId).toBeNull();
  });

  it("out past the limit is flagged red and sorts first among the trucks out", () => {
    const { trucks, counts, summary } = buildLoadOutTrucks([unit("x", "ready"), unit("y", "ready")], [],
      [scan("x", "2026-10-05T11:00:00Z"), scan("y", "2026-10-13T11:00:00Z")], new Set(), TODAY, new Map(), o([], 7));
    expect(trucks.map((t) => [t.t.id, t.outTooLong])).toEqual([["x", true], ["y", false]]);
    expect(trucks[0].why).toBe("Out 9 days. Check it in, or find out where it is.");
    expect(counts).toEqual({ ready: 0, blocked: 0, out: 2, outTooLong: 1 });
    expect(summary).toBe("2 trucks. 2 out on jobs (1 out too long). Nothing blocked.");
  });

  it("a NOT READY load-out nobody overrode never left", () => {
    const { trucks } = buildLoadOutTrucks([unit("z", "ready")], [], [scan("z", "2026-10-12T11:00:00Z", { verdict: "not_ready", reasons: ["Short: BOP, 0 of 1 scanned"] })], new Set(), TODAY, new Map(), o());
    expect(trucks[0].status).toBe("ready");
  });

  it("a due-soon test still shows on a truck in the yard", () => {
    const { trucks } = buildLoadOutTrucks([unit("c", "due_soon")], [], [], new Set(), TODAY, new Map(), o());
    expect(trucks[0].why).toBe("c why");
    expect(trucks[0].whyTone).toBe("amber");
  });

  it("counts iron per truck, leaving out retired pieces", () => {
    const { trucks } = buildLoadOutTrucks([unit("ct3", "ready")], [row("ct3"), row("ct3"), row("ct3", "retired"), row(null)], [], new Set(), TODAY);
    expect(trucks[0].pieces).toBe(2);
  });
});

describe("kit short, on the board", () => {
  const piece = (id: string, unitId: string, name: string) => ({ id, unitId, name, identifier: id, state: "ok" } as EquipRow);
  it("a ready truck missing a kit piece says what to bring, and still reads Ready to load", () => {
    const kits = new Map([["a", [{ label: "Lubricator", qty: 1 }, { label: "2in 1502 pup joint", qty: 2 }, { label: "BOP stack", qty: 1 }]]]);
    const rows = [piece("p1", "a", "2in 1502 pup joint, 10 ft"), piece("b1", "a", "BOP stack #2")];
    const short = kitShortByTruck(kits, rows);
    expect(short.get("a")).toBe("Kit short: Lubricator, 2in 1502 pup joint (1 of 2 on it). The load-out will block without it.");
    const { trucks } = buildLoadOutTrucks([unit("a", "ready")], rows, [], new Set(), TODAY, short);
    expect(trucks[0].status).toBe("ready");
    expect(trucks[0].whyTone).toBe("amber");
    expect(trucks[0].why).toBe(short.get("a"));
  });
  it("says nothing when the kit is covered", () => {
    expect(kitShortByTruck(new Map([["a", [{ label: "BOP stack", qty: 1 }]]]), [piece("b1", "a", "BOP stack #2")]).size).toBe(0);
  });
});

describe("the week's numbers", () => {
  it("counts load-outs, bad pieces caught (red when scanned on), and overrides", () => {
    expect(weekNumbers([
      { pieces: [{ red: true }, { red: false }, {}] },
      { pieces: [{ red: true }, { red: true }] },
      { pieces: null },
    ], 1)).toEqual({ loadouts: 3, caught: 3, overrides: 1 });
  });
});
