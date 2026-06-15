import type { Product, VolumeBand } from "./types";

/** The volume band that applies for a given seat count (highest minSeats ≤ seats). */
export function resolveBand(bands: VolumeBand[], seats: number): VolumeBand | undefined {
  const sorted = [...bands].sort((a, b) => a.minSeats - b.minSeats);
  let match: VolumeBand | undefined;
  for (const b of sorted) if (seats >= b.minSeats) match = b;
  return match ?? sorted[0];
}

/** Per-seat USD/mo for this seat count. null = "talk to us" (no self-serve price). */
export function pricePerSeat(product: Product, seats: number): number | null {
  const { pricing } = product;
  if (pricing.model === "flat") return null; // flat isn't per-seat
  if (!pricing.bands?.length) return null;
  const band = resolveBand(pricing.bands, seats);
  return band?.pricePerSeatUsd ?? null;
}

/** Pooled included usage across the whole org (per-seat quota × seats). */
export function pooledQuota(product: Product, seats: number): number {
  return (product.pricing.includedQuotaPerSeat ?? 0) * Math.max(0, seats);
}

/** A seat count is self-serve when it's at/under the product's self-serve ceiling. */
export function isSelfServe(product: Product, seats: number): boolean {
  const max = product.pricing.selfServeMaxSeats;
  if (max == null) return true;
  return seats <= max;
}

export type CostEstimate = {
  seats: number;
  perSeatUsd: number;
  seatCostUsd: number;
  includedUnits: number;
  usageUnits: number;
  overageUnits: number;
  overageUsd: number;
  totalUsd: number;
  unit?: string;
};

/**
 * Estimate a month's bill: seats × per-seat band rate + metered overage beyond
 * the pooled quota. Returns null when the seat count isn't self-serve priced
 * (50+ "talk to us") so callers route to sales instead of showing a number.
 */
export function estimateMonthlyUsd(product: Product, seats: number, usageUnits = 0): CostEstimate | null {
  const { pricing } = product;

  if (pricing.model === "flat") {
    const flat = pricing.flatMonthlyUsd ?? 0;
    return {
      seats,
      perSeatUsd: 0,
      seatCostUsd: flat,
      includedUnits: 0,
      usageUnits,
      overageUnits: 0,
      overageUsd: 0,
      totalUsd: round2(flat),
      unit: pricing.unit,
    };
  }

  if (!isSelfServe(product, seats)) return null;

  const perSeatUsd = pricePerSeat(product, seats);
  if (perSeatUsd == null) return null;

  const seatCostUsd = perSeatUsd * seats;
  const includedUnits = pooledQuota(product, seats);
  const overageUnits = Math.max(0, usageUnits - includedUnits);
  const overageUsd = overageUnits * (pricing.overagePerUnitUsd ?? 0);

  return {
    seats,
    perSeatUsd,
    seatCostUsd: round2(seatCostUsd),
    includedUnits,
    usageUnits,
    overageUnits,
    overageUsd: round2(overageUsd),
    totalUsd: round2(seatCostUsd + overageUsd),
    unit: pricing.unit,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
