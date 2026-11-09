import { describe, it, expect } from "vitest";
import { buildToolStocks, lowLine, lateOutLines, isLow, countOf, plural } from "../tool-stock";
import { summaryText, type DaySummary } from "../morning-summary";

/**
 * Setting tools a vendor stocks, by count: Odessa runs Silver Fox, Levelland
 * runs Baker 20s. A busy stretch in November 2026, Central time.
 */
const NOW = new Date("2026-11-13T12:00:00-06:00");
const yards = [{ id: "ody", name: "Odessa Yard" }, { id: "lev", name: "Levelland Yard" }];
const stocks = [
  { id: "sf", name: "Silver Fox setting tool", vendor: "Silver Fox", yard_id: "ody", ready: 1, used: 5, low_at: 2 },
  { id: "bk", name: "Baker 20", vendor: null, yard_id: "lev", ready: 6, used: 0, low_at: 2 },
];
const outs = [
  { id: "o1", stock_id: "sf", out_user: "dale", out_name: "Dale Wooten", qty: 1, job_note: "plug set, Pecos County", out_at: "2026-11-04T06:15:00-06:00" },
  { id: "o2", stock_id: "sf", out_user: "lupe", out_name: "Lupe Cardenas", qty: 2, job_note: null, out_at: "2026-11-13T05:10:00-06:00" },
];
const log = [
  // Last month's runs don't count toward November's bill.
  { stock_id: "sf", kind: "back", used_delta: 2, note: null, created_at: "2026-10-30T17:00:00-05:00" },
  { stock_id: "sf", kind: "back", used_delta: 1, note: null, created_at: "2026-11-03T17:00:00-06:00" },
  { stock_id: "sf", kind: "back", used_delta: 3, note: null, created_at: "2026-11-11T17:00:00-06:00" },
  // A "didn't run" back puts nothing on the used pile.
  { stock_id: "sf", kind: "back", used_delta: 0, note: null, created_at: "2026-11-12T17:00:00-06:00" },
  { stock_id: "sf", kind: "vendor", used_delta: -6, note: "Vendor picked up 6 used, dropped off 8 ready", created_at: "2026-10-26T10:30:00-05:00" },
  { stock_id: "sf", kind: "vendor", used_delta: -4, note: "Vendor picked up 4 used, dropped off 4 ready", created_at: "2026-10-01T10:30:00-05:00" },
];

describe("setting tools by count", () => {
  const list = buildToolStocks(stocks, yards, outs, log, NOW);
  const sf = list.find((s) => s.id === "sf")!;
  const bk = list.find((s) => s.id === "bk")!;

  it("counts what's out with people, by person", () => {
    expect(sf.out).toBe(3);
    expect(sf.outs.map((o) => o.name)).toEqual(["Dale Wooten", "Lupe Cardenas"]);
    expect(bk.out).toBe(0);
  });

  it("counts this month's runs in yard time: what the vendor will bill for", () => {
    expect(sf.ranThisMonth).toBe(4);
  });

  it("keeps the vendor's last swap", () => {
    expect(sf.lastVendor?.note).toBe("Vendor picked up 6 used, dropped off 8 ready");
    expect(bk.lastVendor).toBeNull();
  });

  it("sorts by yard, then name", () => {
    expect(list.map((s) => s.yardName)).toEqual(["Levelland Yard", "Odessa Yard"]);
  });

  it("is low at or under the manager's number, and says who to call", () => {
    expect(isLow(sf)).toBe(true);
    expect(isLow(bk)).toBe(false);
    expect(lowLine(sf)).toBe("Odessa Yard, Silver Fox setting tools: 1 ready, 5 used waiting on pickup, 3 out. Call Silver Fox.");
    expect(lowLine({ ...bk, ready: 0 })).toBe("Levelland Yard, Baker 20s: none ready.");
  });

  it("names who has had some out too long", () => {
    expect(lateOutLines(list, 7, NOW.getTime())).toEqual(["With Dale Wooten: 1 Silver Fox setting tool, out 9 days"]);
  });

  it("plurals read right", () => {
    expect(countOf(1, "Baker 20")).toBe("1 Baker 20");
    expect(countOf(3, "Baker 20")).toBe("3 Baker 20s");
    expect(plural("Silver Fox setting tools")).toBe("Silver Fox setting tools");
  });

  it("a low shelf is news on its own: the morning email goes out and says so", () => {
    const s: DaySummary = { company: "Caprock", loadouts: 0, ready: 0, blocked: [], overrides: [], checkins: 0, unscanned: [], late: [],
      outTooLong: [], damaged: [], idle: [], noPaper: 0, toolsLow: [lowLine(sf)] };
    const m = summaryText(s)!;
    expect(m.subject).toBe("RollReady: setting tools running low at Caprock");
    expect(m.body).toContain("Setting tools running low:\n  Odessa Yard, Silver Fox setting tools: 1 ready");
    expect(summaryText({ ...s, toolsLow: [] })).toBeNull();
  });
});
