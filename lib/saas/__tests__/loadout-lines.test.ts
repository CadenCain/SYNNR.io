import { describe, it, expect } from "vitest";
import { lineTokens, lineMatches, fillLines, shortLines, expectedLines, loadoutVerdict, untestedPieces, type ExpectedLine } from "../loadout-lines";
import { TESTED_CATEGORIES } from "../taxonomy";

const p = (id: string, name: string, serial: string | null = null) => ({ id, name, serial });

describe("lineTokens", () => {
  it("reads 2\", 2 in, 2-inch, and 2 inch the same", () => {
    expect(lineTokens('Plug valve 2"')).toEqual(["plug", "valve", "2in"]);
    expect(lineTokens("2-inch plug valve")).toEqual(["2in", "plug", "valve"]);
    expect(lineTokens("2 inch plug valve")).toEqual(["2in", "plug", "valve"]);
    expect(lineTokens("Plug valve 2 in.")).toEqual(["plug", "valve", "2in"]);
  });
  it("drops filler words and punctuation", () => {
    expect(lineTokens("BOP stack (with accumulator)")).toEqual(["bop", "stack", "accumulator"]);
  });
});

describe("lineMatches", () => {
  it("a general line fills from a more specific name", () => {
    expect(lineMatches("BOP", "BOP stack")).toBe(true);
    expect(lineMatches("Lubricator", "Lubricator section 8 ft")).toBe(true);
  });
  it("a specific line doesn't take a different size", () => {
    expect(lineMatches("Plug valve 2-inch", 'Plug valve 3"')).toBe(false);
    expect(lineMatches("Plug valve 2-inch", 'Plug valve 2"')).toBe(true);
  });
  it("an empty line matches nothing", () => {
    expect(lineMatches("  ", "BOP stack")).toBe(false);
  });
});

describe("fillLines", () => {
  const lines: ExpectedLine[] = [
    { label: "Plug valve", qty: 1, source: "kit" },
    { label: "Plug valve 2-inch", qty: 2, source: "package", package: "Standard Coil Package" },
    { label: "BOP stack", qty: 1, source: "kit" },
  ];
  it("specific lines get first pick, one piece fills one line", () => {
    const scanned = [p("a", 'Plug valve 2"', "PV-1"), p("b", 'Plug valve 2"', "PV-2"), p("c", 'Plug valve 3"', "PV-3"), p("d", "BOP stack", "QB-1")];
    const f = fillLines(lines, scanned);
    expect(f[1].filled.map((x) => x.id)).toEqual(["a", "b"]);
    expect(f[0].filled.map((x) => x.id)).toEqual(["c"]);
    expect(f[2].filled.map((x) => x.id)).toEqual(["d"]);
    expect(shortLines(f)).toHaveLength(0);
  });
  it("counts what's short", () => {
    const f = fillLines(lines, [p("a", 'Plug valve 2"')]);
    const short = shortLines(f).map((l) => `${l.label} ${l.filled.length}/${l.qty}`);
    expect(short).toEqual(["Plug valve 0/1", "Plug valve 2-inch 1/2", "BOP stack 0/1"]);
  });
  it("never fills past the quantity", () => {
    const f = fillLines([{ label: "Lubricator", qty: 1, source: "quick" }], [p("a", "Lubricator"), p("b", "Lubricator")]);
    expect(f[0].filled).toHaveLength(1);
  });
  it("treats a bad quantity as one", () => {
    const f = fillLines([{ label: "Lubricator", qty: 0, source: "quick" }], []);
    expect(f[0].qty).toBe(1);
  });
});

describe("expectedLines", () => {
  it("keeps the kit, each package, and quick lines apart, and drops blanks", () => {
    const e = expectedLines({
      kit: [{ label: "BOP stack", qty: 1 }],
      packages: [{ name: "Standard Coil Package", lines: [{ label: "Plug valve 2-inch", qty: 4 }, { label: " ", qty: 1 }] }],
      quick: [{ label: "Swivel 3-inch", qty: 2 }],
    });
    expect(e).toEqual([
      { label: "BOP stack", qty: 1, source: "kit" },
      { label: "Plug valve 2-inch", qty: 4, source: "package", package: "Standard Coil Package" },
      { label: "Swivel 3-inch", qty: 2, source: "quick" },
    ]);
  });
});

describe("loadoutVerdict", () => {
  const full = fillLines([{ label: "BOP stack", qty: 1, source: "kit" }], [p("d", "BOP stack", "QB-1")]);
  it("READY only when nothing is short, bad, missing, or out on the truck's paper", () => {
    expect(loadoutVerdict({ lines: full, bad: [], cantFind: [], truckPaper: [] })).toEqual({ verdict: "ready", reasons: [] });
  });
  it("nothing scanned on is never READY, even with no list", () => {
    expect(loadoutVerdict({ lines: [], bad: [], cantFind: [], truckPaper: [], scanned: 0 }))
      .toEqual({ verdict: "not_ready", reasons: ["Nothing was scanned onto the truck"] });
    expect(loadoutVerdict({ lines: [], bad: [], cantFind: [], truckPaper: [], scanned: 1 }).verdict).toBe("ready");
  });
  it("anything missing, out of test, or red-tagged is NOT READY, with every reason", () => {
    const short = fillLines([{ label: "Plug valve 2-inch", qty: 4, source: "package", package: "Standard Coil Package" }], [p("a", 'Plug valve 2"')]);
    const v = loadoutVerdict({
      lines: short,
      bad: [{ name: "BOP stack", serial: "QB-4471", why: "out_of_test", detail: "pressure test expired Oct 8" }, { name: "Plug valve", serial: "PV-9", why: "red_tagged" }],
      cantFind: [{ name: "Lubricator", serial: "LB-221" }],
      truckPaper: [{ title: "DOT annual inspection", detail: "expired Oct 2" }],
    });
    expect(v.verdict).toBe("not_ready");
    expect(v.reasons).toEqual([
      "Short: Plug valve 2-inch, 1 of 4 scanned (Standard Coil Package)",
      "Can't find: Lubricator LB-221",
      "Out of test: BOP stack QB-4471, pressure test expired Oct 8",
      "Red-tagged: Plug valve PV-9",
      "Truck paper: DOT annual inspection expired Oct 2",
    ]);
  });
});

describe("untestedPieces: nothing goes on that nobody proved is good", () => {
  const kit: ExpectedLine[] = [{ label: "Quad BOP stack", qty: 1, source: "kit" }, { label: "Pipe wrench", qty: 1, source: "kit" }];
  type P = { id: string; name: string; serial: string | null; category: string };
  const fake: P = { id: "fake", name: "Quad BOP stack #9", serial: "QB-9999", category: "tool" };
  const wrench: P = { id: "wr", name: "Pipe wrench 36in", serial: null, category: "tool" };
  const run = (scanned: P[], hasTest: string[], tested: string[]) => untestedPieces({
    scanned, hasTest: new Set(hasTest), filled: fillLines(kit, scanned), testedCategories: TESTED_CATEGORIES,
    lineIsTested: (label) => tested.includes(label),
  }).map((p) => p.id);

  it("a piece added with no paper can't fill a line the yard's other iron of that kind is tested for", () => {
    expect(run([fake], [], ["Quad BOP stack"])).toEqual(["fake"]);
  });
  it("an untested tool on an untested line is fine", () => {
    expect(run([wrench], [], ["Quad BOP stack"])).toEqual([]);
  });
  it("pressure iron with no test on file never goes, on the list or not", () => {
    expect(run([{ id: "pv", name: "2in 1502 plug valve", serial: "PV-1", category: "flow_iron" }], [], [])).toEqual(["pv"]);
  });
  it("a piece with any test on file is judged by its tests, not here", () => {
    expect(run([fake], ["fake"], ["Quad BOP stack"])).toEqual([]);
  });
  it("reads as its own reason on the record", () => {
    const v = loadoutVerdict({ lines: [], bad: [{ name: "Quad BOP stack #9", serial: "QB-9999", why: "no_test_on_file" }], cantFind: [], truckPaper: [], scanned: 1 });
    expect(v).toEqual({ verdict: "not_ready", reasons: ["No test on file: Quad BOP stack #9 QB-9999"] });
  });
});
