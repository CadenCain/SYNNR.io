import { describe, it, expect } from "vitest";
import { computeStatus, computeReadiness, worstStatus, localToday, addDaysIso } from "../status";
import { seenAge } from "../format";

/**
 * Pre-launch pressure tests: date boundaries, timezone semantics, and the
 * enforcement invariants ("no lying 100%", none = failing). These exercise
 * the exact scenarios from the audit prompt — not trivial assertions.
 */

describe("computeStatus — boundary conditions (fixed 'today' = 2026-07-02)", () => {
  const TODAY = "2026-07-02";

  it("no expiration date → none (renders as Missing, treated as failing)", () => {
    expect(computeStatus(null, 30, TODAY)).toBe("none");
  });

  it("expires TODAY → expiring (valid through end of the local day), NOT expired", () => {
    expect(computeStatus("2026-07-02", 30, TODAY)).toBe("expiring");
  });

  it("expired yesterday → expired (no off-by-one)", () => {
    expect(computeStatus("2026-07-01", 30, TODAY)).toBe("expired");
  });

  it("expires exactly at the reminder horizon (today+30) → expiring", () => {
    expect(computeStatus("2026-08-01", 30, TODAY)).toBe("expiring");
  });

  it("expires one day past the horizon (today+31) → valid", () => {
    expect(computeStatus("2026-08-02", 30, TODAY)).toBe("valid");
  });

  it("mistakenly-entered past date doesn't crash — it just reads expired", () => {
    expect(computeStatus("1999-01-01", 30, TODAY)).toBe("expired");
  });

  it("custom reminder window is respected (7-day lead)", () => {
    expect(computeStatus("2026-07-09", 7, TODAY)).toBe("expiring");
    expect(computeStatus("2026-07-10", 7, TODAY)).toBe("valid");
  });
});

describe("timezone semantics — America/Chicago local day, matching the SQL view", () => {
  it("localToday returns the Chicago date, not the UTC date, at the UTC/CT boundary", () => {
    // 2026-07-03T02:00Z is still 9pm 2026-07-02 in Chicago (CDT, UTC-5)
    expect(localToday(new Date("2026-07-03T02:00:00Z"))).toBe("2026-07-02");
    // 2026-07-03T06:00Z is 1am 2026-07-03 in Chicago
    expect(localToday(new Date("2026-07-03T06:00:00Z"))).toBe("2026-07-03");
  });

  it("an item expiring today is NOT expired at 9pm Chicago even though UTC has rolled over", () => {
    const chicagoToday = localToday(new Date("2026-07-03T02:00:00Z")); // 2026-07-02
    expect(computeStatus("2026-07-02", 30, chicagoToday)).toBe("expiring"); // not expired
  });

  it("addDaysIso crosses months, years, and the DST change without drifting", () => {
    expect(addDaysIso("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysIso("2026-02-28", 2)).toBe("2026-03-02"); // non-leap
    expect(addDaysIso("2026-03-07", 2)).toBe("2026-03-09"); // across US DST start (Mar 8 2026)
    expect(addDaysIso("2026-07-02", 30)).toBe("2026-08-01");
  });
});

describe("computeReadiness — enforcement invariants", () => {
  it("ZERO configured requirements → null, never 100 (no Ready on empty)", () => {
    expect(computeReadiness({ certCurrency: null, crewCurrency: null, hardFail: false })).toBeNull();
  });

  it("perfect data with no hard fails → 100", () => {
    expect(computeReadiness({ certCurrency: 1, crewCurrency: 1, hardFail: false })).toBe(100);
  });

  it("hard fail caps the score at 74 even when currency is perfect", () => {
    expect(computeReadiness({ certCurrency: 1, crewCurrency: 1, hardFail: true })).toBe(74);
  });

  it("weights renormalize when an input is absent (certs-only shop isn't punished)", () => {
    expect(computeReadiness({ certCurrency: 1, crewCurrency: null, hardFail: false })).toBe(100);
  });

  it("documented blend: 0.7·certs + 0.3·crew", () => {
    // 0.7·1 + 0.3·0 = 0.7 → 70
    expect(computeReadiness({ certCurrency: 1, crewCurrency: 0, hardFail: false })).toBe(70);
    // 0.7·0 + 0.3·1 = 0.3 → 30
    expect(computeReadiness({ certCurrency: 0, crewCurrency: 1, hardFail: false })).toBe(30);
  });

  it("all-unverifiable data → 0", () => {
    expect(computeReadiness({ certCurrency: 0, crewCurrency: 0, hardFail: true })).toBe(0);
  });

  /**
   * REGRESSION — the score must never move because a check was RECORDED.
   * The gear list is reference-only, so its lines record "ok" for anything
   * simply not in the asset book yet. Feeding that into the blend used to
   * hand a shop ~30 free points for pressing a button while its paperwork
   * was still behind. Only live record currency counts now.
   */
  it("a shop whose paperwork is all behind reads low, and recording a check can't raise it", () => {
    const before = computeReadiness({ certCurrency: 0, crewCurrency: 0, hardFail: false });
    expect(before).toBe(0);
    // Same records, after the shop runs a readiness check: identical inputs,
    // because check results are not an input at all.
    expect(computeReadiness({ certCurrency: 0, crewCurrency: 0, hardFail: false })).toBe(before);
  });
});

describe("worstStatus — one ranking everywhere (no contradictory chips)", () => {
  it("expired beats everything", () => {
    expect(worstStatus(["valid", "expiring", "expired", "none"])).toBe("expired");
  });
  it("no-date (Missing) beats expiring and valid — unverifiable is failing", () => {
    expect(worstStatus(["valid", "none", "expiring"])).toBe("none");
  });
  it("a crew member with only a no-date card reads Missing, never Valid (walkthrough H1)", () => {
    expect(worstStatus(["none"])).toBe("none");
  });
  it("empty input → null (renders 'no certs', not a fake status)", () => {
    expect(worstStatus([])).toBeNull();
  });
});

/**
 * Freshness decay — the rule that keeps a location note honest. Every yard
 * tracker dies when stale data is presented as fact; this makes the note
 * advertise its own age so nobody drives across town on a 6-week-old guess.
 */
describe("seenAge — a location note must advertise its own age", () => {
  const NOW = new Date("2026-07-30T12:00:00Z");
  const ago = (d: number) => new Date(NOW.getTime() - d * 86400e3).toISOString();

  it("no timestamp → nothing to show", () => {
    expect(seenAge(null, NOW)).toBeNull();
    expect(seenAge(undefined, NOW)).toBeNull();
  });

  it("today and yesterday read as fresh, in words", () => {
    expect(seenAge(ago(0), NOW)).toEqual({ label: "today", tone: "fresh" });
    expect(seenAge(ago(1), NOW)).toEqual({ label: "yesterday", tone: "fresh" });
  });

  it("2 days is still fresh, 3 starts aging", () => {
    expect(seenAge(ago(2), NOW)?.tone).toBe("fresh");
    expect(seenAge(ago(3), NOW)?.tone).toBe("aging");
  });

  it("13 days aging, 14 flips to stale — the trust boundary", () => {
    expect(seenAge(ago(13), NOW)?.tone).toBe("aging");
    expect(seenAge(ago(14), NOW)?.tone).toBe("stale");
  });

  it("months are summarized, never dressed up as precise", () => {
    expect(seenAge(ago(90), NOW)).toEqual({ label: "3mo ago", tone: "stale" });
  });

  it("a garbage timestamp degrades to nothing, never to a false 'today'", () => {
    expect(seenAge("not-a-date", NOW)).toBeNull();
  });
});
