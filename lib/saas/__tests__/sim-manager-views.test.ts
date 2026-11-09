import { describe, it, expect } from "vitest";
import { summaryText, damagedLine, type DaySummary } from "../morning-summary";
import { lateLine } from "../plans";
import { searchPieces, parseQuery, type SearchablePiece } from "../search";
import { buildEquipment, stateLabel } from "../equipment";
import { placeOf } from "../whereabouts";
import { categoryLabel } from "../taxonomy";

/** What a yard manager reads: the morning email, late trucks, and search. */

const quiet: DaySummary = { company: "Renegade Wireline", loadouts: 0, ready: 0, blocked: [], overrides: [], checkins: 0, unscanned: [], late: [], outTooLong: [], idle: [], damaged: [], noPaper: 0 };
// The morning email's clock (morning-summary.ts timeText), spaces normalized.
const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" }).replace(/\s/g, " ");

describe("the morning email over a week", () => {
  it("Sunday: only idle crew and standing paperwork: no email", () => {
    expect(summaryText({ ...quiet, idle: ["Lupe Cardenas", "Freddy Carrasco"], noPaper: 4, redressWaiting: 1 })).toBeNull();
  });

  it("Tuesday: a damaged BOP came back: email, damage in the subject, date in yard time", () => {
    // Loaded out 9 PM Central on Nov 2 = 03:00 UTC Nov 3.
    const line = damagedLine({ name: "Quad BOP stack #11", serial: "QB-4411", red_tag: "rams bent", went_out: { truck: "CT-03", by: "Dale Wooten", at: "2026-11-03T03:00:00Z" } }, "Freddy Carrasco");
    expect(line).toBe("Quad BOP stack #11 QB-4411: rams bent. Went out on CT-03 Nov 2, loaded by Dale Wooten. Checked in by Freddy Carrasco.");
    const m = summaryText({ ...quiet, checkins: 1, damaged: [line], idle: ["Lupe Cardenas"] })!;
    expect(m.subject).toBe("RollReady: 1 piece came back damaged at Renegade Wireline");
    expect(m.body).toContain("0 load-outs (0 READY), 1 check-in.");
    expect(m.body).toContain(`Came back damaged:\n  ${line}`);
    expect(m.body).toContain("On the crew, nothing in RollReady this week:\n  Lupe Cardenas");
  });

  it("two pieces damaged: plural subject", () => {
    expect(summaryText({ ...quiet, checkins: 2, damaged: ["a", "b"] })!.subject).toBe("RollReady: 2 pieces came back damaged at Renegade Wireline");
  });

  it("a tool signed out to a hand that came back damaged names the hand", () => {
    expect(damagedLine({ name: "Silver Fox setting tool #2", serial: "SF-2", red_tag: "threads galled", went_out: { with: "Lupe Cardenas", at: "2026-11-08T03:30:00Z" } }, "Lupe Cardenas"))
      .toBe("Silver Fox setting tool #2 SF-2: threads galled. Signed out to Lupe Cardenas Nov 7. Checked in by Lupe Cardenas.");
  });

  it("Wednesday: a late truck outranks damage in the subject; both show in the body", () => {
    const m = summaryText({ ...quiet, loadouts: 1, ready: 0, blocked: ["CT-01: Short: Lubricator, 1 of 2 scanned"], checkins: 1,
      late: ["CT-01: Was planned to leave Wed 5:00 AM. Still NOT READY."], damaged: ["Plug valve 2\" #3 PV-2203: body washed. Checked in by Freddy Carrasco."] })!;
    expect(m.subject).toBe("RollReady: 1 truck not scanned out at Renegade Wireline");
    expect(m.body).toContain("1 load-out (0 READY, 1 blocked), 1 check-in.");
    expect(m.body.indexOf("Not scanned out")).toBeLessThan(m.body.indexOf("Came back damaged"));
    expect(m.body.indexOf("Came back damaged")).toBeLessThan(m.body.indexOf("Blocked at load-out"));
  });
});

describe("planned to leave at 5 AM Central", () => {
  const plan = { at: "2026-11-09T22:00:00Z", leavesAt: "2026-11-10T11:00:00Z" }; // Mon 4 PM plan, Tue 5:00 AM CST
  it("reads the leave time in yard time", () => {
    expect(timeText(plan.leavesAt)).toBe("Tue 5:00 AM");
  });
  it("4:59 AM: not late yet", () => {
    expect(lateLine(plan, null, Date.parse("2026-11-10T10:59:00Z"), timeText)).toBeNull();
  });
  it("5:01 AM with nothing scanned: nobody scanned it out", () => {
    expect(lateLine(plan, null, Date.parse("2026-11-10T11:01:00Z"), timeText)).toBe("Was planned to leave Tue 5:00 AM. Nobody has scanned it out.");
  });
  it("Monday's READY load-out from before the plan doesn't count for Tuesday's job", () => {
    expect(lateLine(plan, { finished_at: "2026-11-09T12:00:00Z", rolled: true }, Date.parse("2026-11-10T11:01:00Z"), timeText))
      .toBe("Was planned to leave Tue 5:00 AM. Nobody has scanned it out.");
  });
  it("scanned at 4:40 AM and blocked: still NOT READY", () => {
    expect(lateLine(plan, { finished_at: "2026-11-10T10:40:00Z", rolled: false }, Date.parse("2026-11-10T11:30:00Z"), timeText))
      .toBe("Was planned to leave Tue 5:00 AM. Still NOT READY.");
  });
  it("rolled late, at 5:20 AM: not late any more", () => {
    expect(lateLine(plan, { finished_at: "2026-11-10T11:20:00Z", rolled: true }, Date.parse("2026-11-10T11:30:00Z"), timeText)).toBeNull();
  });
  it("no leave time set: never late", () => {
    expect(lateLine({ at: plan.at, leavesAt: null }, null, Date.parse("2026-11-12T11:00:00Z"), timeText)).toBeNull();
  });
});

describe("yard search words a manager actually types", () => {
  const NOW = Date.parse("2026-11-09T14:00:00Z");
  const list = buildEquipment({
    assets: [
      { id: "bop", name: "Quad BOP stack #3", category: "pressure_control", identifier: "QB-4471", status: "in_service", yard_id: "ody", unit_id: "ct3" },
      { id: "pv2", name: '2in 1502 plug valve', category: "flow_iron", identifier: "PV-2231", status: "out_of_service", yard_id: "ody", unit_id: "ct6" },
      { id: "pv3", name: '2in 1502 plug valve', category: "flow_iron", identifier: "PV-2203", status: "in_service", yard_id: "ody", unit_id: "ct3", out_since: "2026-11-07T12:00:00Z" },
      { id: "reel", name: "Reel R-8", category: "equipment", identifier: "R-8", status: "in_service", yard_id: "ody", unit_id: "ct8", out_since: "2026-10-29T12:00:00Z" },
      { id: "lost", name: '3in 1502 plug valve', category: "flow_iron", identifier: "PV-3019", status: "missing", yard_id: "ody", unit_id: null },
      { id: "sf2", name: "Silver Fox setting tool #2", category: "tool", identifier: "SF-2", status: "in_service", yard_id: "ody", unit_id: null, needs_redress_since: "2026-11-07T15:00:00Z" },
    ],
    units: [{ id: "ct3", name: "CT-03", yard_id: "ody" }, { id: "ct6", name: "CT-06", yard_id: "ody" }, { id: "ct8", name: "CT-08", yard_id: "ody" }],
    yards: [{ id: "ody", name: "Odessa Yard" }],
    items: [
      { id: "i1", title: "BOP pressure test", expiration_date: "2026-11-01", reminder_days: 30, pending_until: null, parent_id: "bop", last_upload_id: "c" },
      { id: "i2", title: "Pressure test", expiration_date: "2027-02-01", reminder_days: 30, pending_until: null, parent_id: "pv3", last_upload_id: "c" },
    ],
  }, "2026-11-09");
  const searchable: (SearchablePiece & { needsRedress: boolean; status: string })[] = list.rows.map((r) => ({
    ...r, serial: r.identifier, typeLabel: categoryLabel(r.category), nextTitle: r.next?.title ?? null,
    place: placeOf({ status: r.status, unit_id: r.unitId, out_since: r.outSince }, NOW, 7),
  }));
  const ids = (q: string) => searchPieces(searchable, q).map((p) => p.id);
  const chip = (id: string) => stateLabel(list.rows.find((r) => r.id === id)!);

  it("serial fragments, with or without the dash or a space", () => {
    expect(ids("4471")).toEqual(["bop"]);
    expect(ids("QB 4471")).toEqual(["bop"]);
    expect(ids("qb-44")).toEqual(["bop"]);
    expect(ids("PV-22")).toEqual(["pv2", "pv3"]);
    expect(ids("2203")).toEqual(["pv3"]);
  });

  it("status words: out too long, out, red-tagged / red tag / out of service, missing, out of test", () => {
    expect(ids("out too long")).toEqual(["reel"]);
    expect(ids("out")).toEqual(["pv3", "reel"]);
    expect(ids("red-tagged")).toEqual(["pv2"]);
    expect(ids("red tag")).toEqual(["pv2"]);
    expect(ids("out of service")).toEqual(["pv2"]);
    expect(ids("missing")).toEqual(["lost"]);
    expect(ids("out of test")).toEqual(["bop"]);
    expect(ids("plug valve out")).toEqual(["pv3"]);
    expect(ids("CT-08 out too long")).toEqual(["reel"]);
  });

  it("'overdue' finds the pieces the equipment list labels Overdue", () => {
    expect(chip("bop")).toBe("Overdue");
    // Today "overdue" is read as "out too long" and returns the reel out on CT-08 instead.
    expect(ids("overdue")).toEqual(["bop"]);
    expect(parseQuery("overdue").want).toEqual({ state: "overdue" });
  });

  it("'needs redress' finds the tool the list labels Needs redress", () => {
    expect(chip("sf2")).toBe("Needs redress");
    expect(ids("needs redress")).toEqual(["sf2"]);
  });
});
