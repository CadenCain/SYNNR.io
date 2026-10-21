/**
 * The RollReady plan, pure: $500 per yard per month, whole crew, no seats.
 * One place for the price, the math, and who gets the load-out, so the
 * onboarding summary, checkout, the billing page, and the gates can't drift.
 */

export const PER_YARD_DOLLARS = 500;
export const PER_YARD_CENTS = PER_YARD_DOLLARS * 100;
export const MAX_YARDS = 50;
/** The Stripe price is found (or made) by this key, so code never trusts a pasted price id. */
export const YARD_PRICE_LOOKUP_KEY = "rollready_yard_monthly";
export const YARD_PRODUCT_NAME = "RollReady Yard";

/** A yard count someone typed, made sane: a whole number from 1 to 50. */
export function clampYards(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(MAX_YARDS, v);
}

export const monthlyDollars = (yards: number) => clampYards(yards) * PER_YARD_DOLLARS;
export const money = (dollars: number) => `$${dollars.toLocaleString("en-US")}`;

/** "$500 × 3 yards = $1,500 / month" */
export function planLine(yards: number): string {
  const y = clampYards(yards);
  return `${money(PER_YARD_DOLLARS)} × ${y} ${y === 1 ? "yard" : "yards"} = ${money(monthlyDollars(y))} / month`;
}

/**
 * The yards a shop gets the moment it pays: the first named what they typed
 * at onboarding (or "Main yard"), the rest "Yard 2", "Yard 3"... Skips names
 * they already have, and never makes more than they paid for.
 */
export function yardsToMake(paidFor: number, firstName: string | null | undefined, existing: string[]): string[] {
  const have = new Set(existing.map((n) => n.trim().toLowerCase()));
  const need = Math.max(0, clampYards(paidFor) - existing.length);
  const first = (firstName ?? "").trim().slice(0, 80) || "Main yard";
  const out: string[] = [];
  for (let i = 1; out.length < need && i <= MAX_YARDS + existing.length + 1; i++) {
    const name = i === 1 ? first : `Yard ${i}`;
    if (!have.has(name.toLowerCase())) { out.push(name); have.add(name.toLowerCase()); }
  }
  return out;
}

/** The throwaway login the live demo signs you into (never a real customer). */
export function isDemoUser(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  if (!user) return false;
  return user.user_metadata?.is_demo === true || (user.email ?? "").toLowerCase().endsWith("@demo.synnr.io");
}

/** Is a Stripe price really $500 a month per unit, in dollars? */
export function isYardPrice(p: { unit_amount: number | null; currency: string; recurring: { interval: string; interval_count?: number; usage_type?: string } | null; active?: boolean }): boolean {
  return p.unit_amount === PER_YARD_CENTS && p.currency === "usd" && p.recurring?.interval === "month"
    && (p.recurring.interval_count ?? 1) === 1 && (p.recurring.usage_type ?? "licensed") === "licensed" && p.active !== false;
}

export interface PlanCompany { subscription_status: string; comped: boolean; is_demo: boolean }

/** Paid up (or comped, or the demo): the full product, load-outs included. */
export function hasFullAccess(c: PlanCompany): boolean {
  return c.comped || c.is_demo || c.subscription_status === "active" || c.subscription_status === "past_due";
}

/**
 * Never finished paying: the app sends them to checkout instead of an empty
 * product. A shop that paid and then lapsed (canceled, unpaid) keeps reading
 * and exporting its records; only the load-out and every change are locked.
 */
export function mustSubscribe(c: PlanCompany): boolean {
  if (c.comped || c.is_demo) return false;
  return c.subscription_status === "none" || c.subscription_status === "incomplete" || c.subscription_status === "incomplete_expired";
}

/** Stripe's subscription statuses, as a shop manager would say them. */
export const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  past_due: "Payment failed, retrying",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Payment not finished",
  incomplete_expired: "Payment not finished",
  trialing: "Trial",
  paused: "Paused",
  none: "Not subscribed",
};
