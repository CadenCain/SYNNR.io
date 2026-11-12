import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { afterEmail, sendAfterOwed, SETTLE_MS, WINDOW_MS, type OwedJob } from "../after-email";

const job = (over: Partial<OwedJob>): OwedJob => ({ job_id: "11111111-1111-1111-1111-111111111111", job: "Truck 81, Cased Hole Logging", ready_by: "Mike Hand", out_at: "2026-11-11T11:10:00.000Z", checks: ["BOP rams closed for travel", "Pressure control package washed"], ...over });

describe("the morning note about what's owed after a job", () => {
  it("says nothing when every truck has its photos", () => {
    expect(afterEmail("Shop", [])).toBeNull();
    expect(afterEmail("Shop", [job({ checks: [] })])).toBeNull();
  });

  it("names the truck in the subject, and says what has no photo, who cleared it and when", () => {
    const mail = afterEmail("Shop", [job({})]);
    expect(mail?.subject).toBe("No photo after the job: Truck 81, Cased Hole Logging");
    expect(mail?.html).toContain("https://www.synnr.io/app/jobs/11111111-1111-1111-1111-111111111111");
    expect(mail?.html).toContain("No photo: BOP rams closed for travel; Pressure control package washed");
    // The yard runs on Central, and the email says so.
    expect(mail?.html).toContain("Cleared by Mike Hand, Nov 11, 5:10 AM CT");
  });

  it("counts the trucks when there are several, oldest first", () => {
    const mail = afterEmail("Shop", [job({ job: "Truck 12, Pipe recovery", out_at: "2026-11-11T12:00:00.000Z" }), job({ job: "Truck 81, Cased Hole Logging", out_at: "2026-11-09T12:00:00.000Z" }), job({ job: "Truck 7", checks: [] })]);
    expect(mail?.subject).toBe("2 trucks with no photo after the job");
    expect(mail!.html.indexOf("Truck 81")).toBeLessThan(mail!.html.indexOf("Truck 12"));
    expect(mail?.html).not.toContain("Truck 7");
  });

  it("still lists a truck that a stray tap took back to not ready, without a name to put on it", () => {
    const mail = afterEmail("Shop", [job({ ready_by: null })]);
    expect(mail?.html).toContain("Cleared, Nov 11, 5:10 AM CT");
    expect(mail?.html).not.toContain("Cleared by");
  });

  it("never lets a typed name become markup", () => {
    const mail = afterEmail("A & <b>B</b>", [job({ job: "<i>81</i>", ready_by: "<script>x</script>", checks: ["<img src=x>"] })]);
    expect(mail?.html).not.toMatch(/<script|<b>|<i>|<img/);
    expect(mail?.html).toContain("A &amp; &lt;b&gt;B&lt;/b&gt;");
  });
});

type Asked = { table: string; calls: [string, unknown[]][] };

/** Just enough of the database client: each table answers with its rows, and remembers what was asked of it. */
function fakeAdmin(tables: Record<string, unknown[] | { error: string }>, emails: Record<string, string>, asked: Asked[] = []) {
  const from = (table: string) => {
    const t = tables[table];
    const answer = Array.isArray(t) ? { data: t, error: null } : { data: null, error: { message: t?.error ?? "no such table" } };
    const mine: Asked = { table, calls: [] };
    asked.push(mine);
    const q: Record<string, unknown> = { then: (ok: (v: typeof answer) => unknown) => Promise.resolve(answer).then(ok) };
    for (const m of ["select", "eq", "neq", "is", "gte", "lte", "in", "order", "limit"]) q[m] = (...args: unknown[]) => { mine.calls.push([m, args]); return q; };
    return q;
  };
  return { from, auth: { admin: { getUserById: async (id: string) => ({ data: { user: emails[id] ? { email: emails[id] } : null } }) } } } as never;
}

describe("sending the morning note", () => {
  // No mail key in a test, whatever the machine running it has set: nothing real is ever sent from here.
  beforeEach(() => { vi.stubEnv("RESEND_API_KEY", ""); });
  afterEach(() => { vi.unstubAllEnvs(); });

  const now = new Date("2026-11-12T13:30:00.000Z").getTime();
  // What the database hands back: one row per check with no photo, with its truck.
  const truck = { truck: "Truck 81", job_type: "Cased Hole Logging", ready_by: "Mike", first_ready_at: "2026-11-11T11:10:00.000Z" };
  const owing = [
    { label: "BOP rams closed for travel", sort: 1, job_id: "job", company_id: "co", synnr_jobs: truck },
    { label: "Pressure control package washed", sort: 2, job_id: "job", company_id: "co", synnr_jobs: truck },
  ];
  const shop = { saas_companies: [{ id: "co", name: "Shop" }], saas_memberships: [{ company_id: "co", user_id: "u1" }] };

  it("asks only for checks with no photo, on trucks first cleared between a week ago and half a day ago", async () => {
    const asked: Asked[] = [];
    await sendAfterOwed(fakeAdmin({ synnr_job_lines: [] }, {}, asked), now);
    const calls = asked.find((a) => a.table === "synnr_job_lines")!.calls;
    expect(calls).toContainEqual(["eq", ["phase", "after"]]);
    expect(calls).toContainEqual(["is", ["on_at", null]]);
    // The first time it was cleared, which a later stray tap can't move.
    expect(calls).toContainEqual(["gte", ["synnr_jobs.first_ready_at", new Date(now - WINDOW_MS).toISOString()]]);
    expect(calls).toContainEqual(["lte", ["synnr_jobs.first_ready_at", new Date(now - SETTLE_MS).toISOString()]]);
  });

  it("does nothing, and says so, when every truck has its photos", async () => {
    expect(await sendAfterOwed(fakeAdmin({ synnr_job_lines: [], ...shop }, { u1: "boss@shop.test" }), now)).toEqual({ companies: 0, sent: 0, errors: [] });
  });

  it("reports a database error instead of throwing", async () => {
    const r = await sendAfterOwed(fakeAdmin({ synnr_job_lines: { error: "boom" } }, {}), now);
    expect(r.sent).toBe(0);
    expect(r.errors[0]).toContain("boom");
  });

  it("has nobody to tell when the only manager is a demo login", async () => {
    expect(await sendAfterOwed(fakeAdmin({ synnr_job_lines: owing, ...shop }, { u1: "demo-abc@demo.synnr.io" }), now)).toEqual({ companies: 1, sent: 0, errors: [] });
  });

  it("flags it when the email itself doesn't go", async () => {
    const r = await sendAfterOwed(fakeAdmin({ synnr_job_lines: owing, ...shop }, { u1: "boss@shop.test" }), now);
    expect(r).toEqual({ companies: 1, sent: 0, errors: ["after-the-job email didn't send for company co"] });
  });

  it("sends the manager one row per truck, with what has no photo in the list's order", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const posted: { to: string[]; subject: string; html: string }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => { posted.push(JSON.parse(init.body)); return { ok: true }; });
    try {
      const other = { label: "Package washed", sort: 0, job_id: "job2", company_id: "co", synnr_jobs: { ...truck, truck: "Truck 12", first_ready_at: "2026-11-10T11:00:00.000Z" } };
      const r = await sendAfterOwed(fakeAdmin({ synnr_job_lines: [...owing, other], ...shop }, { u1: "boss@shop.test" }), now);
      expect(r).toEqual({ companies: 1, sent: 1, errors: [] });
      expect(posted).toHaveLength(1);
      expect(posted[0].to).toEqual(["boss@shop.test"]);
      expect(posted[0].subject).toBe("2 trucks with no photo after the job");
      expect(posted[0].html).toContain("No photo: BOP rams closed for travel; Pressure control package washed");
      // Oldest first.
      expect(posted[0].html.indexOf("Truck 12")).toBeLessThan(posted[0].html.indexOf("Truck 81"));
    } finally { vi.unstubAllGlobals(); }
  });
});
