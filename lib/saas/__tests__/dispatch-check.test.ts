import { describe, it, expect } from "vitest";
import { addDaysIso } from "../status";

/**
 * The job-date rule (Q1): a cert unexpired TODAY but lapsing before the job
 * must fail — "still active" is not "current for this job". This tests the
 * pure decision (expiration vs job date) the check applies to each cert; the
 * DB wiring is exercised e2e separately.
 */
type Verdict = "ok" | "fail";
function certForJob(expiration: string | null, jobDate: string): Verdict {
  if (expiration === null) return "fail";          // no date on file
  if (expiration < jobDate) return "fail";          // lapsed by the job
  return "ok";                                      // current through the job
}

describe("cert currency evaluated against the JOB DATE", () => {
  const TODAY = "2026-07-02";

  it("cert current today AND through the job → ok", () => {
    const job = addDaysIso(TODAY, 21); // 2026-07-23
    expect(certForJob("2026-08-15", job)).toBe("ok");
  });

  it("THE Q1 BUG: cert valid today but expires BEFORE a future job → fail", () => {
    const job = addDaysIso(TODAY, 21); // job on 2026-07-23
    // cert expires 2026-07-15 — fine today, lapsed before the job
    expect(certForJob("2026-07-15", job)).toBe("fail");
  });

  it("cert expiring exactly ON the job date → still ok (valid through that day)", () => {
    expect(certForJob("2026-07-23", "2026-07-23")).toBe("ok");
  });

  it("cert expiring the day BEFORE the job → fail", () => {
    expect(certForJob("2026-07-22", "2026-07-23")).toBe("fail");
  });

  it("already-expired cert fails for a today check too (regression guard)", () => {
    expect(certForJob("2026-07-01", TODAY)).toBe("fail");
  });

  it("no expiration on file always fails, any job date", () => {
    expect(certForJob(null, TODAY)).toBe("fail");
    expect(certForJob(null, addDaysIso(TODAY, 30))).toBe("fail");
  });

  it("a today check behaves exactly like before (job date defaults to today)", () => {
    expect(certForJob("2026-07-02", TODAY)).toBe("ok");   // expires today = still ok
    expect(certForJob("2026-07-03", TODAY)).toBe("ok");   // future = ok
    expect(certForJob("2026-07-01", TODAY)).toBe("fail"); // past = fail
  });
});
