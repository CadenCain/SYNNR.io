import type Stripe from "stripe";

/**
 * What a Stripe event does to a company row, kept apart from the route so
 * tests run real events through it.
 *
 * Two rules matter:
 *   Stripe can deliver events late and out of order, so for anything about a
 *   subscription we ask Stripe for the subscription as it is NOW and write
 *   that (status, yard count), never the snapshot inside the event.
 *   A subscription that's no longer live (canceled, unpaid, incomplete) only
 *   writes to a company whose current subscription it is, so a late event
 *   about an old subscription can't cancel a shop that subscribed again.
 *   A failed FIRST payment leaves the subscription "incomplete", which has no
 *   access. We never mark a company past_due off an invoice event: past_due
 *   keeps access (Stripe is retrying a renewal), and setting it off a failed
 *   first invoice would hand out RollReady to a card that never paid.
 *
 * Every write sets fields to values, so Stripe's retries are safe to repeat.
 */

export interface CompanyFields {
  subscription_status?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  yard_quantity?: number;
  subscribed_at?: string;
}

export type CompanyMatch = ({ stripe_customer_id: string } | { id: string }) & {
  /** Only touch a company whose current subscription is this one (or that has none yet). */
  currentSubscription?: string;
};

export interface EventDeps {
  /** Update the company with this Stripe customer, or (fallback) this company id. Returns rows changed. */
  update: (fields: CompanyFields, match: CompanyMatch) => Promise<number>;
  /** The subscription as Stripe has it right now. */
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
  /** Make the yards a shop just paid for (also done by the success page; safe to repeat). */
  provision?: (companyIdHint: string | null, customerId: string | null, paidFor: number) => Promise<void>;
  now?: () => string;
}

export type EventResult = { handled: true; companyMatched: boolean } | { handled: false };

const idOf = (x: string | { id: string } | null | undefined) => (x == null ? null : typeof x === "string" ? x : x.id);

/** The fields a live subscription puts on the company row. */
export function subscriptionFields(sub: Stripe.Subscription): CompanyFields {
  const qty = sub.items?.data?.[0]?.quantity;
  return {
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    ...(typeof qty === "number" ? { yard_quantity: qty } : {}),
  };
}

export async function applyStripeEvent(event: Stripe.Event, deps: EventDeps): Promise<EventResult> {
  // Match by customer; fall back to the company id we stamp on everything.
  // A customer we can't match is an error, so Stripe retries instead of a
  // paying shop staying locked out with no trace.
  async function sync(fields: CompanyFields, customerId: string | null, companyIdHint: string | null, currentSubscription?: string): Promise<boolean> {
    const only = currentSubscription ? { currentSubscription } : {};
    if (customerId && (await deps.update(fields, { stripe_customer_id: customerId, ...only })) > 0) return true;
    if (companyIdHint && (await deps.update({ ...fields, ...(customerId ? { stripe_customer_id: customerId } : {}) }, { id: companyIdHint, ...only })) > 0) return true;
    // A stale event about an old subscription matching nothing is fine. A
    // live one matching nothing is a paying shop we can't find: fail loudly.
    if (currentSubscription) return false;
    throw new Error(`no company matched stripe customer ${customerId ?? "(none)"}`);
  }
  const live = (status: string) => status === "active" || status === "past_due" || status === "trialing";

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const subId = idOf(s.subscription as string | Stripe.Subscription | null);
      if (s.mode !== "subscription" || !subId) return { handled: false };
      const sub = await deps.retrieveSubscription(subId);
      const fields: CompanyFields = { ...subscriptionFields(sub) };
      if (sub.status === "active") fields.subscribed_at = (deps.now ?? (() => new Date().toISOString()))();
      const hint = s.client_reference_id ?? s.metadata?.company_id ?? sub.metadata?.company_id ?? null;
      const customer = idOf(s.customer as string | Stripe.Customer | null);
      const matched = await sync(fields, customer, hint, live(sub.status) ? undefined : sub.id);
      // Paid: make their yards, in case they closed the tab before coming back.
      if (matched && live(sub.status) && deps.provision) await deps.provision(hint, customer, fields.yard_quantity ?? 1);
      return { handled: true, companyMatched: matched };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const evSub = event.data.object as Stripe.Subscription;
      // A deleted subscription is final; anything else, ask Stripe for now.
      const sub = event.type === "customer.subscription.deleted" ? evSub : await deps.retrieveSubscription(evSub.id);
      const fields = event.type === "customer.subscription.deleted"
        ? { subscription_status: "canceled", stripe_subscription_id: evSub.id }
        : subscriptionFields(sub);
      const status = String(fields.subscription_status);
      const matched = await sync(fields, idOf(evSub.customer as string | Stripe.Customer), evSub.metadata?.company_id ?? null, live(status) ? undefined : evSub.id);
      return { handled: true, companyMatched: matched };
    }
    default:
      return { handled: false };
  }
}
