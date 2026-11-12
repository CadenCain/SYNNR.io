import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rentedEmail, sendRentedOut, type RentedItem } from "../rented-email";

const item = (over: Partial<RentedItem>): RentedItem => ({ label: "Flange", from: "Vendor Rentals", job: "Truck 81, Pipe recovery", job_id: "11111111-1111-1111-1111-111111111111", since: "2026-11-09T12:00:00.000Z", days: 3, ...over });

describe("the morning note about rented gear", () => {
  it("says nothing when nothing has been out a day", () => {
    expect(rentedEmail("Shop", [])).toBeNull();
    // Went out this morning: that job is still running.
    expect(rentedEmail("Shop", [item({ days: 0 })])).toBeNull();
  });

  it("names the one piece, whose it is and how long, right in the subject", () => {
    const mail = rentedEmail("Shop", [item({ days: 4 })]);
    expect(mail?.subject).toBe("Rented gear still out: Flange from Vendor Rentals, 4 days");
    expect(mail?.html).toContain("https://www.synnr.io/app/jobs/11111111-1111-1111-1111-111111111111");
    expect(mail?.html).toContain("Truck 81, Pipe recovery");
    expect(mail?.html).toContain("since Nov 9, 2026");
  });

  it("lists several longest out first, and leaves out today's", () => {
    const mail = rentedEmail("Shop", [item({ label: "Adapter", days: 1 }), item({ label: "Spool", days: 0 }), item({ label: "Flange", days: 6 })]);
    expect(mail?.subject).toBe("2 rented pieces still out, the longest 6 days");
    expect(mail!.html.indexOf("Flange")).toBeLessThan(mail!.html.indexOf("Adapter"));
    expect(mail?.html).not.toContain("Spool");
  });

  it("never lets a typed name become markup", () => {
    const mail = rentedEmail("A & <b>B</b>", [item({ label: "<script>x</script>", from: "\"Vendor\"", job: "<i>81</i>" })]);
    expect(mail?.html).not.toMatch(/<script|<b>|<i>/);
    expect(mail?.html).toContain("A &amp; &lt;b&gt;B&lt;/b&gt;");
  });
});

/** Just enough of the database client: each table answers with its rows, whatever is asked of it. */
function fakeAdmin(tables: Record<string, unknown[] | { error: string }>, emails: Record<string, string>) {
  const from = (table: string) => {
    const t = tables[table];
    const answer = Array.isArray(t) ? { data: t, error: null } : { data: null, error: { message: t?.error ?? "no such table" } };
    const q: Record<string, unknown> = { then: (ok: (v: typeof answer) => unknown) => Promise.resolve(answer).then(ok) };
    for (const m of ["select", "eq", "neq", "not", "is", "in", "limit"]) q[m] = () => q;
    return q;
  };
  return { from, auth: { admin: { getUserById: async (id: string) => ({ data: { user: emails[id] ? { email: emails[id] } : null } }) } } } as never;
}

describe("sending the morning note", () => {
  // No mail key in a test, whatever the machine running it has set: nothing real is ever sent from here.
  beforeEach(() => { vi.stubEnv("RESEND_API_KEY", ""); });
  afterEach(() => { vi.unstubAllEnvs(); });
  const now = new Date("2026-11-12T13:30:00.000Z").getTime();
  const line = { label: "Flange", rented_from: "Vendor", company_id: "co", job_id: "job", synnr_jobs: { truck: "Truck 81", job_type: "Pipe recovery", ready_at: "2026-11-09T12:00:00.000Z", created_at: "2026-11-08T12:00:00.000Z" } };

  it("does nothing, and says so, when no rented gear is out", async () => {
    expect(await sendRentedOut(fakeAdmin({ synnr_job_lines: [] }, {}), now)).toEqual({ companies: 0, sent: 0, errors: [] });
  });

  it("reports a database error instead of throwing", async () => {
    const r = await sendRentedOut(fakeAdmin({ synnr_job_lines: { error: "boom" } }, {}), now);
    expect(r.sent).toBe(0);
    expect(r.errors[0]).toContain("boom");
  });

  it("has nobody to tell when the company has no manager with an inbox", async () => {
    const admin = fakeAdmin({ synnr_job_lines: [line], saas_companies: [{ id: "co", name: "Shop" }], saas_memberships: [{ company_id: "co", user_id: "u1" }] }, { u1: "demo-abc@demo.synnr.io" });
    expect(await sendRentedOut(admin, now)).toEqual({ companies: 1, sent: 0, errors: [] });
  });

  it("flags it when the email itself doesn't go (no mail key here)", async () => {
    const admin = fakeAdmin({ synnr_job_lines: [line], saas_companies: [{ id: "co", name: "Shop" }], saas_memberships: [{ company_id: "co", user_id: "u1" }] }, { u1: "boss@shop.test" });
    const r = await sendRentedOut(admin, now);
    expect(r.sent).toBe(0);
    expect(r.errors).toEqual(["rented email didn't send for company co"]);
  });
});
