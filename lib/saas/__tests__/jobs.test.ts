import { describe, it, expect } from "vitest";
import { orderLines, jobState, afterState, buildLines, matchList, detailRows, firstName, sharedLines, type JobLine } from "../jobs";
import { SHARE_TOKEN, newShareToken } from "../job-share";

/**
 * A wireline job in SYNNR: a pipe recovery dispatch whose remarks say there is a
 * restriction in the hole and to take a smaller cutter. What the list looks like,
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
    const lines = buildLines({ list: shopList, callouts: [{ item: "Small cutters", qty: 2, why: "Tight spot in the hole" }] });
    expect(lines.map((l) => `${l.source}:${l.label}`)).toEqual([
      "list:Free point tool", "list:CCL", "list:Sinker bars", "list:Chemical cutters", "dispatch:Small cutters",
    ]);
    const cut = lines[4];
    expect(cut.critical).toBe(true);
    expect(cut.why).toBe("Tight spot in the hole");
    expect(cut.qty).toBe(2);
  });
  it("a callout the shop's list already has isn't added twice: that line turns critical and keeps the reason", () => {
    const lines = buildLines({ list: shopList, callouts: [{ item: "chemical cutters ", qty: 3, why: "Bring the small ones" }] });
    expect(lines).toHaveLength(4);
    expect(lines[3]).toMatchObject({ label: "Chemical cutters", critical: true, why: "Bring the small ones", qty: 3, source: "list" });
  });
  it("with no shop list yet, the dispatch's callouts are still the list", () => {
    const lines = buildLines({ list: [], callouts: [{ item: "Small cutters", qty: 0, why: "" }] });
    expect(lines).toEqual([{ label: "Small cutters", qty: 1, critical: true, why: null, source: "dispatch", phase: "load", sort: 0 }]);
  });
});

describe("the order a hand loads by", () => {
  it("puts what stops the job first, then keeps the list's own order", () => {
    const ordered = orderLines(buildLines({ list: shopList, callouts: [{ item: "Small cutters", qty: 2, why: "x" }] }));
    expect(ordered.map((l) => l.label)).toEqual(["Free point tool", "Small cutters", "CCL", "Sinker bars", "Chemical cutters"]);
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
      { label: "Small cutters", qty: 2, critical: true, on_at: null },
      { label: "Sinker bars", qty: 4, critical: false, on_at: null },
    ]);
    expect(s).toMatchObject({ ready: false, on: 1, total: 3, criticalMissing: 1 });
    expect(s.missing.map((l) => l.label)).toEqual(["Small cutters", "Sinker bars"]);
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
    const rows = detailRows({ truck: "WL-07", details: { tubing: "2-3/8", wellhead: "2-3/8 8 round", pressure_control: "Lubricator", casing: "", assets: ["Grease package"] } });
    expect(rows).toEqual([
      ["Truck", "WL-07"], ["Tubing", "2-3/8"], ["Wellhead", "2-3/8 8 round"], ["Pressure control", "Lubricator"], ["Also assigned", "Grease package"],
    ]);
  });
});

describe("the link sent to a customer", () => {
  const line = (over: Partial<JobLine>): JobLine => ({
    id: "l1", label: "CCL", qty: 1, critical: false, why: null, source: "list", phase: "load", sort: 0, on_by: null, on_at: null, photo_path: null, ...over,
  });
  const on = "2026-11-11T12:00:00.000Z";

  it("shows a first name only", () => {
    expect(firstName("Keegan  Ramirez")).toBe("Keegan");
    expect(firstName("cadencain")).toBe("cadencain");
    expect(firstName("  ")).toBe("Someone");
    expect(firstName(null)).toBe("Someone");
  });

  it("never carries where a photo is kept or a last name", () => {
    const out = sharedLines([
      line({ id: "a", label: "Weight bars", sort: 1, on_at: on, on_by: "Keegan Ramirez" }),
      line({ id: "b", label: "Jet cutter", sort: 2, critical: true, on_at: on, on_by: "Keegan Ramirez", photo_path: "co/jobs/j/b.jpg" }),
    ], (l) => `/p/TOKEN/photo/${l.id}`);
    const text = JSON.stringify(out);
    expect(text).not.toContain("co/jobs");
    expect(text).not.toContain("Ramirez");
    expect(Object.keys(out[0]).sort()).toEqual(["critical", "label", "on_at", "on_by", "photo", "qty", "why"]);
    // Critical first, the way the crew loads.
    expect(out.map((l) => l.label)).toEqual(["Jet cutter", "Weight bars"]);
    expect(out[0]).toMatchObject({ on_by: "Keegan", photo: "/p/TOKEN/photo/b" });
    expect(out[1].photo).toBeNull();
  });

  it("a piece that's off the truck shows no name and no photo", () => {
    const [l] = sharedLines([line({ critical: true, on_by: "Keegan", photo_path: "co/jobs/j/l1.jpg" })], () => "/p/TOKEN/photo/l1");
    expect(l).toMatchObject({ on_at: null, on_by: null, photo: null });
  });

  it("a photo with no address is left out, not shown broken", () => {
    const [l] = sharedLines([line({ critical: true, on_at: on, on_by: "Keegan", photo_path: "co/jobs/j/l1.jpg" })], () => undefined);
    expect(l.photo).toBeNull();
  });

  it("makes a link that can't be guessed and fits the database's rule", () => {
    const a = newShareToken(), b = newShareToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(24);
    expect(SHARE_TOKEN.test(a)).toBe(true);
    expect(SHARE_TOKEN.test("short")).toBe(false);
    expect(SHARE_TOKEN.test("a".repeat(23) + "/")).toBe(false);
  });
});

describe("after the job", () => {
  const on = "2026-11-12T03:14:00.000Z";
  const later = "2026-11-12T03:20:00.000Z";

  it("a job list's checks become their own lines: one each, always a photo", () => {
    const lines = buildLines({
      list: [
        { label: "Pressure control", qty: 1, critical: true, phase: "load" },
        { label: "BOP rams closed for travel", qty: 3, critical: false, phase: "after" },
        { label: "bop rams closed for travel", qty: 1, critical: false, phase: "after" },
      ],
      callouts: [],
    });
    expect(lines.map((l) => `${l.phase}:${l.label}:${l.qty}:${l.critical}`)).toEqual([
      "load:Pressure control:1:true",
      "after:BOP rams closed for travel:1:true",
    ]);
  });

  it("a dispatch callout never lands on a check, even with the same words", () => {
    const lines = buildLines({
      list: [{ label: "Lubricator", qty: 1, critical: false, phase: "after" }],
      callouts: [{ item: "Lubricator", qty: 2, why: "Bring the 3 inch lube" }],
    });
    expect(lines.map((l) => `${l.phase}:${l.source}:${l.qty}`)).toEqual(["after:list:1", "load:dispatch:2"]);
  });

  it("doesn't hold a truck back from READY", () => {
    const s = jobState([
      { label: "CCL", qty: 1, critical: false, on_at: on, phase: "load" },
      { label: "BOP rams closed for travel", qty: 1, critical: true, on_at: null, phase: "after" },
    ]);
    expect(s).toMatchObject({ ready: true, on: 1, total: 1, criticalMissing: 0 });
  });

  it("a job with only checks and nothing to load still can't be READY", () => {
    expect(jobState([{ label: "Package washed", qty: 1, critical: true, on_at: on, phase: "after" }]).ready).toBe(false);
  });

  it("counts what's proven, and says who proved the last one and when", () => {
    const a = afterState([
      { on_at: on, on_by: "Keegan", phase: "load" },
      { on_at: on, on_by: "Justin", phase: "after" },
      { on_at: later, on_by: "Keegan", phase: "after" },
      { on_at: null, on_by: null, phase: "after" },
    ]);
    expect(a).toMatchObject({ total: 3, proven: 2, left: 1, done: false, last_at: later, last_by: "Keegan" });
  });

  it("is done only when there are checks and every one has its photo", () => {
    expect(afterState([{ on_at: on, phase: "after" }]).done).toBe(true);
    expect(afterState([{ on_at: on, phase: "load" }])).toMatchObject({ total: 0, done: false, last_at: null });
    expect(afterState([]).done).toBe(false);
  });

  it("never goes out on the customer's link", () => {
    const out = sharedLines([
      { id: "a", label: "CCL", qty: 1, critical: false, why: null, source: "list", phase: "load", sort: 0, on_by: "Keegan", on_at: on, photo_path: null },
      { id: "b", label: "Package washed", qty: 1, critical: true, why: null, source: "list", phase: "after", sort: 1, on_by: "Keegan", on_at: on, photo_path: "co/jobs/j/b.jpg" },
    ], (l) => `/p/TOKEN/photo/${l.id}`);
    expect(out.map((l) => l.label)).toEqual(["CCL"]);
  });
});
