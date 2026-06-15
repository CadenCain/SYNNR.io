/**
 * SYNNR marketplace catalog — products, pricing math, entitlement rules.
 * Pure domain layer (no DB/Stripe/network); the Stripe wiring, gating guards,
 * and product pages all build on this.
 */
export * from "./types";
export { PRODUCTS, getProduct, liveProducts } from "./products";
export { resolveBand, pricePerSeat, pooledQuota, isSelfServe, estimateMonthlyUsd, type CostEstimate } from "./pricing";
export { canUseProduct, seatUsage, hasOpenSeat, type EntitlementCheck } from "./entitlement";
