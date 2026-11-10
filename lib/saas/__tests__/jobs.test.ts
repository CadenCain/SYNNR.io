import { describe, it, expect } from "vitest";
import { orderLines, jobState, buildLines, matchList, detailRows } from "../jobs";

/**
 * A wireline job in SYNNR: a pipe recovery dispatch whose remarks say "1.93
 * restriction in hole, take undersized cutters". What the list looks like,
 * what order a hand loads it in, and when the truck is READY.
 */
const shopList = [
  { label: "Free point tool", qty: 1, critical: true },
  { label: "CCL", qty: 1, critical: false },
  { label: "Sinker bars", qty: 4, critical: false },
  { label: "Chemical cutters", qty: 2, critical: false },
];

describe("the list for a new job", () => {
  it("is the shop's list, then what the dispatch itself called out, marked critical with its reason", () => {
    const lines = buildLines({ list: shopList, callouts: [{ item: "Undersized cutters", qty: 2, why: "1.93 in. restriction in hole" }] });
    expect(lines.map((l) => `${l.source}:${l.label}`)).toEqual([
      "list:Free point tool", "list:CCL", "list:Sinker bars", "list:Chemical cutters", "dispatch:Undersized cutters",
    ]);
    const cut = lines[4];
    expect(cut.critical).toBe(true);
    expect(cut.why).toBe("1.93 in. restriction in hole");
    expect(cut.qty).toBe(2);
  });
  it("a callout the shop's list already has isn't added twice: that line turns critical and keeps the reason", () => {
    const lines = buildLines({ list: shopList, callouts: [{ item: "chemical cutters ", qty: 3, why: "Take undersized cutters" }] });
    expect(lines).toHaveLength(4);
    expect(lines[3]).toMatchObject({ label: "Chemical cutters", critical: true, why: "Take undersized cutters", qty: 3, source: "list" });
  });
  it("with no shop list yet, the dispatch's callouts are still the list", () => {
    const lines = buildLines({ list: [], callouts: [{ item: "Undersized cutters", qty: 0, why: "" }] });
    expect(lines).toEqual([{ label: "Undersized cutters", qty: 1, critical: true, why: null, source: "dispatch", sort: 0 }]);
  });
});

describe("the order a hand loads by", () => {
  it("puts what stops the job first, then keeps the list's own order", () => {
    const ordered = orderLines(buildLines({ list: shopList, callouts: [{ item: "Undersized cutters", qty: 2, why: "x" }] }));
    expect(ordered.map((l) => l.label)).toEqual(["Free point tool", "Undersized cutters", "CCL", "Sinker bars", "Chemical cutters"]);
  });
});

describe("READY or NOT READY", () => {
  const on = "2026-11-11T12:00:00.000Z";
  it("everything on the truck: READY", () => {
    expect(jobState([{ label: "CCL", qty: 1, critical: false, on_at: on }])).toMatchObject({ ready: true, on: 1, total: 1, criticalMissing: 0 });
  });
  it("one critical piece still off: NOT READY, and it says how many are critical", () => {
    const s = jobState([
      { label: "CCL", qty: 1, critical: false, on_at: on },
      { label: "Undersized cutters", qty: 2, critical: true, on_at: null },
      { label: "Sinker bars", qty: 4, critical: false, on_at: null },
    ]);
    expect(s).toMatchObject({ ready: false, on: 1, total: 3, criticalMissing: 1 });
    expect(s.missing.map((l) => l.label)).toEqual(["Undersized cutters", "Sinker bars"]);
  });
  it("a job with no list can't be READY", () => {
    expect(jobState([]).ready).toBe(false);
  });
});

describe("finding the shop's list for a job", () => {
  const lists = [{ name: "Pipe recovery" }, { name: "Set a packer" }, { name: "Plug and cement" }];
  it("matches the same name however it's typed", () => {
    expect(matchList(lists, "  PIPE  Recovery ")?.name).toBe("Pipe recovery");
  });
  it("matches when one name is inside the other", () => {
    expect(matchList(lists, "Pipe recovery, free point and cut")?.name).toBe("Pipe recovery");
  });
  it("says there isn't one rather than guessing", () => {
    expect(matchList(lists, "Bond log")).toBeNull();
    expect(matchList(lists, "")).toBeNull();
  });
});

describe("the job facts shown", () => {
  it("are job facts in dispatch order, and blanks are left out", () => {
    const rows = detailRows({ truck: "HU044", details: { tubing: "2-7/8", wellhead: "2-7/8 8 round", pressure_control: "Pack off and lubricator", casing: "", assets: ["Grease package GT-183 5K"] } });
    expect(rows).toEqual([
      ["Truck", "HU044"], ["Tubing", "2-7/8"], ["Wellhead", "2-7/8 8 round"], ["Pressure control", "Pack off and lubricator"], ["Also assigned", "Grease package GT-183 5K"],
    ]);
  });
});
