import type { TallyJoint, TallyConfig, Subtotal, CrossCheck, TallyRead, TallyResult } from "./types";

/** Round to N decimals, killing binary float drift (32.30 + 32.46 + … noise). */
export function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** Sum the TRUSTED joint lengths in a list (flagged values excluded). */
function trustedSum(joints: TallyJoint[], places: number): number {
  return round(
    joints.reduce((acc, j) => (j.trusted && j.lengthFt !== null ? acc + j.lengthFt : acc), 0),
    places
  );
}

/** Sum ALL parsed lengths incl. flagged — the provisional best-read total. */
function provisionalSum(joints: TallyJoint[], places: number): number {
  return round(
    joints.reduce((acc, j) => (j.lengthFt !== null ? acc + j.lengthFt : acc), 0),
    places
  );
}

/** Per-block subtotals (Reed's every-10 method): trusted ft + flagged count. */
export function subtotalsByBlock(joints: TallyJoint[], cfg: TallyConfig): Subtotal[] {
  const out: Subtotal[] = [];
  const sorted = [...joints].sort((a, b) => a.joint - b.joint);
  const n = cfg.subtotalEvery;
  for (let i = 0; i < sorted.length; i += n) {
    const block = sorted.slice(i, i + n);
    out.push({
      from: block[0].joint,
      to: block[block.length - 1].joint,
      ft: trustedSum(block, cfg.decimalPlaces),
      flagged: block.filter((j) => !j.trusted).length,
    });
  }
  return out;
}

/**
 * String-length cross-check: compare the full read against the crew's
 * independent total (e.g. "No. in Hole"). Catches a missed/added joint even
 * when every cell reads clean. Uses the provisional (all-cells) total so it
 * gauges the overall read, separate from per-cell flag resolution.
 */
export function crossCheck(
  provisionalTotalFt: number,
  independent: TallyRead["independent"],
  cfg: TallyConfig
): CrossCheck {
  const expectedFt = independent?.totalFt ?? null;
  if (expectedFt === null) {
    return {
      ran: false,
      expectedFt: null,
      actualFt: provisionalTotalFt,
      diffFt: 0,
      toleranceFt: cfg.crossCheckToleranceFt,
      pass: true,
      note: "No independent total on the sheet — cross-check skipped.",
    };
  }
  const diffFt = round(provisionalTotalFt - expectedFt, cfg.decimalPlaces);
  const pass = Math.abs(diffFt) <= cfg.crossCheckToleranceFt;
  return {
    ran: true,
    expectedFt,
    actualFt: provisionalTotalFt,
    diffFt,
    toleranceFt: cfg.crossCheckToleranceFt,
    pass,
    note: pass
      ? `Within ±${cfg.crossCheckToleranceFt} ft of the crew's recorded ${expectedFt} ft.`
      : `Off by ${diffFt} ft vs the crew's recorded ${expectedFt} ft (tolerance ±${cfg.crossCheckToleranceFt}) — a joint may be missed or misread.`,
  };
}

/** Assemble the full QC result from extracted joints + the read metadata. */
export function buildResult(joints: TallyJoint[], read: TallyRead, cfg: TallyConfig): TallyResult {
  const grandTotalFt = trustedSum(joints, cfg.decimalPlaces);
  const provisionalTotalFt = provisionalSum(joints, cfg.decimalPlaces);
  const flagged = joints.filter((j) => !j.trusted);
  const trustedCount = joints.length - flagged.length;
  return {
    meta: read.meta,
    joints,
    subtotals: subtotalsByBlock(joints, cfg),
    grandTotalFt,
    provisionalTotalFt,
    jointCount: joints.length,
    trustedCount,
    flaggedCount: flagged.length,
    flagged,
    crossCheck: crossCheck(provisionalTotalFt, read.independent, cfg),
    confirmedFinal: flagged.length === 0,
    usedSample: read.usedSample,
  };
}
