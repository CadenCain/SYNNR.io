import { describe, it, expect } from "vitest";
import { summaryText, damagedLine, type DaySummary } from "../morning-summary";
import { lateLine } from "../plans";

const base: DaySummary = { company: "Caprock", loadouts: 0, ready: 0, blocked: [], overrides: [], checkins: 0, unscanned: [], late: [], outTooLong: [], idle: [], damaged: [], noPaper: 0 };

describe("the managers' morning email", () => {
  it("a quiet yard gets no email", () => {
    expect(summaryText(base)).toBeNull();
    expect(summaryText({ ...base, idle: ["Lupe Cardenas"], noPaper: 3 })).toBeNull();
  });
  it("leads with trucks that weren't scanned out, and says so in the subject", () => {
    const m = summaryText({ ...base, loadouts: 2, ready: 1, blocked: ["CT-03: Out of test: BOP QB-4471"], checkins: 1,
      late: ["CT-01: Was planned to leave Tue 5:00 AM. Nobody has scanned it out."],
      unscanned: ["CT-04 came back from a job it was never scanned out for. Checked in by Freddy Carrasco."],
      idle: ["Lupe Cardenas"], noPaper: 2 })!;
    expect(m.subject).toBe("RollReady: 2 trucks not scanned out at Caprock");
    expect(m.body).toContain("2 load-outs (1 READY, 1 blocked), 1 check-in.");
    expect(m.body.indexOf("Not scanned out")).toBeLessThan(m.body.indexOf("Blocked at load-out"));
    expect(m.body).toContain("On the crew, nothing in RollReady this week:\n  Lupe Cardenas");
    expect(m.body).toContain("2 tests or truck papers have a date but no cert attached");
  });
  it("a normal day reads as a normal day", () => {
    expect(summaryText({ ...base, loadouts: 3, ready: 3, checkins: 2 })!.subject).toBe("RollReady: yesterday at Caprock");
  });
});

describe("planned to leave, never scanned out", () => {
  const plan = { at: "2026-11-03T20:00:00Z", leavesAt: "2026-11-04T11:00:00Z" };
  const t = () => "5:00 AM";
  const after = Date.parse("2026-11-04T12:00:00Z");
  it("before the leave time it's not late", () => {
    expect(lateLine(plan, null, Date.parse("2026-11-04T10:00:00Z"), t)).toBeNull();
  });
  it("past it with no load-out: nobody scanned it out", () => {
    expect(lateLine(plan, null, after, t)).toBe("Was planned to leave 5:00 AM. Nobody has scanned it out.");
    expect(lateLine(plan, { finished_at: "2026-11-01T11:00:00Z", rolled: true }, after, t)).toBe("Was planned to leave 5:00 AM. Nobody has scanned it out.");
  });
  it("past it, scanned but blocked: still NOT READY", () => {
    expect(lateLine(plan, { finished_at: "2026-11-04T10:30:00Z", rolled: false }, after, t)).toBe("Was planned to leave 5:00 AM. Still NOT READY.");
  });
  it("rolled: fine", () => {
    expect(lateLine(plan, { finished_at: "2026-11-04T10:30:00Z", rolled: true }, after, t)).toBeNull();
  });
  it("names whose job a damaged piece came back from", () => {
    const line = damagedLine({ name: "Quad BOP #11", serial: "QB-4411", red_tag: "rams bent",
      went_out: { truck: "CT-03", by: "Dale Wooten", at: "2026-11-02T10:00:00Z" } }, "Freddy Carrasco");
    expect(line).toBe("Quad BOP #11 QB-4411: rams bent. Went out on CT-03 Nov 2, loaded by Dale Wooten. Checked in by Freddy Carrasco.");
    expect(damagedLine({ name: "Silver Fox setting tool #2", serial: null, red_tag: "threads galled", went_out: { with: "Lupe Cardenas", at: "2026-11-01T15:00:00Z" } }, "Lupe Cardenas"))
      .toBe("Silver Fox setting tool #2: threads galled. Signed out to Lupe Cardenas Nov 1. Checked in by Lupe Cardenas.");
    const m = summaryText({ ...base, checkins: 1, damaged: [line], redressWaiting: 2 })!;
    expect(m.subject).toBe("RollReady: 1 piece came back damaged at Caprock");
    expect(m.body).toContain("Came back damaged:\n  Quad BOP #11 QB-4411: rams bent.");
    expect(m.body).toContain("2 tools are back from a run and waiting on redress.");
  });
  it("on Mondays, a crew that stopped using it is news (once a week, not every day)", () => {
    expect(summaryText({ ...base, idle: ["Lupe Cardenas", "Dale Wooten"] })).toBeNull();
    const m = summaryText({ ...base, idle: ["Lupe Cardenas", "Dale Wooten"], weekly: true })!;
    expect(m.subject).toBe("RollReady: nobody at Caprock used it this week");
    expect(m.body).toContain("On the crew, nothing in RollReady this week:\n  Lupe Cardenas\n  Dale Wooten");
  });
});

describe("the Monday subject", () => {
  it("one idle hand on a busy crew isn't 'nobody used it'", () => {
    const m = summaryText({ ...base, idle: ["Tony Reyes"], crew: 6, weekly: true })!;
    expect(m.subject).toBe("RollReady: 1 person hasn't used it this week at Caprock");
  });
  it("the whole crew idle is", () => {
    const m = summaryText({ ...base, idle: ["A B", "C D"], crew: 2, weekly: true })!;
    expect(m.subject).toBe("RollReady: nobody at Caprock used it this week");
  });
});
