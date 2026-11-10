import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clampYards, yardsToMake } from "./plan";
import { isBillableYard } from "./billing-rules";
import { yardPriceId } from "./stripe-setup";
import { subscriptionFields } from "./stripe-events";
import { tellOwner, monthly } from "./tell-owner";

/** Subscription states that mean they're already paying (or Stripe is still collecting). */
const PAYING = new Set(["active", "trialing", "past_due", "unpaid"]);

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
    admin.from("saas_companies").select("first_yard_name, name, contact_name, contact_email, contact_phone").eq("id", companyId).maybeSingle(),
    admin.from("saas_yards").select("name").eq("company_id", companyId),
  ]);
  const c = co as { first_yard_name: string | null; name?: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null } | null;
  const existing = ((yardRows ?? []) as { name: string }[]).map((y) => y.name).filter(isBillableYard);
  const names = yardsToMake(paidFor, c?.first_yard_name, existing);
  if (!names.length) return [];
  const { error } = await admin.from("saas_yards")
    .upsert(names.map((name) => ({ company_id: companyId, name })), { onConflict: "company_id,name", ignoreDuplicates: true });
  if (error) throw new Error(`yards: ${error.message}`);
  // A company's first yards made = it just paid. Whoever got here first (the
  // success page or the webhook) sends the heads-up.
  if (!existing.length) {
    tellOwner(`SYNNR paid: ${c?.name ?? "a new company"}, ${paidFor} ${paidFor === 1 ? "yard" : "yards"}`, [
      `${c?.name ?? "A company"} just paid for ${paidFor} ${paidFor === 1 ? "yard" : "yards"} (${monthly(paidFor)}).`,
      [c?.contact_name, c?.contact_email, c?.contact_phone].filter(Boolean).join(", ") || null,
      "Call to welcome them and offer to load their iron.",
    ]);
  }
  return names;
}

/** A Stripe Checkout for N yards at $500 each a month, tied to this company. */
export async function createYardCheckout(stripe: Stripe, admin: SupabaseClient, args: {
  companyId: string; companyName: string; userEmail: string | null; quantity: number; origin: string;
}): Promise<{ url: string; quantity: number; amountTotal: number | null; already?: boolean }> {
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

  // Already paying (they came back before the webhook landed, or hit Pay
  // twice): never start a second subscription. Take what Stripe has, make
  // their yards, and send them in. Otherwise close any checkout page still
  // open for them, so only the newest one can be paid.
  if (c?.stripe_customer_id && customerId === c.stripe_customer_id) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    const live = subs.data.find((s) => PAYING.has(s.status));
    // Unpaid: the subscription is still there, it's the bill that's owed. Send
    // them to Stripe's page for that invoice; paying it turns it back on.
    if (live && live.status === "unpaid") {
      const inv = typeof live.latest_invoice === "string"
        ? await stripe.invoices.retrieve(live.latest_invoice).catch(() => null)
        : live.latest_invoice ?? null;
      if (inv && inv.status === "open" && inv.hosted_invoice_url) {
        await admin.from("saas_companies").update(subscriptionFields(live)).eq("id", args.companyId);
        return { url: inv.hosted_invoice_url, quantity: live.items?.data?.[0]?.quantity ?? quantity, amountTotal: inv.amount_due ?? null, already: true };
      }
    }
    if (live) {
      await admin.from("saas_companies").update(subscriptionFields(live)).eq("id", args.companyId);
      await provisionPaidYards(admin, args.companyId, live.items?.data?.[0]?.quantity ?? quantity);
      return { url: `${args.origin}/app`, quantity: live.items?.data?.[0]?.quantity ?? quantity, amountTotal: null, already: true };
    }
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 20 });
    for (const s of open.data) await stripe.checkout.sessions.expire(s.id).catch(() => {});
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
