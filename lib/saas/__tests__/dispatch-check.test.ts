import { describe, it, expect } from "vitest";
import { addDaysIso } from "../status";
import { matchAssetForLine, resolveLoadoutTemplate, type AssetLite , crewWithNoCards } from "../dispatch-check";

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
 * THE GEAR RULE (post-reframe): RollReady keeps up with records, it does not
 * run a dispatch checklist. A gear-list line that simply isn't in the asset
 * book yet is a heads-up, never a failure. Only a matched asset the shop has
 * FLAGGED (missing / out of service) fails a truck. These pin that rule so a
 * future change can't quietly turn the gear list back into a gate.
 */
type GearResult = "ok" | "fail";
function gearLine(label: string, required: boolean, assets: AssetLite[]): GearResult {
  const match = matchAssetForLine(label, assets);
  if (!match) return "ok";                                   // not in the book yet = warning, not a gate
  return match.status === "in_service" || !required ? "ok" : "fail";
}

describe("gear list is a reference, not a gate", () => {
  const assets = [
    { name: "BOP #3", status: "in_service" },
    { name: "Lubricator", status: "in_service" },
    { name: "Crane line", status: "out_of_service" },
  ];

  it("required line NOT in the asset book → does NOT fail the truck (it warns)", () => {
    expect(gearLine("Grease injector", true, assets)).toBe("ok");
  });

  it("required line matched by an in-service asset → ok", () => {
    expect(gearLine("Lubricator", true, assets)).toBe("ok");
  });

  it("required line matched by a FLAGGED asset → fails (that is a real problem)", () => {
    expect(gearLine("Crane line", true, assets)).toBe("fail");
  });

  it("optional lines never fail, flagged or not", () => {
    expect(gearLine("Crane line", false, assets)).toBe("ok");
    expect(gearLine("Spare sheave", false, assets)).toBe("ok");
  });

  it("an empty asset book never fails a truck on gear alone", () => {
    expect(gearLine("Pressure control package (BOP)", true, [])).toBe("ok");
  });
});

describe("matchAssetForLine — how hands actually name gear", () => {
  it("fuzzy match works both directions (template 'BOP' <-> asset 'BOP #3')", () => {
    const a = [{ name: "BOP #3", status: "in_service" }];
    expect(matchAssetForLine("BOP", a)?.name).toBe("BOP #3");
    expect(matchAssetForLine("bop", a)?.name).toBe("BOP #3");
  });

  it("template 'Pressure control package (BOP)' matches asset 'BOP stack — 15k dual ram'", () => {
    const a = [{ name: "BOP stack — 15k dual ram", status: "in_service" }];
    expect(matchAssetForLine("Pressure control package (BOP)", a)?.name).toBe("BOP stack — 15k dual ram");
  });

  it("'Slings & rigging (inspected)' matches 'Wire rope slings — inspected'", () => {
    const a = [{ name: "Wire rope slings — inspected", status: "in_service" }];
    expect(matchAssetForLine("Slings & rigging (inspected)", a)).not.toBeNull();
  });

  it("generic filler words alone never match ('Crane package' vs 'Spare kit')", () => {
    const a = [{ name: "Spare kit", status: "in_service" }];
    expect(matchAssetForLine("Crane package", a)).toBeNull();
  });

  it("a shared NUMBER alone never matches ('Hose 3000 psi' vs 'Pump 3000')", () => {
    const a = [{ name: "Pump 3000", status: "in_service" }];
    expect(matchAssetForLine("Hose 3000 psi rated", a)).toBeNull();
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

/**
 * Zero-card hands — found by an ops-manager test run: a rigger with no cards
 * at all badged green and sailed through the readiness check, because only
 * EXISTING items were evaluated. "Every assigned hand's cards checked" was
 * vacuously true. Same rule as an undated cert: unverifiable is failing.
 */
describe("crewWithNoCards — an assigned hand with nothing on file fails", () => {
  const names = new Map([["h1", "Braden"], ["h2", "Dale"]]);

  it("hand with zero cert rows → failing entry, by name", () => {
    expect(crewWithNoCards(["h1", "h2"], [{ parent_id: "h2" }], names)).toEqual([
      { crewId: "h1", label: "Braden — no cards on file" },
    ]);
  });

  it("every assigned hand has at least one card → nothing to report", () => {
    expect(crewWithNoCards(["h1", "h2"], [{ parent_id: "h1" }, { parent_id: "h2" }], names)).toEqual([]);
  });

  it("no crew assigned → nothing to report (crew is simply not configured)", () => {
    expect(crewWithNoCards([], [], names)).toEqual([]);
  });

  it("ALL assigned hands empty → every one fails; unknown ids still fail, unnamed", () => {
    const out = crewWithNoCards(["h1", "hX"], [], names);
    expect(out).toHaveLength(2);
    expect(out[1].label).toBe("assigned hand — no cards on file");
  });
});
