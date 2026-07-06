import { describe, it, expect } from "vitest";
import { computeStatus, computeReadiness, worstStatus, localToday, addDaysIso } from "../status";

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
    expect(computeReadiness({ certCurrency: null, loadoutCompleteness: null, crewCurrency: null, hardFail: false })).toBeNull();
  });

  it("perfect data with no hard fails → 100", () => {
    expect(computeReadiness({ certCurrency: 1, loadoutCompleteness: 1, crewCurrency: 1, hardFail: false })).toBe(100);
  });

  it("hard fail caps the score at 74 even when currency is perfect", () => {
    expect(computeReadiness({ certCurrency: 1, loadoutCompleteness: 1, crewCurrency: 1, hardFail: true })).toBe(74);
  });

  it("weights renormalize when an input is absent (certs-only shop isn't punished)", () => {
    expect(computeReadiness({ certCurrency: 1, loadoutCompleteness: null, crewCurrency: null, hardFail: false })).toBe(100);
  });

  it("documented blend: 0.5·certs + 0.3·loadout + 0.2·crew", () => {
    // 0.5·1 + 0.3·0.667 + 0.2·0 = 0.7 → 70
    expect(computeReadiness({ certCurrency: 1, loadoutCompleteness: 2 / 3, crewCurrency: 0, hardFail: false })).toBe(70);
  });

  it("all-unverifiable data → 0", () => {
    expect(computeReadiness({ certCurrency: 0, loadoutCompleteness: null, crewCurrency: 0, hardFail: true })).toBe(0);
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
