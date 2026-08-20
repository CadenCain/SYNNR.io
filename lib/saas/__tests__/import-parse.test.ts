import { describe, it, expect } from "vitest";
import { parseCsv, norm, matchValue, parseDate, mapHeader } from "../import-parse";
import { UNIT_TYPES, COMPLIANCE_KINDS } from "../taxonomy";

/**
 * Pressure tests for the import path — the front door of onboarding. These
 * exist because the ONLY promise the importer makes is "preview shows every
 * error before anything is written," and a parser that lets garbage through
 * preview breaks that promise at commit time, halfway through a write.
 */

describe("parseCsv — the shapes real spreadsheets actually produce", () => {
  it("plain rows, trimmed cells", () => {
    expect(parseCsv("a, b ,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("quoted field containing a comma — the classic Excel export", () => {
    expect(parseCsv('unit,notes\nRig 4,"pump, hoses, and subs"')).toEqual([
      ["unit", "notes"],
      ["Rig 4", "pump, hoses, and subs"],
    ]);
  });

  it('escaped quotes inside a quoted field ("" → ")', () => {
    expect(parseCsv('a\n"say ""when"""')).toEqual([["a"], ['say "when"']]);
  });

  it("CRLF line endings (Windows Excel default)", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("blank lines are skipped, not turned into empty rows", () => {
    expect(parseCsv("a\n\n\n1\n")).toEqual([["a"], ["1"]]);
  });

  it("trailing empty cell survives (row length stays consistent)", () => {
    expect(parseCsv("a,b,c\n1,2,")).toEqual([["a", "b", "c"], ["1", "2", ""]]);
  });
});

describe("norm + matchValue — header and enum forgiveness", () => {
  it("normalizes the ways people actually type headers", () => {
    expect(norm("Unit Type")).toBe("unit_type");
    expect(norm("  EXPIRES ")).toBe("expires");
    expect(norm("DOT-Sticker")).toBe("dot_sticker");
  });

  it("matches an enum by value or by human label", () => {
    expect(matchValue("service_rig", UNIT_TYPES, "truck")).toBe("service_rig");
    expect(matchValue("Service rig", UNIT_TYPES, "truck")).toBe("service_rig");
    expect(matchValue("Cert", COMPLIANCE_KINDS, "cert")).toBe("cert");
  });

  it("empty input falls back; unknown input passes through normalized", () => {
    expect(matchValue("", UNIT_TYPES, "truck")).toBe("truck");
    // unknown types are kept (normalized) rather than silently rewritten —
    // the shop's word for its own truck beats our enum
    expect(matchValue("swab rig", UNIT_TYPES, "truck")).toBe("swab_rig");
  });
});

describe("mapHeader — the names real yard spreadsheets actually use", () => {
  it("canonical template headers map straight through", () => {
    const col = mapHeader(["unit", "unit_type", "asset", "category", "crew", "item", "kind", "issued", "expires"]);
    expect(col).toEqual({ unit: 0, unitType: 1, asset: 2, category: 3, crew: 4, item: 5, kind: 6, issued: 7, expires: 8 });
  });

  it('"Unit #", "Serial Number", "Equipment Tag", "Expiry Date" — the wild ones land', () => {
    const col = mapHeader(["Unit #", "Serial Number", "Certification", "Expiry Date", "Issue Date"]);
    expect(col.unit).toBe(0);
    expect(col.asset).toBe(1);
    expect(col.item).toBe(2);
    expect(col.expires).toBe(3);
    expect(col.issued).toBe(4);
  });

  it("fleet-manager vocabulary: Truck Number / Equipment ID / Due Date / Driver", () => {
    const col = mapHeader(["Truck Number", "Equipment ID", "Due Date", "Driver"]);
    expect(col.unit).toBe(0);
    expect(col.asset).toBe(1);
    expect(col.expires).toBe(2);
    expect(col.crew).toBe(3);
  });

  it("unknown headers are ignored (-1), never a crash", () => {
    const col = mapHeader(["Favorite Color", "unit"]);
    expect(col.unit).toBe(1);
    expect(col.asset).toBe(-1);
    expect(col.crew).toBe(-1);
  });

  it('collision rule holds: bare "type" is the UNIT type, cert kind needs "kind"', () => {
    const col = mapHeader(["unit", "type", "kind"]);
    expect(col.unitType).toBe(1);
    expect(col.kind).toBe(2);
  });

  it("first matching alias wins when a sheet has duplicates", () => {
    const col = mapHeader(["unit", "truck"]);
    expect(col.unit).toBe(0);
  });
});

describe("parseDate — every date error must surface at PREVIEW, not commit", () => {
  it("ISO passes through", () => {
    expect(parseDate("2026-07-15")).toBe("2026-07-15");
  });

  it("Excel M/D/YYYY converts, with zero-padding", () => {
    expect(parseDate("7/4/2026")).toBe("2026-07-04");
    expect(parseDate("12/31/2026")).toBe("2026-12-31");
  });

  it("empty means no date, not an error", () => {
    expect(parseDate("")).toBeNull();
  });

  it("garbage throws a plain-English error", () => {
    expect(() => parseDate("next week")).toThrow(/bad date/);
    expect(() => parseDate("07-15-2026")).toThrow(/bad date/);
  });

  /**
   * REGRESSION — "13/45/2026" used to become "2026-13-45", pass the dry-run
   * (which does no DB writes), then explode against Postgres halfway through
   * commit. Impossible dates must throw at parse time.
   */
  it("impossible month/day throws instead of passing preview", () => {
    expect(() => parseDate("13/45/2026")).toThrow(/impossible date/);
    expect(() => parseDate("2026-13-45")).toThrow(/impossible date/);
    expect(() => parseDate("2/30/2026")).toThrow(/impossible date/);
    expect(() => parseDate("2026-02-30")).toThrow(/impossible date/);
  });

  it("leap day: valid in a leap year, impossible otherwise", () => {
    expect(parseDate("2028-02-29")).toBe("2028-02-29"); // leap
    expect(() => parseDate("2026-02-29")).toThrow(/impossible date/); // not
  });
});
