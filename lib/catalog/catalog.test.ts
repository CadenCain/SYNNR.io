/**
 * Marketplace catalog tests — pricing math + entitlement rules, cardless:
 *   node --import tsx --test lib/catalog/catalog.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

import { getProduct } from "./products";
import { pricePerSeat, estimateMonthlyUsd, isSelfServe, pooledQuota, resolveBand } from "./pricing";
import { canUseProduct, seatUsage, hasOpenSeat } from "./entitlement";
import type { EntitlementContext } from "./types";

const tally = getProduct("tallyshot")!;

test("volume bands resolve by seat count", () => {
  const bands = tally.pricing.bands!;
  assert.equal(resolveBand(bands, 1)!.pricePerSeatUsd, 39);
  assert.equal(resolveBand(bands, 9)!.pricePerSeatUsd, 39);
  assert.equal(resolveBand(bands, 10)!.pricePerSeatUsd, 34);
  assert.equal(resolveBand(bands, 24)!.pricePerSeatUsd, 34);
  assert.equal(resolveBand(bands, 25)!.pricePerSeatUsd, 29);
  assert.equal(resolveBand(bands, 60)!.pricePerSeatUsd, 25);
});

test("per-seat price follows the bands", () => {
  assert.equal(pricePerSeat(tally, 1), 39);
  assert.equal(pricePerSeat(tally, 12), 34);
  assert.equal(pricePerSeat(tally, 30), 29);
});

test("solo estimate: 1 seat, within quota = just the seat", () => {
  const e = estimateMonthlyUsd(tally, 1, 300)!;
  assert.equal(e.perSeatUsd, 39);
  assert.equal(e.seatCostUsd, 39);
  assert.equal(e.includedUnits, 500); // 1 seat × 500 pooled
  assert.equal(e.overageUnits, 0);
  assert.equal(e.overageUsd, 0);
  assert.equal(e.totalUsd, 39);
});

test("overage kicks in beyond the pooled quota", () => {
  // 2 seats → pooled 1000 sheets included; use 1200 → 200 over @ $0.05 = $10
  const e = estimateMonthlyUsd(tally, 2, 1200)!;
  assert.equal(e.includedUnits, 1000);
  assert.equal(e.overageUnits, 200);
  assert.equal(e.overageUsd, 10);
  assert.equal(e.seatCostUsd, 78); // 2 × $39
  assert.equal(e.totalUsd, 88);
});

test("volume band lowers per-seat cost for a fleet", () => {
  // CEO buys 30 seats @ $29, no overage
  const e = estimateMonthlyUsd(tally, 30, 5000)!;
  assert.equal(e.perSeatUsd, 29);
  assert.equal(e.seatCostUsd, 870);
  assert.equal(e.includedUnits, 15000);
  assert.equal(e.overageUnits, 0);
  assert.equal(e.totalUsd, 870);
});

test("50+ seats is not self-serve → estimate returns null (talk to us)", () => {
  assert.equal(isSelfServe(tally, 49), true);
  assert.equal(isSelfServe(tally, 50), false);
  assert.equal(estimateMonthlyUsd(tally, 50, 0), null);
});

test("pooled quota scales with seats", () => {
  assert.equal(pooledQuota(tally, 1), 500);
  assert.equal(pooledQuota(tally, 10), 5000);
});

// --- entitlement ---

const baseCtx = (over: Partial<EntitlementContext> = {}): EntitlementContext => ({
  subscriptions: [{ productSlug: "tallyshot", status: "active", seats: 5 }],
  userSeatProducts: ["tallyshot"],
  ...over,
});

test("active sub + held seat → allowed via seat", () => {
  const r = canUseProduct(baseCtx(), "tallyshot");
  assert.equal(r.allowed, true);
  assert.equal(r.via, "seat");
});

test("no subscription → denied", () => {
  const r = canUseProduct(baseCtx({ subscriptions: [] }), "tallyshot");
  assert.equal(r.allowed, false);
  assert.equal(r.via, null);
});

test("sub but no seat → denied with admin hint", () => {
  const r = canUseProduct(baseCtx({ userSeatProducts: [] }), "tallyshot");
  assert.equal(r.allowed, false);
  assert.match(r.reason, /seat/i);
});

test("canceled/past_due status → denied", () => {
  const r = canUseProduct(
    baseCtx({ subscriptions: [{ productSlug: "tallyshot", status: "canceled", seats: 5 }] }),
    "tallyshot"
  );
  assert.equal(r.allowed, false);
});

test("trialing status grants access", () => {
  const r = canUseProduct(
    baseCtx({ subscriptions: [{ productSlug: "tallyshot", status: "trialing", seats: 1 }] }),
    "tallyshot"
  );
  assert.equal(r.allowed, true);
});

test("seat usage + open-seat math", () => {
  const sub = { productSlug: "tallyshot", status: "active", seats: 5 };
  assert.deepEqual(seatUsage(sub, 3), { total: 5, used: 3, available: 2 });
  assert.equal(hasOpenSeat(sub, 5), false);
  assert.equal(hasOpenSeat(sub, 4), true);
});
