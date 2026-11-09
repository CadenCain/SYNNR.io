import { describe, it, expect, vi } from "vitest";
import { createYardCheckout } from "../onboarding";

/** A Supabase stand-in that answers the few reads createYardCheckout makes, and records writes. */
function fakeAdmin(customerId: string | null) {
  const writes: { table: string; op: string; row: unknown }[] = [];
  const reader = (table: string) => {
    const q: Record<string, unknown> = {};
    q.select = () => q; q.eq = () => q;
    q.maybeSingle = async () => ({ data: table === "saas_companies" ? { stripe_customer_id: customerId, contact_name: "Kev", contact_email: "k@x.com", contact_phone: null, first_yard_name: "Odessa" } : null });
    q.then = (r: (v: unknown) => void) => r({ data: [] });
    q.update = (row: unknown) => { writes.push({ table, op: "update", row }); return { eq: async () => ({ error: null }) }; };
    q.upsert = async (row: unknown) => { writes.push({ table, op: "upsert", row }); return { error: null }; };
    return q;
  };
  return { admin: { from: reader } as never, writes };
}

function fakeStripe(subStatus: string | null, openSessions = 0) {
  const expire = vi.fn(async () => ({}));
  const create = vi.fn(async () => ({ url: "https://checkout.stripe.com/new", amount_total: 100000 }));
  const stripe = {
    prices: { list: async () => ({ data: [{ id: "price_yard", unit_amount: 50000, currency: "usd", recurring: { interval: "month" }, active: true }] }), retrieve: async () => null },
    customers: { retrieve: async () => ({ id: "cus_1" }), create: async () => ({ id: "cus_new" }) },
    subscriptions: { list: async () => ({ data: subStatus ? [{ id: "sub_1", status: subStatus, items: { data: [{ quantity: 2 }] } }] : [] }) },
    checkout: { sessions: { list: async () => ({ data: Array.from({ length: openSessions }, (_, i) => ({ id: `cs_${i}` })) }), expire, create } },
  };
  return { stripe: stripe as never, expire, create };
}

const args = { companyId: "co_1", companyName: "Caprock", userEmail: "k@x.com", quantity: 2, origin: "https://www.synnr.io" };

describe("checkout can only be paid once", () => {
  it("an owner who's already paying is sent in, not to a second checkout", async () => {
    const { admin, writes } = fakeAdmin("cus_1");
    const { stripe, create } = fakeStripe("active");
    const r = await createYardCheckout(stripe, admin, args);
    expect(r.already).toBe(true);
    expect(r.url).toBe("https://www.synnr.io/app");
    expect(create).not.toHaveBeenCalled();
    expect(writes.find((w) => w.table === "saas_companies" && w.op === "update")?.row).toMatchObject({ subscription_status: "active", stripe_subscription_id: "sub_1", yard_quantity: 2 });
  });
  it("a new checkout closes any old one still open, so only one can be paid", async () => {
    const { admin } = fakeAdmin("cus_1");
    const { stripe, expire, create } = fakeStripe(null, 2);
    const r = await createYardCheckout(stripe, admin, args);
    expect(expire).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    expect(r.url).toBe("https://checkout.stripe.com/new");
  });
  it("a canceled subscription doesn't count as paying", async () => {
    const { admin } = fakeAdmin("cus_1");
    const { stripe, create } = fakeStripe("canceled");
    const r = await createYardCheckout(stripe, admin, args);
    expect(r.already).toBeFalsy();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
