import { describe, it, expect } from "vitest";
import { DEMO_UNITS, DEMO_CREW } from "../demo-data";

/**
 * The demo yard's contract: the board a Collide visitor lands on is never
 * all green, never accidentally red, and never goes stale (offsets, not
 * dates). If someone edits the dataset and breaks the spread, this fails
 * before a visitor ever sees a wrong board.
 */

const rolling = DEMO_UNITS.filter((u) => u.type !== "shop");
const crewByKey = new Map(DEMO_CREW.map((c) => [c.key, c]));
const LEAD = 30; // default alert window: items inside it show "due soon"

const unitItemExps = (u: (typeof DEMO_UNITS)[number]) => [
  ...(u.items ?? []).map((i) => i.exp),
  ...(u.assets ?? []).flatMap((a) => (a.items ?? []).map((i) => i.exp)),
];

describe("the seeded spread — mid-week, not all green", () => {
  it("14 ready · 3 not ready · 3 due soon (plus the shop)", () => {
    const count = (s: string) => rolling.filter((u) => u.expect === s).length;
    expect(rolling).toHaveLength(20);
    expect(count("ready")).toBe(14);
    expect(count("not_ready")).toBe(3);
    expect(count("due_soon")).toBe(3);
    expect(DEMO_UNITS.find((u) => u.type === "shop")).toBeTruthy();
  });

  it("the three red reasons are exactly the spec's", () => {
    const ct3 = DEMO_UNITS.find((u) => u.key === "ct3")!;
    const bopTest = ct3.assets!.flatMap((a) => a.items ?? []).find((i) => i.title === "BOP pressure test");
    expect(bopTest?.exp).toBe(-6); // BOP test expired 6 days ago

    const p2 = DEMO_UNITS.find((u) => u.key === "p2")!;
    expect(p2.items!.find((i) => i.title === "Annual DOT inspection")!.exp).toBeLessThan(0); // DOT lapsed

    const ct6 = DEMO_UNITS.find((u) => u.key === "ct6")!;
    expect(ct6.crew).toContain("c7");
    const h2s = crewByKey.get("c7")!.cards.find((c) => c.title === "H2S Clear");
    expect(h2s?.exp).toBe(-1); // operator's H2S expired yesterday
  });

  it("every due-soon unit has an item inside the 30-day window (and nothing expired)", () => {
    for (const u of rolling.filter((x) => x.expect === "due_soon")) {
      const exps = unitItemExps(u).filter((e): e is number => e !== null);
      expect(exps.some((e) => e > 0 && e <= LEAD), u.name).toBe(true);
      expect(exps.every((e) => e > 0), u.name).toBe(true);
    }
  });

  it("ready units are clean: no expired, nothing inside the window, no undated items", () => {
    for (const u of rolling.filter((x) => x.expect === "ready")) {
      const exps = unitItemExps(u);
      expect(exps.every((e) => e !== null && e > LEAD), u.name).toBe(true);
      for (const a of u.assets ?? []) expect(a.status ?? "in_service", `${u.name}/${a.name}`).toBe("in_service");
    }
  });
});

describe("the crew-card invariant — expiring cards never flip a ready unit", () => {
  it("every assigned crew key exists", () => {
    for (const u of DEMO_UNITS) for (const ck of u.crew ?? []) {
      expect(crewByKey.has(ck), `${u.name} → ${ck}`).toBe(true);
    }
  });

  it("crew assigned to READY units have every card comfortably out (> 30d)", () => {
    for (const u of rolling.filter((x) => x.expect === "ready")) {
      for (const ck of u.crew ?? []) {
        const c = crewByKey.get(ck)!;
        expect(c.cards.every((card) => card.exp !== null && card.exp > LEAD), `${u.name} → ${c.name}`).toBe(true);
      }
    }
  });

  it("the bench holds the expiring cards (alert-window data without board damage)", () => {
    const assigned = new Set(DEMO_UNITS.flatMap((u) => u.crew ?? []));
    const benchWithExpiring = DEMO_CREW.filter((c) => !assigned.has(c.key) && c.cards.some((x) => x.exp !== null && x.exp > 0 && x.exp <= LEAD));
    expect(benchWithExpiring.length).toBeGreaterThanOrEqual(3);
  });

  it("45 hands on the roster", () => {
    expect(DEMO_CREW).toHaveLength(45);
    expect(new Set(DEMO_CREW.map((c) => c.name)).size).toBe(45); // names unique (seeder maps by name)
    expect(new Set(DEMO_UNITS.map((u) => u.name)).size).toBe(DEMO_UNITS.length);
  });
});
