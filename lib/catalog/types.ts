/**
 * SYNNR marketplace — product catalog & pricing types.
 *
 * One parent brand, many products (the "Anduril model"). Each product declares
 * its own pricing model so the platform can sell a one-man shop a single seat
 * and a CEO fifty seats through the exact same flow.
 *
 * This module is pure (no DB, no Stripe, no network) so the seat/quota/overage
 * math and the entitlement rules are unit-testable cardless.
 */

export const PRODUCT_STATUS = ["live", "coming_soon"] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const PRICING_MODELS = ["per_seat", "flat", "metered", "hybrid"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

/** A volume band: from `minSeats` up (until the next band), this per-seat rate applies. */
export type VolumeBand = {
  minSeats: number;
  /** USD per seat / month. null = "talk to us" (sales-assisted, no self-serve price). */
  pricePerSeatUsd: number | null;
  label: string;
};

export type ProductPricing = {
  model: PricingModel;
  /** Per-seat volume bands (per_seat / hybrid). Sorted ascending by minSeats. */
  bands?: VolumeBand[];
  /** Flat per-org monthly price (flat model). */
  flatMonthlyUsd?: number;
  /** Included usage quota per seat / month, pooled across the org (hybrid/metered). */
  includedQuotaPerSeat?: number;
  /** Price per unit beyond the pooled quota (hybrid/metered). */
  overagePerUnitUsd?: number;
  /** The unit that quota/overage is measured in (e.g. "sheet"). */
  unit?: string;
  /** Free-trial length in days (0 = none). */
  trialDays: number;
  /** Self-serve ceiling; seat counts above this route to "talk to us". */
  selfServeMaxSeats?: number;
};

export type Product = {
  slug: string;
  name: string;
  tagline: string;
  status: ProductStatus;
  pricing: ProductPricing;
  /** Free for any signed-in user (no subscription/seat needed) — early-access products. */
  free?: boolean;
  /** What one seat unlocks, for the product page. */
  seatUnlocks: string;
  /** The boring, expensive problem this app kills (product page). */
  problem?: string;
  /** A few concrete things it does (product page bullets). */
  bullets?: string[];
};

/** A live subscription's state, as the entitlement layer needs to see it. */
export type SubscriptionState = {
  productSlug: string;
  /** Stripe status; only "active"/"trialing" grant access. */
  status: string;
  seats: number;
  /** ISO timestamp the current period ends. */
  periodEnd?: string | null;
};

export type EntitlementContext = {
  /** Active/trialing subscriptions the org holds. */
  subscriptions: SubscriptionState[];
  /** Product slugs the *user* holds a seat for in this org. */
  userSeatProducts: string[];
};
