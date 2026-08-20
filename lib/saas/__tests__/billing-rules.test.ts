import { describe, it, expect } from "vitest";
import { isBillableYard, SAMPLE_YARD_NAME } from "../billing-rules";

/**
 * What remains of the auto-scaling era's rules: the demo yard is free. The
 * cap math, writability, and role matrix moved to entitlements.test.ts when
 * the owner switched to the hard-cap model (2026-08-19).
 */


describe("isBillableYard — the demo is free, real yards are not", () => {
  it("the sample yard never counts toward billing", () => {
    expect(isBillableYard(SAMPLE_YARD_NAME)).toBe(false);
  });

  it("everything else counts, including names that merely look demo-ish", () => {
    expect(isBillableYard("Odessa North")).toBe(true);
    expect(isBillableYard("demo")).toBe(true);
    expect(isBillableYard("Sample Yard")).toBe(true);
  });
});


