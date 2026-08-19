/**
 * The billing rules, pure — every decision about who pays for what, extracted
 * so tests pin them instead of five call sites each interpreting "per yard"
 * slightly differently.
 *
 * The price is $500 per BILLABLE yard per month, minimum one. Billable
 * excludes the built-in demo yard: "Load sample yard" exists so a shop can
 * see the product working — charging $500 for clicking the demo button would
 * be the fastest way to lose a customer on day one.
 */

export const SAMPLE_YARD_NAME = "Sample Yard (demo)";

export function isBillableYard(name: string): boolean {
  return name !== SAMPLE_YARD_NAME;
}

/** Stripe subscription quantity for a given billable-yard count. Floor of 1:
 *  the subscription is "a yard on the books", not "zero yards for free". */
export function desiredYardQuantity(billableYardCount: number): number {
  return Math.max(1, billableYardCount);
}

/** Can this subscription state create billable records (yards, units, certs)?
 *  past_due keeps write access — a failed card gets a grace window and dunning
 *  emails from Stripe, not an instant lockout mid-job. Everything else
 *  (none, canceled, incomplete…) is read-and-export only. */
export function canCreateBillable(subscriptionStatus: string): boolean {
  return subscriptionStatus === "active" || subscriptionStatus === "past_due";
}

/** One company's billed-vs-actual comparison for the nightly reconcile. */
export interface BillingRow {
  companyName: string;
  stripeQuantity: number;
  billableYards: number;
}

/** Companies whose Stripe quantity disagrees with what they actually have.
 *  Uses desiredYardQuantity so the min-1 floor never reads as drift. */
export function yardBillingDrift(rows: BillingRow[]): (BillingRow & { expected: number })[] {
  return rows
    .map((r) => ({ ...r, expected: desiredYardQuantity(r.billableYards) }))
    .filter((r) => r.stripeQuantity !== r.expected);
}
