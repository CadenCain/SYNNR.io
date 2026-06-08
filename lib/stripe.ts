import Stripe from "stripe";

/** Server-only Stripe client. Returns null when not configured (demo mode). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export const PLAN_NAMES: Record<string, string> = {
  recover: "SYNNR Recover",
  command: "SYNNR Command",
};

/** Stripe Price ID for a plan (created in your Stripe dashboard, set via env). */
export function priceFor(plan: string): string | undefined {
  if (plan === "recover") return process.env.STRIPE_PRICE_RECOVER;
  if (plan === "command") return process.env.STRIPE_PRICE_COMMAND;
  return undefined;
}
