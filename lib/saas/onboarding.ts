import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampYards, yardsToMake } from "./plan";
import { isBillableYard } from "./billing-rules";
import { yardPriceId } from "./stripe-setup";

/**
 * Getting a shop from "Continue to payment" to a working account. Shared by
 * the onboarding step (straight to Stripe), the payment page (for a canceled
 * checkout or a restart), the success page, and the webhook.
 */

/**
 * Make the yards a shop paid for: the first named what they typed at
 * onboarding, the rest numbered. Safe to run twice at once (the success
 * page and the webhook both call it): yard names are unique per company,
 * so a second "Yard 2" is skipped, and it never makes more than they paid for.
 */
export async function provisionPaidYards(admin: SupabaseClient, companyId: string, paidFor: number): Promise<string[]> {
  const [{ data: co }, { data: yardRows }] = await Promise.all([
    admin.from("saas_companies").select("first_yard_name").eq("id", companyId).maybeSingle(),
    admin.from("saas_yards").select("name").eq("company_id", companyId),
  ]);
  const existing = ((yardRows ?? []) as { name: string }[]).map((y) => y.name).filter(isBillableYard);
  const names = yardsToMake(paidFor, (co as { first_yard_name: string | null } | null)?.first_yard_name, existing);
  if (!names.length) return [];
  const { error } = await admin.from("saas_yards")
    .upsert(names.map((name) => ({ company_id: companyId, name })), { onConflict: "company_id,name", ignoreDuplicates: true });
  if (error) throw new Error(`yards: ${error.message}`);
  return names;
}

/** A Stripe Checkout for N yards at $500 each a month, tied to this company. */
export async function createYardCheckout(stripe: Stripe, admin: SupabaseClient, args: {
  companyId: string; companyName: string; userEmail: string | null; quantity: number; origin: string;
}): Promise<{ url: string; quantity: number; amountTotal: number | null }> {
  const quantity = clampYards(args.quantity);
  const price = await yardPriceId(stripe);

  const { data: row } = await admin.from("saas_companies")
    .select("stripe_customer_id, contact_name, contact_email, contact_phone").eq("id", args.companyId).maybeSingle();
  const c = row as { stripe_customer_id: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null } | null;

  // One Stripe customer per company. A stale one (deleted, or from the other
  // Stripe mode) is replaced.
  let customerId = c?.stripe_customer_id ?? null;
  if (customerId) {
    const ok = await stripe.customers.retrieve(customerId).then((x) => !("deleted" in x && x.deleted)).catch(() => false);
    if (!ok) customerId = null;
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: args.companyName,
      email: c?.contact_email || args.userEmail || undefined,
      phone: c?.contact_phone || undefined,
      metadata: { company_id: args.companyId, contact_name: c?.contact_name ?? "" },
    });
    customerId = customer.id;
    await admin.from("saas_companies").update({ stripe_customer_id: customerId }).eq("id", args.companyId);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: args.companyId,
    line_items: [{ price, quantity }],
    subscription_data: { metadata: { company_id: args.companyId } },
    metadata: { company_id: args.companyId },
    customer_update: { name: "auto", address: "auto" },
    payment_method_collection: "always",
    allow_promotion_codes: false,
    success_url: `${args.origin}/onboarding/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${args.origin}/onboarding/billing?canceled=1`,
  });
  if (!session.url) throw new Error("Stripe didn't return a checkout link.");
  return { url: session.url, quantity, amountTotal: session.amount_total };
}

/** The site's own address for Stripe to send people back to. */
export function siteOrigin(h: Headers, fallbackUrl?: string): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  return fallbackUrl ? new URL(fallbackUrl).origin : "https://www.synnr.io";
}
