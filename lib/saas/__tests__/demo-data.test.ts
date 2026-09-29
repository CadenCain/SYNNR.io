import { describe, it, expect } from "vitest";
import { DEMO_UNITS, DEMO_YARD_IRON, DEMO_MOVES, DEMO_ALERTS_SENT, type DemoAsset } from "../demo-data";

/**
 * The demo yard's contract: the equipment list and the trucks a visitor
 * lands on are never all green, never accidentally red, and never go stale
 * (offsets, not dates). If someone edits the dataset and breaks the spread,
 * this fails before a visitor ever sees a wrong screen.
 */

const LEAD = 30; // default reminder window: items inside it show "due soon"
const allIron: DemoAsset[] = [...DEMO_UNITS.flatMap((u) => u.assets ?? []), ...DEMO_YARD_IRON];

/** Same order of checks as lib/saas/equipment.ts. */
function state(a: DemoAsset): string {
  if (a.status === "retired") return "retired";
  if (a.status === "out_of_service" || a.status === "missing") return "down";
  const exps = (a.items ?? []).map((i) => i.exp);
  if (exps.length === 0) return "no_paper";
  if (exps.some((e) => e === null || e < 0)) return "overdue";
  if (exps.some((e) => (e as number) <= LEAD)) return "due";
  return "ok";
}

describe("the equipment list: a working yard, not all green", () => {
  it("2 overdue · 2 down · 4 due soon · 2 with no paper · 1 retired", () => {
    const count = (s: string) => allIron.filter((a) => state(a) === s).length;
    expect(count("overdue")).toBe(2);
    expect(count("down")).toBe(2);
    expect(count("due")).toBe(4);
    expect(count("no_paper")).toBe(2);
    expect(count("retired")).toBe(1);
    expect(allIron.length).toBeGreaterThanOrEqual(60);
  });

  it("every piece can be found by its key (serial, or name when untested)", () => {
    const keys = allIron.map((a) => a.identifier ?? a.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(DEMO_UNITS.map((u) => u.name)).size).toBe(DEMO_UNITS.length);
  });

  it("moves and alert receipts point at real iron and real trucks", () => {
    const serials = new Set(allIron.map((a) => a.identifier).filter(Boolean));
    const units = new Set(DEMO_UNITS.map((u) => u.key));
    for (const m of DEMO_MOVES) {
      expect(serials.has(m.serial), m.serial).toBe(true);
      for (const k of [m.from, m.to]) expect(k === "yard" || units.has(k), k).toBe(true);
    }
    for (const a of DEMO_ALERTS_SENT) {
      if (a.serial) expect(serials.has(a.serial), a.serial).toBe(true);
      else expect(units.has(a.unitKey!), a.unitKey).toBe(true);
    }
  });

  it("a piece that ends a move history on a truck is actually on that truck", () => {
    const last = new Map<string, string>();
    for (const m of [...DEMO_MOVES].sort((a, b) => b.daysAgo - a.daysAgo)) last.set(m.serial, m.to);
    for (const [serial, to] of last) {
      const onUnit = DEMO_UNITS.find((u) => (u.assets ?? []).some((a) => a.identifier === serial));
      expect(onUnit?.key ?? "yard", serial).toBe(to);
    }
  });
});

describe("the trucks: 10 ready · 3 not ready · 3 due soon", () => {
  const exps = (u: (typeof DEMO_UNITS)[number]) => [
    ...(u.items ?? []).map((i) => i.exp),
    ...(u.assets ?? []).flatMap((a) => (a.items ?? []).map((i) => i.exp)),
  ];

  it("the spread", () => {
    const count = (s: string) => DEMO_UNITS.filter((u) => u.expect === s).length;
    expect(count("ready")).toBe(10);
    expect(count("not_ready")).toBe(3);
    expect(count("due_soon")).toBe(3);
  });

  it("the three red reasons", () => {
    const ct3 = DEMO_UNITS.find((u) => u.key === "ct3")!;
    const bop = ct3.assets!.find((a) => a.identifier === "QB-4471")!;
    expect(bop.items![0].exp).toBe(-6); // BOP test expired 6 days ago
    const p2 = DEMO_UNITS.find((u) => u.key === "p2")!;
    expect(p2.items!.find((i) => i.title === "Annual DOT inspection")!.exp).toBeLessThan(0);
    const ct6 = DEMO_UNITS.find((u) => u.key === "ct6")!;
    expect(ct6.assets!.find((a) => a.identifier === "PV-2231")!.status).toBe("out_of_service"); // failed UT
  });

  it("due-soon trucks have something inside 30 days and nothing expired or down", () => {
    for (const u of DEMO_UNITS.filter((x) => x.expect === "due_soon")) {
      const e = exps(u).filter((x): x is number => x !== null);
      expect(e.some((x) => x > 0 && x <= LEAD), u.name).toBe(true);
      expect(e.every((x) => x > 0), u.name).toBe(true);
      for (const a of u.assets ?? []) expect(a.status ?? "in_service", `${u.name}/${a.name}`).toBe("in_service");
    }
  });

  it("ready trucks are clean: nothing expired, due, undated, or down", () => {
    for (const u of DEMO_UNITS.filter((x) => x.expect === "ready")) {
      expect(exps(u).every((e) => e !== null && e > LEAD), u.name).toBe(true);
      for (const a of u.assets ?? []) expect(a.status ?? "in_service", `${u.name}/${a.name}`).toBe("in_service");
    }
  });
});
