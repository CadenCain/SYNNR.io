import { describe, it, expect } from "vitest";
import { isAlertDue, alertHorizon } from "../alert-window";
import { localToday } from "../status";

/**
 * The boundary a customer's $10k rides on. Every case here is a cert date a
 * real shop will hit; if one of these flips the wrong way, a warning either
 * doesn't go out (customer eats an NPT day) or goes out a day early
 * (annoying, survivable). Asymmetric stakes — when in doubt, alert.
 */

const TODAY = "2026-08-11";
const LEAD = 30;

describe("isAlertDue — the sweep's due window (lead = 30 days)", () => {
  it("expires TODAY → alert (it dies at midnight; today is the last chance)", () => {
    expect(isAlertDue("2026-08-11", TODAY, LEAD, false)).toBe(true);
  });

  it("expires in exactly 30 days (on the horizon) → alert", () => {
    expect(isAlertDue("2026-09-10", TODAY, LEAD, false)).toBe(true);
  });

  it("expires in 31 days (one past the horizon) → NO alert yet", () => {
    expect(isAlertDue("2026-09-11", TODAY, LEAD, false)).toBe(false);
  });

  it("expired YESTERDAY and never alerted → still alerts (lapsed must never stay silent)", () => {
    expect(isAlertDue("2026-08-10", TODAY, LEAD, false)).toBe(true);
  });

  it("expired long ago and never alerted → still alerts", () => {
    expect(isAlertDue("2025-01-01", TODAY, LEAD, false)).toBe(true);
  });

  it("no expiration on file → alerts (unverifiable is failing, not fine)", () => {
    expect(isAlertDue(null, TODAY, LEAD, false)).toBe(true);
  });

  it("already alerted → silent, whatever the date (one alert per item)", () => {
    expect(isAlertDue("2026-08-11", TODAY, LEAD, true)).toBe(false);
    expect(isAlertDue(null, TODAY, LEAD, true)).toBe(false);
  });

  it("custom lead window is respected (7-day lead)", () => {
    expect(isAlertDue("2026-08-18", TODAY, 7, false)).toBe(true);  // day 7
    expect(isAlertDue("2026-08-19", TODAY, 7, false)).toBe(false); // day 8
  });
});

describe("horizon math across calendar traps", () => {
  it("leap day: horizon lands on Feb 29 in a leap year without drifting", () => {
    expect(alertHorizon("2028-01-30", 30)).toBe("2028-02-29"); // 2028 is a leap year
    expect(alertHorizon("2027-01-30", 30)).toBe("2027-03-01"); // 2027 is not
  });

  it("a cert expiring ON leap day alerts inside its window", () => {
    expect(isAlertDue("2028-02-29", "2028-02-01", 30, false)).toBe(true);
  });

  it("horizon crosses a year boundary", () => {
    expect(alertHorizon("2026-12-15", 30)).toBe("2027-01-14");
    expect(isAlertDue("2027-01-14", "2026-12-15", 30, false)).toBe(true);
    expect(isAlertDue("2027-01-15", "2026-12-15", 30, false)).toBe(false);
  });

  it("horizon crosses the US DST change without gaining or losing a day", () => {
    // DST starts Mar 8 2026; naive Date-ms math would drift an hour → a day.
    expect(alertHorizon("2026-03-01", 14)).toBe("2026-03-15");
  });
});

describe("timezone: server-UTC evening vs the customer's Central morning", () => {
  it("at 2am UTC (9pm CT the previous day) the sweep still uses the CT day", () => {
    // The cron fires at 11:30 UTC, but if it ever ran at a UTC hour where the
    // dates disagree, the customer's local day must win — a cert 'expiring
    // today' in Texas is not 'expired yesterday' because the server is in UTC.
    const ctDay = localToday(new Date("2026-08-12T02:00:00Z"));
    expect(ctDay).toBe("2026-08-11");
    // and an item expiring on that CT day still alerts
    expect(isAlertDue("2026-08-11", ctDay, 30, false)).toBe(true);
  });
});
