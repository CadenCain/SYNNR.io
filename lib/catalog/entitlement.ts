import type { EntitlementContext, SubscriptionState } from "./types";
import { getProduct } from "./products";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export type EntitlementCheck = {
  allowed: boolean;
  /** "seat" = via a held seat, "flat" = org-wide license, null = denied. */
  via: "seat" | "flat" | null;
  reason: string;
};

/**
 * The single access rule, enforced server-side on every product route:
 * a user may use product X iff the org holds an active (or trialing)
 * subscription for X AND either the user holds a seat for X, or X is a flat
 * org-wide license. UI gating is not enough — call this on the server.
 */
export function canUseProduct(ctx: EntitlementContext, slug: string): EntitlementCheck {
  const sub = ctx.subscriptions.find((s) => s.productSlug === slug);
  if (!sub || !ACTIVE_STATUSES.has(sub.status)) {
    return { allowed: false, via: null, reason: "Your organization has no active subscription for this app." };
  }

  const product = getProduct(slug);
  if (product?.pricing.model === "flat") {
    return { allowed: true, via: "flat", reason: "Org-wide license." };
  }

  if (ctx.userSeatProducts.includes(slug)) {
    return { allowed: true, via: "seat", reason: "You hold a seat for this app." };
  }

  return {
    allowed: false,
    via: null,
    reason: "Your org subscribes to this app, but you haven't been assigned a seat. Ask an admin.",
  };
}

/** Seats granted vs. assigned, for the team screen. */
export function seatUsage(sub: SubscriptionState | undefined, assignedCount: number) {
  const total = sub?.seats ?? 0;
  const used = Math.min(assignedCount, total);
  return { total, used, available: Math.max(0, total - used) };
}

export function hasOpenSeat(sub: SubscriptionState | undefined, assignedCount: number): boolean {
  return seatUsage(sub, assignedCount).available > 0;
}
