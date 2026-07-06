import { describe, it, expect } from "vitest";
import { datesInText, pickExpiration } from "../ocr-date";

/**
 * The OCR trust layer's parser: a wrong guess is worse than no guess, so the
 * failure modes matter more than the happy paths.
 */
describe("datesInText + pickExpiration", () => {
  const pick = (t: string) => pickExpiration(datesInText(t));

  it("reads common cert formats", () => {
    expect(pick("EXPIRES: 06/15/2027")).toBe("2027-06-15");
    expect(pick("EXP 2027-06-15 ISSUED 2026-06-15")).toBe("2027-06-15");
    expect(pick("Valid through 15 Jun 2027")).toBe("2027-06-15");
    expect(pick("Expiration Date: June 15, 2027")).toBe("2027-06-15");
    expect(pick("exp 6-15-27")).toBe("2027-06-15");
  });

  it("month/year only → end of that month", () => {
    expect(pick("EXP 06/2027")).toBe("2027-06-30");
  });

  it("prefers the LATER future date when issue + expiry both appear", () => {
    expect(pick("INSPECTED 12/2025 NEXT DUE 12/2026 SERIAL 88-1234")).toBe("2026-12-31");
  });

  it("only past dates on the photo → NO guess (never pre-fill a lie)", () => {
    expect(pick("Issued 01/10/2020 Expires 01/10/2021")).toBeNull();
  });

  it("photo with no readable dates → null, not a crash", () => {
    expect(pick("no dates here at all serial 123456")).toBeNull();
    expect(pick("")).toBeNull();
  });

  it("garbage that looks like dates is rejected (month 13, day 45)", () => {
    expect(pick("13/45/2027 garbage 99/99/99")).toBeNull();
  });

  it("implausibly far future (>15y) is rejected", () => {
    expect(pick("EXP 01/01/2085")).toBeNull();
  });
});
