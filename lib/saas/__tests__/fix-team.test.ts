import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The team, from the busy-week findings:
 *  - Taking a hand off the crew turns the crew link over (they can't make a
 *    new login and walk back on).
 *  - A manager can fix a typo in a hand's login email, never for a login on
 *    another company's crew.
 */

const authMock = vi.hoisted(() => ({
  company: { id: "co-1", name: "Renegade Wireline", role: "owner", subscription_status: "active", comped: false, yard_quantity: 1, is_demo: false },
  user: { id: "user-kevin", email: "kevin@example.com", user_metadata: { full_name: "Kevin Odom" } },
}));
vi.mock("../auth", () => ({
  requireCompany: vi.fn(async () => authMock),
  requireBillableCompany: vi.fn(async () => authMock),
}));
const dbHolder = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("../db", () => ({
  saasDb: async () => dbHolder.current,
  saasAdmin: () => dbHolder.current,
}));

import { turnOverCrewLink, dropAlertRecipient, liveProofLinksBy, changeLoginEmail, offCrewNotice } from "@/app/app/settings/team/crew-changes";

const CO = "co-1";

// ------------------------------------------------------------- a small db
type Row = Record<string, unknown>;
type Filter = [string, string, unknown];
type Write = { table: string; kind: "insert" | "update" | "delete"; payload?: Row; filters: Filter[] };

const likeRe = (pattern: string) => new RegExp(`^${pattern.replace(/\\(.)|%|_|[.*+?^${}()|[\]]/g, (m, lit) =>
  lit !== undefined ? lit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : m === "%" ? ".*" : m === "_" ? "." : `\\${m}`)}$`, "i");

function fakeDb(tables: Record<string, Row[]>, auth?: { updateUserById: (id: string, attrs: Row) => Promise<{ error: { message: string } | null }> }) {
  const writes: Write[] = [];
  const reads: { table: string; filters: Filter[] }[] = [];
  let seq = 0;
  const matchOne = (r: Row, [c, op, v]: Filter): boolean => {
    if (op === "eq") return r[c] === v;
    if (op === "neq") return r[c] !== v;
    if (op === "is") return (r[c] ?? null) === v;
    if (op === "in") return (v as unknown[]).includes(r[c]);
    if (op === "gte") return String(r[c] ?? "") >= String(v);
    if (op === "lt") return String(r[c] ?? "") < String(v);
    if (op === "ilike") return likeRe(String(v)).test(String(r[c] ?? ""));
    if (op === "or") return String(v).split(",").some((part) => { const [col, o, ...rest] = part.split("."); return matchOne(r, [col, o, rest.join(".") === "null" ? null : rest.join(".")]); });
    return true;
  };
  class Q {
    private filters: Filter[] = [];
    private span: [number, number] | null = null;
    private head = false;
    private write: Write | null = null;
    constructor(private table: string) {}
    select(_c?: string, o?: { head?: boolean }) { this.head = Boolean(o?.head); return this; }
    eq(c: string, v: unknown) { this.filters.push([c, "eq", v]); return this; }
    neq(c: string, v: unknown) { this.filters.push([c, "neq", v]); return this; }
    is(c: string, v: unknown) { this.filters.push([c, "is", v]); return this; }
    in(c: string, v: unknown[]) { this.filters.push([c, "in", v]); return this; }
    gte(c: string, v: unknown) { this.filters.push([c, "gte", v]); return this; }
    lt(c: string, v: unknown) { this.filters.push([c, "lt", v]); return this; }
    ilike(c: string, v: string) { this.filters.push([c, "ilike", v]); return this; }
    or(f: string) { this.filters.push(["", "or", f]); return this; }
    order() { return this; }
    range(a: number, b: number) { this.span = [a, b]; return this; }
    maybeSingle() { return this; }
    insert(payload: Row) { this.write = { table: this.table, kind: "insert", payload, filters: [] }; return this; }
    update(payload: Row) { this.write = { table: this.table, kind: "update", payload, filters: [] }; return this; }
    delete() { this.write = { table: this.table, kind: "delete", filters: [] }; return this; }
    then<T>(resolve: (v: { data: unknown; error: null; count?: number }) => T): T {
      const rows = (tables[this.table] ??= []);
      const hit = rows.filter((r) => this.filters.every((f) => matchOne(r, f)));
      if (this.write) {
        this.write.filters = this.filters;
        writes.push(this.write);
        if (this.write.kind === "insert") rows.push({ id: `new-${++seq}`, ...this.write.payload });
        else if (this.write.kind === "update") hit.forEach((r) => Object.assign(r, this.write!.payload));
        else tables[this.table] = rows.filter((r) => !hit.includes(r));
        return resolve({ data: null, error: null });
      }
      reads.push({ table: this.table, filters: this.filters });
      if (this.head) return resolve({ data: null, error: null, count: hit.length });
      const page = this.span ? hit.slice(this.span[0], this.span[1] + 1) : hit;
      return resolve({ data: page, error: null, count: hit.length });
    }
  }
  const db = { from: (t: string) => new Q(t), auth: { admin: auth ?? { updateUserById: async () => ({ error: null }) } } };
  return { db: db as unknown as SupabaseClient, writes, reads, tables };
}


beforeEach(() => { authMock.company.role = "owner"; });

// ------------------------------------------------------------- off the crew
describe("taking someone off the crew", () => {
  it("turns the crew link over: the old one stops working and a fresh one takes its place", async () => {
    const { db, tables } = fakeDb({
      saas_invitations: [
        { id: "inv-old", company_id: CO, multi_use: true, status: "pending", token: "old" },
        { id: "inv-one", company_id: CO, multi_use: false, status: "pending" },
        { id: "inv-other-co", company_id: "co-2", multi_use: true, status: "pending" },
      ],
    });
    const r = await turnOverCrewLink(db, { id: CO, subscription_status: "active", comped: false });
    expect(r).toBe("new");
    const inv = tables.saas_invitations;
    expect(inv.find((i) => i.id === "inv-old")!.status).toBe("revoked");
    // A personal invite and another company's link are left alone.
    expect(inv.find((i) => i.id === "inv-one")!.status).toBe("pending");
    expect(inv.find((i) => i.id === "inv-other-co")!.status).toBe("pending");
    const fresh = inv.filter((i) => i.company_id === CO && i.multi_use && i.status === undefined);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].role).toBe("member");
    expect(Date.parse(String(fresh[0].expires_at)) - Date.now()).toBeGreaterThan(29 * 86400e3);
  });

  it("a canceled account turns the old link off without making a new one", async () => {
    const { db, writes } = fakeDb({ saas_invitations: [{ id: "inv-old", company_id: CO, multi_use: true, status: "pending" }] });
    expect(await turnOverCrewLink(db, { id: CO, subscription_status: "canceled", comped: false })).toBe("off");
    expect(writes.filter((w) => w.kind === "insert")).toHaveLength(0);
  });

  it("no crew link out: nothing to turn over, nothing written", async () => {
    const { db, writes } = fakeDb({ saas_invitations: [] });
    expect(await turnOverCrewLink(db, { id: CO, subscription_status: "active", comped: false })).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it("comes off this company's alert emails, whatever case the email was typed in", async () => {
    const { db, tables } = fakeDb({
      saas_alert_recipients: [
        { id: "r1", company_id: CO, email: "Marcus.Hale@Example.com" },
        { id: "r2", company_id: CO, email: "office@example.com" },
        { id: "r3", company_id: "co-2", email: "marcus.hale@example.com" },
      ],
    });
    expect(await dropAlertRecipient(db, CO, "marcus.hale@example.com")).toBe(1);
    expect(tables.saas_alert_recipients.map((r) => r.id).sort()).toEqual(["r2", "r3"]);
    expect(await dropAlertRecipient(db, CO, null)).toBe(0);
  });

  it("counts the proof links they made that still work", async () => {
    const { db } = fakeDb({
      saas_readiness_proofs: [
        { id: "p1", company_id: CO, created_by: "u-marcus", revoked_at: null },
        { id: "p2", company_id: CO, created_by: "u-marcus", revoked_at: "2026-11-01T00:00:00Z" },
        { id: "p3", company_id: CO, created_by: "u-dale", revoked_at: null },
      ],
    });
    expect(await liveProofLinksBy(db, CO, "u-marcus")).toBe(1);
  });

  it("tells the manager in plain words what happened", () => {
    const text = offCrewNotice({ link: "new", alerts: 1, links: 2 });
    expect(text).toMatch(/crew link turned over/);
    expect(text).not.toMatch(/alert emails|proof link/);
    expect(text).not.toMatch(/—/);
    expect(offCrewNotice({ link: null, alerts: 0, links: 0 })).toBe("Taken off the crew.");
  });
});

// ------------------------------------------------------------- login email
describe("fixing a hand's login email", () => {
  it("changes it for a login on this crew only", async () => {
    const update = vi.fn(async () => ({ error: null }));
    const { db } = fakeDb({ saas_memberships: [{ user_id: "u-tony", company_id: CO, status: "active" }] }, { updateUserById: update });
    const r = await changeLoginEmail(db, CO, "u-tony", "  Tony.Rios@Gmail.com ");
    expect(r).toEqual({ ok: true, email: "tony.rios@gmail.com" });
    expect(update).toHaveBeenCalledWith("u-tony", { email: "tony.rios@gmail.com", email_confirm: true });
  });

  it("won't touch a login that's on another company's crew too", async () => {
    const update = vi.fn(async () => ({ error: null }));
    const { db } = fakeDb({ saas_memberships: [
      { user_id: "u-tony", company_id: CO, status: "active" },
      { user_id: "u-tony", company_id: "co-2", status: "active" },
    ] }, { updateUserById: update });
    const r = await changeLoginEmail(db, CO, "u-tony", "tony@example.com");
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("says so when the email is wrong or already has a login", async () => {
    const { db } = fakeDb({ saas_memberships: [{ user_id: "u-tony", company_id: CO, status: "active" }] },
      { updateUserById: async () => ({ error: { message: "A user with this email address has already been registered" } }) });
    expect(await changeLoginEmail(db, CO, "u-tony", "tony@")).toEqual({ ok: false, error: "That email doesn't look right." });
    expect(await changeLoginEmail(db, CO, "u-tony", "dale@example.com")).toEqual({ ok: false, error: "That email already has a login." });
  });

  it("someone no longer on this crew can't be changed from here", async () => {
    const { db } = fakeDb({ saas_memberships: [{ user_id: "u-tony", company_id: CO, status: "removed" }] });
    expect((await changeLoginEmail(db, CO, "u-tony", "tony@example.com")).ok).toBe(false);
  });
});
