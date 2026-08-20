/**
 * The billing rules, pure — every decision about who pays for what, extracted
 * so tests pin them instead of five call sites each interpreting "per yard"
 * slightly differently.
 *
 * The price is $500 per BILLABLE yard per month. Billable
 * excludes the built-in demo yard: "Load sample yard" exists so a shop can
 * see the product working — charging $500 for clicking the demo button would
 * be the fastest way to lose a customer on day one.
 */

export const SAMPLE_YARD_NAME = "Sample Yard (demo)";

export function isBillableYard(name: string): boolean {
  return name !== SAMPLE_YARD_NAME;
}



