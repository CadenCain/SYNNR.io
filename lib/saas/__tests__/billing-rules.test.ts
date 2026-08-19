import { describe, it, expect } from "vitest";
import { isBillableYard, desiredYardQuantity, canCreateBillable, yardBillingDrift, SAMPLE_YARD_NAME } from "../billing-rules";

/**
 * The money math. Every case here is a way somebody either gets yards for
 * free or pays for yards they don't have — the two failure modes a per-yard
 * price cannot survive.
 */

describe("desiredYardQuantity — add a yard, pay for a yard", () => {
  it("adding a yard bumps the quantity (1 → 2)", () => {
    expect(desiredYardQuantity(2)).toBe(2);
  });

  it("deleting a yard drops the quantity (2 → 1) — nobody pays for a dead yard", () => {
    expect(desiredYardQuantity(1)).toBe(1);
  });

  it("floor of one: zero yards still bills one, never zero (the seat on the books)", () => {
    expect(desiredYardQuantity(0)).toBe(1);
  });

  it("scales flat — 30 yards is 30, not 9", () => {
    expect(desiredYardQuantity(30)).toBe(30);
  });
});

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

describe("canCreateBillable — the free state is read-and-export only", () => {
  it("active and past_due can create (grace window on a failed card, not a mid-job lockout)", () => {
    expect(canCreateBillable("active")).toBe(true);
    expect(canCreateBillable("past_due")).toBe(true);
  });

  it("no subscription, canceled, or anything else: creation blocked", () => {
    expect(canCreateBillable("none")).toBe(false);
    expect(canCreateBillable("canceled")).toBe(false);
    expect(canCreateBillable("incomplete")).toBe(false);
    expect(canCreateBillable("")).toBe(false);
  });
});

describe("yardBillingDrift — the nightly reconcile's verdict", () => {
  it("watching 30 yards, billing 9 → flagged with the expected number", () => {
    const out = yardBillingDrift([{ companyName: "WILDCAT", stripeQuantity: 9, billableYards: 30 }]);
    expect(out).toEqual([{ companyName: "WILDCAT", stripeQuantity: 9, billableYards: 30, expected: 30 }]);
  });

  it("overbilling drifts too — paying for 3, has 2", () => {
    const out = yardBillingDrift([{ companyName: "A", stripeQuantity: 3, billableYards: 2 }]);
    expect(out[0].expected).toBe(2);
  });

  it("in-step companies stay silent", () => {
    expect(yardBillingDrift([{ companyName: "A", stripeQuantity: 2, billableYards: 2 }])).toEqual([]);
  });

  it("the min-1 floor is not drift: zero billable yards billed at 1 is correct", () => {
    expect(yardBillingDrift([{ companyName: "A", stripeQuantity: 1, billableYards: 0 }])).toEqual([]);
  });
});
