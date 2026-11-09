import { describe, it, expect } from "vitest";
import {
  expectedLines, fillLines, shortLines, loadoutVerdict, untestedPieces, needsTagScan, lineMatches, kitLinesFrom,
  type BadPiece, type ExpectedLine,
} from "../loadout-lines";
import { judgeItem, isNoPaper, type JItem } from "../judge";
import { TESTED_CATEGORIES } from "../taxonomy";
import { requiredChecks, missingChecks, cleanChecks } from "../roll-checks";
import { photoPathOk } from "../loadout-photo";
import { provenHow } from "../scan-proof";

/**
 * A week at a coil tubing yard, Monday Nov 9 2026, run against the pure
 * rules. serverVerdict() below walks the same steps finishLoadout() does
 * (app/app/units/[unitId]/scan/actions.ts): fill the list, work out the bad
 * pieces from their tests, flag untested look-alikes, then the verdict.
 */

const TODAY = "2026-11-09";

type Test = Omit<JItem, "parent_id">;
interface YardPiece {
  id: string; name: string; serial: string | null; category: string;
  status?: string; redress?: boolean; tests?: Test[];
}

let n = 0;
const test = (title: string, exp: string | null, extra: Partial<Test> = {}): Test =>
  ({ id: `it-${++n}`, title, expiration_date: exp, last_upload_id: "cert-photo", reminder_days: 30, pending_until: null, ...extra });
const piece = (id: string, name: string, serial: string | null, category: string, tests: Test[] = [], extra: Partial<YardPiece> = {}): YardPiece =>
  ({ id, name, serial, category, tests, ...extra });

function serverVerdict(input: {
  kit?: { label: string; qty: number }[];
  packages?: { name: string; lines: { label: string; qty: number }[] }[];
  planned?: { label: string; qty: number }[];
  quick?: { label: string; qty: number }[];
  /** In the order the hand scanned them. */
  scanned: YardPiece[];
  /** Every piece in the company (for "the yard's other iron of that kind has a test"). */
  yard?: YardPiece[];
  today?: string;
  cantFind?: { name: string; serial: string | null }[];
  truckPaper?: { title: string; detail: string }[];
}) {
  const today = input.today ?? TODAY;
  const expected = expectedLines({ kit: input.kit ?? [], packages: input.packages ?? [], planned: input.planned ?? [], quick: input.quick ?? [] });
  const filled = fillLines(expected, input.scanned.map((p) => ({ id: p.id, name: p.name, serial: p.serial })));
  const down = (p: YardPiece) => p.status === "out_of_service" || Boolean(p.redress);
  const bad: (BadPiece & { id: string })[] = [];
  for (const p of input.scanned) {
    if (p.status === "out_of_service") bad.push({ id: p.id, name: p.name, serial: p.serial, why: "red_tagged" });
    else if (p.redress) bad.push({ id: p.id, name: p.name, serial: p.serial, why: "needs_redress" });
  }
  for (const p of input.scanned) {
    if (down(p)) continue;
    for (const it of p.tests ?? []) {
      const r = judgeItem({ ...it, parent_id: p.id }, today, today);
      if (r.result === "expired") bad.push({ id: p.id, name: p.name, serial: p.serial, why: "out_of_test", detail: `${it.title} ${r.detail}` });
      else if (isNoPaper(r)) bad.push({ id: p.id, name: p.name, serial: p.serial, why: "no_paper", detail: it.title });
      else if (r.result === "missing") bad.push({ id: p.id, name: p.name, serial: p.serial, why: "no_test_date", detail: it.title });
    }
  }
  const hasTest = new Set(input.scanned.filter((p) => (p.tests ?? []).length).map((p) => p.id));
  const untested = input.scanned.filter((p) => !hasTest.has(p.id)).map((p) => p.id);
  // Same as finishLoadout: every line an untested piece could fill, not just the one it landed in.
  const labels = new Set<string>();
  for (const id of untested) for (const l of filled) if (lineMatches(l.label, input.scanned.find((p) => p.id === id)!.name)) labels.add(l.label);
  const testedLabels = new Set<string>();
  for (const label of labels) {
    const kin = (input.yard ?? input.scanned).filter((p) => p.status !== "retired" && !untested.includes(p.id) && lineMatches(label, p.name));
    if (kin.some((p) => (p.tests ?? []).length)) testedLabels.add(label);
  }
  const byId = new Map(input.scanned.map((p) => [p.id, p]));
  bad.push(...untestedPieces({
    scanned: input.scanned.map((p) => ({ id: p.id, name: p.name, serial: p.serial, category: p.category })),
    hasTest, filled, testedCategories: TESTED_CATEGORIES, lineIsTested: (l) => testedLabels.has(l),
  }).filter((b) => !down(byId.get(b.id)!)));
  const v = loadoutVerdict({ lines: filled, bad, cantFind: input.cantFind ?? [], truckPaper: input.truckPaper ?? [], scanned: input.scanned.length });
  return { ...v, filled, short: shortLines(filled) };
}

// ---- CT-03, a coil unit, and the iron on the rack ----
const bop = piece("bop", "Quad BOP stack #3", "QB-4471", "pressure_control", [test("BOP pressure test", "2027-03-01")]);
const lub1 = piece("lub1", "Lubricator #1", "LB-811", "pressure_control", [test("Lubricator pressure test", "2027-01-15")]);
const lub2 = piece("lub2", "Lubricator #2", "LB-812", "pressure_control", [test("Lubricator pressure test", "2026-12-20")]);
const inj = piece("inj", "Injector head #1", "IH-31", "equipment", [test("Annual inspection", "2027-05-01")]);
const reel = piece("reel", "Reel R-3", "R-3", "equipment");
const onTruck = [bop, lub1, lub2, inj, reel];

const pv = [1, 2, 3, 4].map((i) => piece(`pv${i}`, `Plug valve 2" #${i}`, `PV-220${i}`, "flow_iron", [test("Pressure test", "2027-02-01")]));
const pv5 = piece("pv5", 'Plug valve 2" #5', "PV-2205", "flow_iron", [test("Pressure test", "2027-02-01")]);
const sw = [1, 2].map((i) => piece(`sw${i}`, `2in 1502 Chiksan swivel #${i}`, `SW-118${i}`, "flow_iron", [test("Pressure test", "2027-04-01")]));
const pj = [1, 2].map((i) => piece(`pj${i}`, `2" 1502 pup joint 4ft #${i}`, `PJ-40${i}`, "flow_iron", [test("Pressure test", "2027-04-01")]));
const xo = piece("xo", 'Crossover 2" x 3" #1', "XO-11", "flow_iron", [test("Pressure test", "2027-04-01")]);

const KIT = kitLinesFrom(onTruck.map((p) => p.name));
const COIL_PACKAGE = { name: "Standard Coil Package", lines: [{ label: "Plug valve 2-inch", qty: 4 }, { label: "2in 1502 swivel", qty: 2 }, { label: "Pup joint 2in 1502", qty: 2 }] };
const PLANNED = [{ label: 'Crossover 2"', qty: 1 }];
const fullLoad = [...onTruck, ...pv, ...sw, ...pj, xo];
const coil = (scanned: YardPiece[], extra: Partial<Parameters<typeof serverVerdict>[0]> = {}) =>
  serverVerdict({ kit: KIT, packages: [COIL_PACKAGE], planned: PLANNED, scanned, yard: [...fullLoad, pv5], ...extra });

describe("Monday: CT-03 loads out for a coil job", () => {
  it("the kit comes from what's on the truck: one line per kind, piece numbers dropped", () => {
    expect(KIT).toEqual([
      { label: "Quad BOP stack", qty: 1 }, { label: "Lubricator", qty: 2 }, { label: "Injector head", qty: 1 }, { label: "Reel R-3", qty: 1 },
    ]);
  });

  it("kit + Standard Coil Package + the manager's extra, everything scanned and current: READY", () => {
    const v = coil(fullLoad);
    expect(v.reasons).toEqual([]);
    expect(v.verdict).toBe("ready");
  });

  it("near-name pieces fill their lines: 'Quad BOP stack #3' fills 'Quad BOP stack', '2\" 1502 pup joint 4ft #1' fills 'Pup joint 2in 1502'", () => {
    const v = coil(fullLoad);
    const line = (label: string) => v.filled.find((l) => l.label === label)!.filled.map((f) => f.id);
    expect(line("Quad BOP stack")).toEqual(["bop"]);
    expect(line("Lubricator")).toEqual(["lub1", "lub2"]);
    expect(line("Plug valve 2-inch")).toEqual(["pv1", "pv2", "pv3", "pv4"]);
    expect(line("2in 1502 swivel")).toEqual(["sw1", "sw2"]);
    expect(line("Pup joint 2in 1502")).toEqual(["pj1", "pj2"]);
    expect(line('Crossover 2"')).toEqual(["xo"]);
  });

  it("a near name of a different kind doesn't fill: a quad BOP isn't a dual BOP, a 3\" valve isn't a 2\" one", () => {
    expect(lineMatches("Dual BOP stack", "Quad BOP stack #3")).toBe(false);
    expect(lineMatches("Plug valve 2-inch", 'Plug valve 3" #2')).toBe(false);
    expect(lineMatches("Quad BOP stack", "Quad BOP stack #3")).toBe(true);
  });

  it("one plug valve left on the rack: Short, named with its package", () => {
    const v = coil(fullLoad.filter((p) => p.id !== "pv4"));
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toEqual(["Short: Plug valve 2-inch, 3 of 4 scanned (Standard Coil Package)"]);
  });

  it("nothing scanned at all is never READY, even with no list", () => {
    expect(serverVerdict({ scanned: [] }).reasons).toEqual(["Nothing was scanned onto the truck"]);
  });
});

describe("quantity lines with a bad piece in them", () => {
  const pv3Expired = { ...pv[2], tests: [test("Pressure test", "2026-11-08")] };
  const load = [...onTruck, pv[0], pv[1], pv3Expired, pv[3], ...sw, ...pj, xo];

  it("4 of 4 valves on, one out of test since yesterday: NOT READY, and it says which and why", () => {
    const v = coil(load);
    expect(v.short).toEqual([]);
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toEqual(['Out of test: Plug valve 2" #3 PV-2203, Pressure test expired Nov 8, 2026 (1d ago)']);
  });

  it("throwing a fifth good valve on doesn't make it READY: the bad one is still on the truck", () => {
    const v = coil([...load, pv5]);
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toHaveLength(1);
  });

  it("bad one off, good one on: READY", () => {
    const v = coil([...load.filter((p) => p.id !== "pv3"), pv5]);
    expect(v.verdict).toBe("ready");
  });

  it("a red-tagged valve and a tool waiting on redress each block by name", () => {
    const tagged = { ...pv[1], status: "out_of_service" };
    const sf = piece("sf2", "Silver Fox setting tool #2", "SF-2", "tool", [], { redress: true });
    const v = coil([...onTruck, pv[0], tagged, pv[2], pv[3], ...sw, ...pj, xo, sf]);
    expect(v.reasons).toEqual(['Red-tagged: Plug valve 2" #2 PV-2202', "Needs redress: Silver Fox setting tool #2 SF-2"]);
  });
});

describe("no paper, no go / cert on the way", () => {
  it("BOP with a good date but no cert photo attached: NOT READY, No paper on file", () => {
    const noPaper = { ...bop, tests: [test("BOP pressure test", "2027-03-01", { last_upload_id: null })] };
    const v = coil([noPaper, ...fullLoad.slice(1)]);
    expect(v.reasons).toEqual(["No paper on file: Quad BOP stack #3 QB-4471, BOP pressure test"]);
  });

  it("BOP test with no date on file: NOT READY, No test date on file", () => {
    const noDate = { ...bop, tests: [test("BOP pressure test", null)] };
    expect(coil([noDate, ...fullLoad.slice(1)]).reasons).toEqual(["No test date on file: Quad BOP stack #3 QB-4471, BOP pressure test"]);
  });

  it("BOP test lapsed, retested, cert on the way through Thursday: rolls Monday, blocked Friday", () => {
    const pendingBop = { ...bop, tests: [test("BOP pressure test", "2026-11-05", { pending_until: "2026-11-12" })] };
    const load = [pendingBop, ...fullLoad.slice(1)];
    expect(coil(load).verdict).toBe("ready");
    expect(coil(load, { today: "2026-11-12" }).verdict).toBe("ready");
    const fri = coil(load, { today: "2026-11-13" });
    expect(fri.verdict).toBe("not_ready");
    expect(fri.reasons).toEqual(["Out of test: Quad BOP stack #3 QB-4471, BOP pressure test expired Nov 5, 2026 (8d ago)"]);
  });

  it("truck paper with no cert attached blocks the truck too", () => {
    const v = coil(fullLoad, { truckPaper: [{ title: "Annual DOT inspection", detail: "has no cert attached" }] });
    expect(v.reasons).toEqual(["Truck paper: Annual DOT inspection has no cert attached"]);
  });
});

describe("untested look-alikes", () => {
  // Added from a phone, picked as 'Equipment', no test on file.
  const bop9 = piece("bop9", "Quad BOP stack #9", null, "equipment");

  it("a phone-added BOP with no test can't stand in for the real one", () => {
    const v = coil([bop9, ...fullLoad.slice(1)], { cantFind: [{ name: bop.name, serial: bop.serial }] });
    expect(v.reasons).toContain("No test on file: Quad BOP stack #9");
    expect(v.verdict).toBe("not_ready");
  });

  it("pressure iron with no test on file never goes, list or no list", () => {
    const loose = piece("lub9", "Lubricator #9", null, "pressure_control");
    expect(coil([...fullLoad, loose]).reasons).toEqual(["No test on file: Lubricator #9"]);
  });

  it("the untested BOP on the truck blocks it no matter which BOP the hand scanned first", () => {
    const untestedFirst = coil([bop9, ...fullLoad]);
    const realFirst = coil([...fullLoad, bop9]);
    expect(untestedFirst.verdict).toBe("not_ready");
    // Same truck, same iron. Only the scan order changed.
    expect(realFirst.verdict).toBe(untestedFirst.verdict);
  });
});

describe("two lines that could both take the same piece", () => {
  // A Halliburton Lo-Torque plug valve is both a "plug valve 2-inch" and a "lo-torque valve".
  const lt7 = piece("lt7", 'Lo-Torque plug valve 2" #7', "LT-7", "flow_iron", [test("Pressure test", "2027-02-01")]);
  const pv1 = pv[0];
  const lines = {
    packages: [{ name: "Flowback Package", lines: [{ label: "Plug valve 2-inch", qty: 1 }] }],
    planned: [{ label: "Lo-torque valve", qty: 1 }],
  };

  it("the general line steps aside for the specific one (subset lines are fine)", () => {
    const f = fillLines([
      { label: "Plug valve", qty: 1, source: "kit" },
      { label: "Plug valve 2-inch", qty: 1, source: "package" },
    ] as ExpectedLine[], [{ id: "a", name: 'Plug valve 2" #1', serial: null }, { id: "b", name: 'Plug valve 3" #2', serial: null }]);
    expect(f.map((l) => l.filled.map((x) => x.id))).toEqual([["b"], ["a"]]);
  });

  it("both lines can be filled (Lo-Torque on its line, the plain valve on the 2-inch line) whichever is scanned first", () => {
    const plainFirst = serverVerdict({ ...lines, scanned: [pv1, lt7] });
    expect(plainFirst.verdict).toBe("ready");
    const loTorqueFirst = serverVerdict({ ...lines, scanned: [lt7, pv1] });
    expect(loTorqueFirst.reasons).toEqual([]);
    expect(loTorqueFirst.verdict).toBe("ready");
  });

  it("the board's 'Kit short' heads-up shouldn't depend on which piece was logged first either", () => {
    const kit: ExpectedLine[] = [{ label: "Plug valve 2-inch", qty: 1, source: "kit" }, { label: "Lo-torque valve", qty: 1, source: "kit" }];
    const a = shortLines(fillLines(kit, [{ id: "pv1", name: pv1.name, serial: null }, { id: "lt7", name: lt7.name, serial: null }]));
    const b = shortLines(fillLines(kit, [{ id: "lt7", name: lt7.name, serial: null }, { id: "pv1", name: pv1.name, serial: null }]));
    expect(a).toEqual([]);
    expect(b).toEqual([]);
  });
});

describe("sizes and piece numbers in names", () => {
  it("a 3-1/2\" crossover doesn't fill the planned 2\" crossover line", () => {
    const xo35 = piece("xo35", 'Crossover 3-1/2" #1', "XO-35", "flow_iron", [test("Pressure test", "2027-04-01")]);
    expect(lineMatches('Crossover 2"', xo35.name)).toBe(false);
    const v = serverVerdict({ planned: [{ label: 'Crossover 2"', qty: 1 }], scanned: [xo35] });
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toEqual(['Short: Crossover 2", 0 of 1 scanned']);
  });

  it("a 3-1/16\" gate valve doesn't fill a 2-1/16\" gate valve line", () => {
    expect(lineMatches('Gate valve 2-1/16"', 'Gate valve 3-1/16" #2')).toBe(false);
    expect(lineMatches('Gate valve 2-1/16"', 'Gate valve 2-1/16" #5')).toBe(true);
  });

  it("piece number #8 isn't a size: a 10 ft lubricator #8 doesn't fill an 8 ft lubricator line", () => {
    // Demo-style names: "2in 1502 pup joint, 10 ft", numbered like "Quad BOP stack #3".
    expect(lineMatches("2in 1502 pup joint, 6 ft", "2in 1502 pup joint, 10 ft #6")).toBe(false);
    expect(lineMatches("Lubricator 8 ft", "Lubricator 10 ft #8")).toBe(false);
    expect(lineMatches("Lubricator 8'", "Lubricator 10' #8")).toBe(false);
    const v = serverVerdict({
      packages: [{ name: "Standard Coil Package", lines: [{ label: "Lubricator 8 ft", qty: 1 }] }],
      scanned: [piece("l10", "Lubricator 10 ft #8", "LB-1008", "pressure_control", [test("Lubricator pressure test", "2027-01-15")])],
    });
    expect(v.verdict).toBe("not_ready");
  });

  it("an 8 ft line fills from an 8 ft piece however the feet are written", () => {
    expect(lineMatches("Lubricator 8 ft", "Lubricator 8 ft #2")).toBe(true);
    expect(lineMatches("Lubricator 8ft", "Lubricator 8 ft #2")).toBe(true);
  });

  it("an inch mark typed on an iPhone (2”, smart punctuation) reads like 2\"", () => {
    expect(lineMatches("Plug valve 2”", 'Plug valve 2" #1')).toBe(true);
    expect(lineMatches("Plug valve 2-inch", "Plug valve 2” #1")).toBe(true);
    // And a 2" valve numbered #3 must not fill a 3" line.
    expect(lineMatches("Plug valve 3”", 'Plug valve 2" #3')).toBe(false);
  });
});

describe("roll checks with different casing and spacing", () => {
  it("the kit's and the package's checks are asked once, tapped in any case, any spacing at the ends", () => {
    const kitChecks = cleanChecks(["BOP rams closed for travel", "Everything strapped and padded"]);
    const pkgChecks = ["  bop rams closed for travel ", "Lubricator capped"];
    const asked = requiredChecks(kitChecks, pkgChecks, null);
    expect(asked).toEqual(["BOP rams closed for travel", "Everything strapped and padded", "Lubricator capped"]);
    // The server keys what the phone tapped by label.trim().toLowerCase().
    const tapped = ["BOP RAMS CLOSED FOR TRAVEL", " everything strapped and padded"].map((c) => c.trim().toLowerCase());
    expect(missingChecks(asked, tapped)).toEqual(["Lubricator capped"]);
    expect(missingChecks(asked, [...tapped, "lubricator capped  "])).toEqual([]);
  });
  it("an untapped check is a reason, worded the way the record reads", () => {
    const notTapped = missingChecks(["BOP rams closed for travel"], []);
    const reasons = [...coil(fullLoad).reasons, ...notTapped.map((c) => `Not confirmed: ${c}`)];
    expect(reasons).toEqual(["Not confirmed: BOP rams closed for travel"]);
  });
});

describe("scan-only yard and the loaded-truck photo", () => {
  const lineLabels = expectedLines({ kit: KIT, packages: [COIL_PACKAGE], planned: PLANNED, quick: [] }).map((l) => l.label);
  it("pressure iron and anything on the list has to come off its tag; a hand tool off the list doesn't", () => {
    expect(needsTagScan(bop, lineLabels, TESTED_CATEGORIES)).toBe(true);
    expect(needsTagScan(reel, lineLabels, TESTED_CATEGORIES)).toBe(true);
    expect(needsTagScan({ name: "Hammer wrench", category: "tool" }, lineLabels, TESTED_CATEGORIES)).toBe(false);
  });
  it("a phone that claims an NFC read without this piece's code is a check by hand", () => {
    const tag = { tag_token: "6fadc6144e4544b795e99ce566020fda", nfc_uid: "04:a2:1b:ff" };
    expect(provenHow("nfc", "04:A2:1B:FF", tag)).toBe("nfc");
    expect(provenHow("qr", "6FADC6144E4544B795E99CE566020FDA ", tag)).toBe("qr");
    expect(provenHow("nfc", "", tag)).toBe("hand");
    expect(provenHow("nfc", "04:a2:1b:00", tag)).toBe("hand");
  });
  it("the photo has to be this load-out's, taken while it was going on", () => {
    const co = "11111111-1111-1111-1111-111111111111", ct3 = "22222222-2222-2222-2222-222222222222";
    const started = Date.parse("2026-11-09T11:10:00Z"), now = Date.parse("2026-11-09T11:40:00Z");
    expect(photoPathOk(`${co}/loadout/${ct3}/${started}-${started + 25 * 60e3}.jpg`, co, ct3, started, now)).toBe(true);
    expect(photoPathOk(`${co}/loadout/${ct3}/${started - 86_400_000}-${started - 86_400_000 + 60e3}.jpg`, co, ct3, started, now)).toBe(false);
  });
});
