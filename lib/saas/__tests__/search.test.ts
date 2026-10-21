import { describe, it, expect } from "vitest";
import { parseQuery, searchPieces, matchesName, type SearchablePiece } from "../search";

const piece = (id: string, o: Partial<SearchablePiece>): SearchablePiece => ({
  id, name: "Piece", serial: null, typeLabel: "Flow iron", where: "Odessa Yard", note: null, nextTitle: null, state: "ok", place: "in_yard", ...o,
});
const P = [
  piece("bop", { name: "Quad BOP stack #3", serial: "QB-4471", typeLabel: "Pressure control", where: "CT-03 · Odessa Yard", state: "overdue", place: "on_truck", nextTitle: "BOP pressure test" }),
  piece("pv1", { name: "2in 1502 plug valve", serial: "PV-2231", where: "CT-06 · Odessa Yard", state: "down", place: "red_tagged" }),
  piece("pv2", { name: "2in 1502 plug valve", serial: "PV-2203", where: "CT-03 · Odessa Yard", place: "out" }),
  piece("pv3", { name: "3in 1502 plug valve", serial: "PV-3019", where: "Odessa Yard", state: "down", place: "missing" }),
  piece("sw", { name: "2in 1502 Chiksan swivel", serial: "SW-1180", note: "recert rack by the wash bay", state: "overdue", place: "in_yard" }),
  piece("lb", { name: "Lubricator #1", serial: "LB-811", where: "CT-01 · Odessa Yard", place: "out_too_long", state: "due" }),
];
const ids = (q: string) => searchPieces(P, q).map((p) => p.id);

describe("yard search", () => {
  it("finds by serial, with or without the dash, serial hits first", () => {
    expect(ids("4471")).toEqual(["bop"]);
    expect(ids("qb4471")).toEqual(["bop"]);
    expect(ids("PV-22")).toEqual(["pv1", "pv2"]);
    expect(ids("PV-2231")[0]).toBe("pv1");
  });
  it("finds by description, truck, yard, rack note, and test name", () => {
    expect(ids("plug valve")).toEqual(["pv1", "pv2", "pv3"]);
    expect(ids("CT-03")).toEqual(["pv2", "bop"]);
    expect(ids("wash bay")).toEqual(["sw"]);
    expect(ids("pressure test")).toEqual(["bop"]);
  });
  it("status words filter, other words narrow", () => {
    expect(ids("red-tagged")).toEqual(["pv1"]);
    expect(ids("missing")).toEqual(["pv3"]);
    expect(ids("out")).toEqual(["pv2", "lb"]);
    expect(ids("out too long")).toEqual(["lb"]);
    expect(ids("out of test")).toEqual(["sw", "bop"]);
    expect(ids("plug valve out")).toEqual(["pv2"]);
    expect(ids("due")).toEqual(["lb"]);
    expect(ids("on truck")).toEqual(["bop"]);
  });
  it("reads the phrases apart from the words", () => {
    expect(parseQuery("plug valve out of test")).toEqual({ words: ["plug", "valve"], want: { state: "overdue" } });
    expect(parseQuery("CT-03")).toEqual({ words: ["ct-03"], want: {} });
  });
  it("nothing typed finds nothing", () => {
    expect(ids("   ")).toEqual([]);
  });
  it("trucks and yards by name or door number", () => {
    expect(matchesName("ct03", "CT-03", "1403")).toBe(true);
    expect(matchesName("1403", "CT-03", "1403")).toBe(true);
    expect(matchesName("odessa", "Odessa Yard")).toBe(true);
    expect(matchesName("midland", "Odessa Yard")).toBe(false);
  });
});
