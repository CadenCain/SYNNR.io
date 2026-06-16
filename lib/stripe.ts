import Stripe from "stripe";

/** Server-only Stripe client. Returns null when not configured (demo mode). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/** TallyShot subscription tiers. */
export const PLAN_NAMES: Record<string, string> = {
  starter: "SYNNR TallyShot — Starter",
  pro: "SYNNR TallyShot — Pro",
  fleet: "SYNNR TallyShot — Fleet",
};

/** Legacy plan keys → current tiers (keeps old links/checkout sessions working). */
const PLAN_ALIASES: Record<string, string> = {
  growth: "fleet",
  recover: "starter",
  command: "fleet",
};

export function normalizePlan(plan: string): string {
  return PLAN_ALIASES[plan] ?? plan;
}

/** Stripe Price ID for a legacy per-company plan (kept for old checkout links). */
export function priceFor(plan: string): string | undefined {
  switch (normalizePlan(plan)) {
    case "starter": return process.env.STRIPE_PRICE_STARTER;
    case "pro": return process.env.STRIPE_PRICE_PRO;
    case "fleet": return process.env.STRIPE_PRICE_FLEET;
    default: return undefined;
  }
}

/**
 * Per-seat Stripe Price ID for a marketplace product (quantity = seats).
 * One price object per product, with volume tiers configured in Stripe so the
 * band discounts apply automatically. Env name: STRIPE_PRICE_<SLUG_UPPER>_SEAT,
 * e.g. STRIPE_PRICE_TALLYSHOT_SEAT.
 */
export function priceForProduct(slug: string): string | undefined {
  const key = `STRIPE_PRICE_${slug.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_SEAT`;
  return process.env[key];
}

/**
 * Metered overage Stripe Price ID for a product, billed per unit over the
 * pooled quota. Env: STRIPE_PRICE_<SLUG_UPPER>_METER (e.g.
 * STRIPE_PRICE_TALLYSHOT_METER). Undefined until set → metered billing is a
 * no-op, so checkout and saves keep working.
 */
export function meterPriceForProduct(slug: string): string | undefined {
  const key = `STRIPE_PRICE_${slug.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_METER`;
  return process.env[key];
}
