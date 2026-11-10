import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildLoadOutTrucks, planShortByTruck, type LoadoutScanRow } from "../loadout-board";
import type { EquipRow } from "../equipment";
import type { UnitTile } from "../readiness";

/**
 * Round two for the board, the truck page, the piece page and Tools out:
 * board times on each yard's own clock, the next job's yard shortages on the
 * board, and the page-level fixes other areas handed over.
 */

const unit = (id: string, yardId: string, state: UnitTile["state"] = "ready"): UnitTile =>
  ({ id, name: id.toUpperCase(), type: "coil_tubing_unit", yardId, yardName: yardId, state, why: `${id} why`, crewWorst: null });
const scan = (unit_id: string, finished_at: string, extra: Partial<LoadoutScanRow> = {}): LoadoutScanRow =>
  ({ id: `lo-${unit_id}`, unit_id, finished_at, scanned_by: "Ray Hinojosa", verdict: "ready", reasons: [], pieces: [], not_scanned: [], ...extra });
const row = (id: string, name: string, extra: Partial<EquipRow> = {}): EquipRow => ({
  id, name, category: "pressure_control", identifier: null, status: "active", yardId: "ody", unitId: null, unitName: null,
  where: "Odessa Yard", yardOf: "ody", note: null, scannedAt: null, outSince: null, outWith: null, needsRedress: false,
  next: { id: `c-${id}`, title: "Pressure test", exp: "2027-06-01", result: "ok", detail: "good to Jun 1, 2027" }, itemCount: 1, state: "ok", ...extra,
});
const src = (p: string) => readFileSync(path.resolve(__dirname, "../../..", p), "utf8");

describe("board times on each yard's clock", () => {
  // 12:10 UTC on Nov 10 is 6:10 AM in Odessa (Central) and 5:10 AM in Hobbs (Mountain).
  const TODAY = "2026-11-10";
  const NOW = Date.parse("2026-11-10T18:00:00Z");
  const zones = new Map([["hobbs", "America/Denver"], ["ody", "America/Chicago"]]);

  it("a Hobbs truck reads Mountain time, and each time says its zone when the board mixes zones", () => {
    const { trucks } = buildLoadOutTrucks([unit("ct1", "ody"), unit("h1", "hobbs")], [],
      [scan("ct1", "2026-11-10T12:10:00Z"), scan("h1", "2026-11-10T12:10:00Z")], new Set(), TODAY, new Map(), { now: NOW, zones });
    expect(trucks.find((t) => t.t.id === "h1")!.loadoutLine).toBe("Out on a job since today 5:10 AM MT by Ray Hinojosa");
    expect(trucks.find((t) => t.t.id === "ct1")!.loadoutLine).toBe("Out on a job since today 6:10 AM CT by Ray Hinojosa");
  });

  it("one zone on the board: its own time, no zone tag", () => {
    const { trucks } = buildLoadOutTrucks([unit("h1", "hobbs")], [], [scan("h1", "2026-11-10T12:10:00Z")], new Set(), TODAY, new Map(), { now: NOW, zones });
    expect(trucks[0].loadoutLine).toBe("Out on a job since today 5:10 AM by Ray Hinojosa");
  });

  it("with no zones passed (or before migration 0035), it reads Central as it always has", () => {
    const { trucks } = buildLoadOutTrucks([unit("h1", "hobbs")], [], [scan("h1", "2026-11-10T12:10:00Z")], new Set(), TODAY, new Map(), { now: NOW });
    expect(trucks[0].loadoutLine).toBe("Out on a job since today 6:10 AM by Ray Hinojosa");
    const empty = buildLoadOutTrucks([unit("h1", "hobbs")], [], [scan("h1", "2026-11-10T12:10:00Z")], new Set(), TODAY, new Map(), { now: NOW, zones: new Map() });
    expect(empty.trucks[0].loadoutLine).toBe(trucks[0].loadoutLine);
  });

  it("a Hobbs load-out at 10:30 PM is today's in Hobbs, even after midnight in Central", () => {
    // 06:45 UTC Nov 11: 12:45 AM Nov 11 in Central, 11:45 PM Nov 10 in Mountain.
    const now = Date.parse("2026-11-11T06:45:00Z");
    const blocked = scan("h1", "2026-11-11T05:30:00Z", { verdict: "not_ready", reasons: ["Swivel SW-1180: out of test"] });
    const { trucks } = buildLoadOutTrucks([unit("h1", "hobbs")], [], [blocked], new Set(), "2026-11-11", new Map(), { now, zones });
    expect(trucks[0].status).toBe("blocked");
    expect(trucks[0].doneToday).toBe(true);
    expect(trucks[0].loadoutLine).toBe("Blocked at load-out 10:30 PM by Ray Hinojosa");
  });
});

describe("the next job's yard shortages on the board", () => {
  const NOW = Date.parse("2026-11-10T18:00:00Z");
  const units = [{ id: "ct8", yardId: "ody" }];
  const pkgs = new Map([["pkg-pd", { name: "Pump-down package", lines: [{ label: "Lubricator", qty: 1 }] }]]);
  const plan = (extra: Partial<{ leavesAt: string | null; lines: { label: string; qty: number }[]; packageIds: string[] }> = {}) =>
    new Map([["ct8", { packageIds: ["pkg-pd"], lines: [], leavesAt: "2026-11-11T11:00:00Z", ...extra }]]);

  it("names the line and the yard's bad piece that would have fit", () => {
    const rows = [row("lb3", "Lubricator", { identifier: "LB-3", status: "out_of_service", state: "down" })];
    const short = planShortByTruck(plan(), pkgs, new Map(), rows, units, NOW);
    expect(short.get("ct8")).toBe("Next job: Pump-down package needs Lubricator. No good one on the truck or free in the yard. The yard's Lubricator LB-3: red-tagged. The load-out will block without it.");
  });

  it("says out of test, not a status word, for iron past its test", () => {
    const rows = [row("lb3", "Lubricator", { identifier: "LB-3", state: "overdue", next: { id: "c", title: "Pressure test", exp: "2026-10-01", result: "expired", detail: "expired 40d ago" } })];
    expect(planShortByTruck(plan(), pkgs, new Map(), rows, units, NOW).get("ct8")).toContain("The yard's Lubricator LB-3: out of test.");
  });

  it("is quiet when a good one sits free in the yard, or is already on the truck", () => {
    expect(planShortByTruck(plan(), pkgs, new Map(), [row("lb1", "Lubricator")], units, NOW).size).toBe(0);
    expect(planShortByTruck(plan(), pkgs, new Map(), [row("lb1", "Lubricator", { unitId: "ct8", yardId: null })], units, NOW).size).toBe(0);
  });

  it("doesn't count a good one signed out to a hand, out on a job, or in another yard", () => {
    for (const r of [
      row("lb1", "Lubricator", { outWith: "Ray Hinojosa", outSince: "2026-11-09T12:00:00Z" }),
      row("lb1", "Lubricator", { outSince: "2026-11-09T12:00:00Z" }),
      row("lb1", "Lubricator", { yardId: "hobbs", yardOf: "hobbs" }),
    ]) expect(planShortByTruck(plan(), pkgs, new Map(), [r], units, NOW).has("ct8")).toBe(true);
  });

  it("leaves out an old plan: it no longer locks the load-out", () => {
    expect(planShortByTruck(plan({ leavesAt: "2026-11-08T11:00:00Z" }), pkgs, new Map(), [], units, NOW).size).toBe(0);
  });

  it("leaves kit lines to the kit note, and counts the rest", () => {
    const kits = new Map([["ct8", [{ label: "Swivel", qty: 1 }]]]);
    const short = planShortByTruck(plan({ lines: [{ label: "Pup joint", qty: 2 }] }), pkgs, kits, [], units, NOW).get("ct8")!;
    expect(short).toMatch(/^Next job: Pump-down package needs Lubricator\./);
    expect(short).toMatch(/ 1 more short too\.$/);
    expect(short).not.toContain("Swivel");
  });

  it("the truck's own iron fills the kit first, so the package needs a second one", () => {
    const kits = new Map([["ct8", [{ label: "Lubricator", qty: 1 }]]]);
    const rows = [row("lb1", "Lubricator", { unitId: "ct8", yardId: null })];
    expect(planShortByTruck(plan(), pkgs, kits, rows, units, NOW).has("ct8")).toBe(true);
  });
});

describe("page fixes handed over", () => {
  it("the truck page sends a missing or red-tagged piece to its own page first", () => {
    const s = src("app/app/units/[unitId]/page.tsx");
    expect(s).toMatch(/assets\.find\(isDown\) \?\? assets\.find\(\(x\) => x\.needs_redress_since\)/);
    expect(s).toContain('"Open the piece"');
  });

  it("the piece page's Mark it redressed says which run it was", () => {
    expect(src("app/app/assets/[assetId]/page.tsx")).toContain("<RedressedButton assetId={a.id} since={a.needs_redress_since} />");
  });

  it("the week's override tile counts load-out overrides only", () => {
    const s = src("app/app/page.tsx");
    expect(s).not.toContain("not_ready_override");
    expect(s).not.toContain("oldOverrides");
  });

  it("the board counts whoever loaded a truck that's still out as active", () => {
    const s = src("app/app/page.tsx");
    expect(s).toContain("loadedOut.values()");
    expect(s).toContain('out_since, out_with_name").eq("company_id", company.id).not("out_since", "is", null)');
  });

  it("Tools out links the whole sheet as a spreadsheet", () => {
    expect(src("app/app/signout/page.tsx")).toContain('href="/api/saas/export/tools-out" download');
  });
});
