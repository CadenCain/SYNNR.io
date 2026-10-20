import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { clampYards, planLine, monthlyDollars, isYardPrice, hasFullAccess, mustSubscribe, PER_YARD_CENTS } from "../plan";
import { applyStripeEvent, type CompanyFields, type CompanyMatch } from "../stripe-events";

describe("the plan: $500 a yard a month", () => {
  it("scales with yards, never a flat fee", () => {
    expect(monthlyDollars(1)).toBe(500);
    expect(monthlyDollars(3)).toBe(1500);
    expect(monthlyDollars(12)).toBe(6000);
    expect(planLine(1)).toBe("$500 × 1 yard = $500/month");
    expect(planLine(4)).toBe("$500 × 4 yards = $2,000/month");
  });
  it("yard counts are whole numbers from 1 to 50", () => {
    expect(clampYards(0)).toBe(1);
    expect(clampYards(-3)).toBe(1);
    expect(clampYards("2.9")).toBe(2);
    expect(clampYards("abc")).toBe(1);
    expect(clampYards(500)).toBe(50);
  });
  it("only a $500 USD monthly per-unit price counts as the yard price", () => {
    const ok = { unit_amount: PER_YARD_CENTS, currency: "usd", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" }, active: true };
    expect(isYardPrice(ok)).toBe(true);
    expect(isYardPrice({ ...ok, unit_amount: 50000 - 1 })).toBe(false);
    expect(isYardPrice({ ...ok, currency: "cad" })).toBe(false);
    expect(isYardPrice({ ...ok, recurring: { interval: "year" } })).toBe(false);
    expect(isYardPrice({ ...ok, recurring: { interval: "month", usage_type: "metered" } })).toBe(false);
    expect(isYardPrice({ ...ok, recurring: null })).toBe(false);
    expect(isYardPrice({ ...ok, active: false })).toBe(false);
  });
});

describe("who gets the load-out", () => {
  const co = (subscription_status: string, extra: Partial<{ comped: boolean; is_demo: boolean }> = {}) => ({ subscription_status, comped: false, is_demo: false, ...extra });
  it("paid up, or a card retrying, gets everything", () => {
    expect(hasFullAccess(co("active"))).toBe(true);
    expect(hasFullAccess(co("past_due"))).toBe(true);
  });
  it("canceled, unpaid, never paid, or a first payment that failed gets no load-out", () => {
    for (const s of ["canceled", "unpaid", "none", "incomplete", "incomplete_expired", "paused"]) expect(hasFullAccess(co(s))).toBe(false);
  });
  it("comped accounts and the demo yard are always in", () => {
    expect(hasFullAccess(co("none", { comped: true }))).toBe(true);
    expect(hasFullAccess(co("none", { is_demo: true }))).toBe(true);
  });
  it("never finished paying goes to checkout; a lapsed shop stays in read-only with its records", () => {
    expect(mustSubscribe(co("none"))).toBe(true);
    expect(mustSubscribe(co("incomplete"))).toBe(true);
    expect(mustSubscribe(co("canceled"))).toBe(false);
    expect(mustSubscribe(co("unpaid"))).toBe(false);
    expect(mustSubscribe(co("active"))).toBe(false);
    expect(mustSubscribe(co("none", { is_demo: true }))).toBe(false);
  });
});

// ── The webhook, with real event shapes and a company table in memory ──

type Row = { id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string; yard_quantity: number; subscribed_at?: string };
function world(rows: Row[], subs: Record<string, Partial<Stripe.Subscription>>) {
  const db = rows.map((r) => ({ ...r }));
  const update = async (fields: CompanyFields, match: CompanyMatch) => {
    const hits = db.filter((r) => ("stripe_customer_id" in match ? r.stripe_customer_id === match.stripe_customer_id : r.id === match.id)
      && (!match.currentSubscription || r.stripe_subscription_id === match.currentSubscription || r.stripe_subscription_id === null));
    for (const r of hits) Object.assign(r, fields);
    return hits.length;
  };
  const retrieveSubscription = async (id: string) => {
    if (!subs[id]) throw new Error(`no such subscription ${id}`);
    return { id, ...subs[id] } as Stripe.Subscription;
  };
  return { db, deps: { update, retrieveSubscription, now: () => "2026-10-20T12:00:00.000Z" } };
}
const sub = (status: string, qty: number, customer = "cus_1", company = "co1"): Partial<Stripe.Subscription> =>
  ({ status: status as Stripe.Subscription.Status, customer, metadata: { company_id: company }, items: { data: [{ quantity: qty }] } as unknown as Stripe.ApiList<Stripe.SubscriptionItem> });
const ev = (type: string, object: unknown) => ({ id: `evt_${type}`, type, data: { object } }) as unknown as Stripe.Event;
const fresh = (): Row => ({ id: "co1", stripe_customer_id: "cus_1", stripe_subscription_id: null, subscription_status: "none", yard_quantity: 0 });

describe("the Stripe webhook", () => {
  it("checkout completed: the shop is active with the yards it paid for", async () => {
    const w = world([fresh()], { sub_1: sub("active", 3) });
    await applyStripeEvent(ev("checkout.session.completed", { mode: "subscription", customer: "cus_1", subscription: "sub_1", client_reference_id: "co1" }), w.deps);
    expect(w.db[0]).toMatchObject({ subscription_status: "active", stripe_subscription_id: "sub_1", yard_quantity: 3, subscribed_at: "2026-10-20T12:00:00.000Z" });
  });

  it("matches by company id when the customer id drifted, and repairs it", async () => {
    const w = world([{ ...fresh(), stripe_customer_id: "cus_old" }], { sub_1: sub("active", 2, "cus_new") });
    await applyStripeEvent(ev("checkout.session.completed", { mode: "subscription", customer: "cus_new", subscription: "sub_1", client_reference_id: "co1" }), w.deps);
    expect(w.db[0]).toMatchObject({ subscription_status: "active", stripe_customer_id: "cus_new", yard_quantity: 2 });
  });

  it("a yard change in Stripe updates the yard count", async () => {
    const w = world([{ ...fresh(), stripe_subscription_id: "sub_1", subscription_status: "active", yard_quantity: 2 }], { sub_1: sub("active", 5) });
    await applyStripeEvent(ev("customer.subscription.updated", { id: "sub_1", customer: "cus_1", metadata: { company_id: "co1" } }), w.deps);
    expect(w.db[0].yard_quantity).toBe(5);
  });

  it("a failed renewal shows past_due; when the card goes through it's active again", async () => {
    const subs = { sub_1: sub("past_due", 2) };
    const w = world([{ ...fresh(), stripe_subscription_id: "sub_1", subscription_status: "active", yard_quantity: 2 }], subs);
    await applyStripeEvent(ev("customer.subscription.updated", { id: "sub_1", customer: "cus_1" }), w.deps);
    expect(w.db[0].subscription_status).toBe("past_due");
    subs.sub_1 = sub("active", 2);
    await applyStripeEvent(ev("customer.subscription.updated", { id: "sub_1", customer: "cus_1" }), w.deps);
    expect(w.db[0].subscription_status).toBe("active");
  });

  it("uses Stripe's status now, not a late event's old snapshot", async () => {
    // Stripe delivers an old "past_due" update after the card already recovered.
    const w = world([{ ...fresh(), stripe_subscription_id: "sub_1", subscription_status: "active", yard_quantity: 2 }], { sub_1: sub("active", 2) });
    await applyStripeEvent(ev("customer.subscription.updated", { id: "sub_1", customer: "cus_1", status: "past_due" }), w.deps);
    expect(w.db[0].subscription_status).toBe("active");
  });

  it("canceled means canceled", async () => {
    const w = world([{ ...fresh(), stripe_subscription_id: "sub_1", subscription_status: "active", yard_quantity: 2 }], {});
    await applyStripeEvent(ev("customer.subscription.deleted", { id: "sub_1", customer: "cus_1", status: "canceled" }), w.deps);
    expect(w.db[0].subscription_status).toBe("canceled");
  });

  it("a late cancel of an OLD subscription can't cancel a shop that subscribed again", async () => {
    const w = world([{ ...fresh(), stripe_subscription_id: "sub_new", subscription_status: "active", yard_quantity: 2 }], {});
    const r = await applyStripeEvent(ev("customer.subscription.deleted", { id: "sub_old", customer: "cus_1", status: "canceled" }), w.deps);
    expect(w.db[0].subscription_status).toBe("active");
    expect(r).toEqual({ handled: true, companyMatched: false });
  });

  it("a first payment that fails never turns access on", async () => {
    const w = world([fresh()], { sub_1: sub("incomplete", 3) });
    await applyStripeEvent(ev("checkout.session.completed", { mode: "subscription", customer: "cus_1", subscription: "sub_1", client_reference_id: "co1" }), w.deps);
    expect(w.db[0].subscription_status).toBe("incomplete");
    expect(hasFullAccess({ subscription_status: w.db[0].subscription_status, comped: false, is_demo: false })).toBe(false);
    // And an invoice.payment_failed event is ignored, not turned into past_due (which has access).
    const r = await applyStripeEvent(ev("invoice.payment_failed", { customer: "cus_1" }), w.deps);
    expect(r).toEqual({ handled: false });
    expect(w.db[0].subscription_status).toBe("incomplete");
  });

  it("a paying customer we can't find is an error, so Stripe retries", async () => {
    const w = world([], { sub_1: sub("active", 1, "cus_x", "nobody") });
    await expect(applyStripeEvent(ev("customer.subscription.updated", { id: "sub_1", customer: "cus_x", metadata: { company_id: "nobody" } }), w.deps)).rejects.toThrow(/no company matched/);
  });

  it("ignores events it doesn't need", async () => {
    const w = world([fresh()], {});
    expect(await applyStripeEvent(ev("charge.succeeded", {}), w.deps)).toEqual({ handled: false });
    expect(await applyStripeEvent(ev("checkout.session.completed", { mode: "payment", customer: "cus_1" }), w.deps)).toEqual({ handled: false });
  });
});
