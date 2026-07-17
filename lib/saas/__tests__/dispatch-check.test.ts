import { describe, it, expect } from "vitest";
import { addDaysIso } from "../status";
import { matchAssetForLine, requiredLoadoutGaps, resolveLoadoutTemplate } from "../dispatch-check";

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

/**
 * The tile/check agreement contract: the fleet-board tile and the pre-dispatch
 * check share ONE loadout matcher (these exports). A green tile that fails the
 * check seconds later is the product lying — these tests pin the shared rule.
 */
describe("requiredLoadoutGaps — shared by the fleet tile AND the check", () => {
  const assets = [
    { name: "BOP #3", status: "in_service" },
    { name: "Lubricator", status: "in_service" },
    { name: "Crane line", status: "out_of_service" },
  ];

  it("required line matched by an in-service asset → no gap", () => {
    expect(requiredLoadoutGaps([{ label: "Lubricator", required: true }], assets)).toEqual([]);
  });

  it("fuzzy match works both directions (template 'BOP' ↔ asset 'BOP #3')", () => {
    expect(requiredLoadoutGaps([{ label: "BOP", required: true }], assets)).toEqual([]);
    expect(matchAssetForLine("bop", assets)?.name).toBe("BOP #3");
  });

  it("required line absent from the asset list → gap", () => {
    const gaps = requiredLoadoutGaps([{ label: "Grease injector", required: true }], assets);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({ label: "Grease injector", detail: "not on the asset list" });
  });

  it("required line matched by an OUT-OF-SERVICE asset → gap (present ≠ usable)", () => {
    const gaps = requiredLoadoutGaps([{ label: "Crane line", required: true }], assets);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].detail).toContain("flagged out of service");
  });

  it("OPTIONAL lines never gap — only required lines can block the green light", () => {
    expect(requiredLoadoutGaps([{ label: "Spare sheave", required: false }], assets)).toEqual([]);
  });

  it("empty template → no gaps (nothing required, nothing to fail)", () => {
    expect(requiredLoadoutGaps([], assets)).toEqual([]);
  });
});

describe("resolveLoadoutTemplate — precedence is unit > company default > global seed", () => {
  const CO = "co-1";
  const seed = { id: "seed", company_id: null, unit_id: null, unit_type: "wireline_truck" };
  const coDefault = { id: "co-def", company_id: CO, unit_id: null, unit_type: "wireline_truck" };
  const unitTpl = { id: "unit-tpl", company_id: CO, unit_id: "u-1", unit_type: null };

  it("unit-specific template beats everything", () => {
    expect(resolveLoadoutTemplate([seed, coDefault, unitTpl], CO, "u-1", "wireline_truck")?.id).toBe("unit-tpl");
  });

  it("company type default beats the global seed", () => {
    expect(resolveLoadoutTemplate([seed, coDefault], CO, "u-2", "wireline_truck")?.id).toBe("co-def");
  });

  it("global seed is the fallback", () => {
    expect(resolveLoadoutTemplate([seed], CO, "u-2", "wireline_truck")?.id).toBe("seed");
  });

  it("no template for this type → null (check runs, gear section just absent)", () => {
    expect(resolveLoadoutTemplate([seed], CO, "u-2", "pump_truck")).toBeNull();
  });
});

describe("matchAssetForLine — token tier (how hands actually name gear)", () => {
  it("template 'Pressure control package (BOP)' matches asset 'BOP stack — 15k dual ram'", () => {
    const a = [{ name: "BOP stack — 15k dual ram", status: "in_service" }];
    expect(matchAssetForLine("Pressure control package (BOP)", a)?.name).toBe("BOP stack — 15k dual ram");
  });

  it("'Slings & rigging (inspected)' matches 'Wire rope slings — inspected'", () => {
    const a = [{ name: "Wire rope slings — inspected", status: "in_service" }];
    expect(matchAssetForLine("Slings & rigging (inspected)", a)).not.toBeNull();
  });

  it("generic filler words alone never match ('Spare kit' vs 'First-aid kit')", () => {
    const a = [{ name: "Spare kit", status: "in_service" }];
    expect(matchAssetForLine("Crane package", a)).toBeNull();
  });

  it("a shared NUMBER alone never matches ('Hose 3000 psi' vs 'Pump 3000')", () => {
    const a = [{ name: "Pump 3000", status: "in_service" }];
    expect(matchAssetForLine("Hose 3000 psi rated", a)).toBeNull();
  });
});
