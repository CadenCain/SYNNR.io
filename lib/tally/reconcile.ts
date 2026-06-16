import type { TallyResult, TallyJoint } from "./types";

/**
 * Dual-tally reconciliation — the field practice Reed described: the tool hand
 * and the company man each run a tally and check against each other at TD.
 * "+/- 2 ft is a close enough tally for the entire string length."
 *
 * We compare two tallies and SURFACE disagreement — we never silently pick a
 * winner. The total check uses a configurable tolerance (default ±2 ft, on the
 * whole string, matching the field). Per-joint diffs show WHERE they diverge.
 */

export type JointDiff = {
  joint: number;
  a: number | null;
  b: number | null;
  diffFt: number | null;
  status: "match" | "mismatch" | "only_a" | "only_b";
};

export type Reconciliation = {
  totalAFt: number;
  totalBFt: number;
  totalDiffFt: number;
  toleranceFt: number;
  /** Whole-string check: |totalA − totalB| ≤ tolerance → close enough. */
  totalPass: boolean;
  jointCountA: number;
  jointCountB: number;
  countsMatch: boolean;
  /** Per-joint comparison; only entries that aren't a clean match are "issues". */
  diffs: JointDiff[];
  issueCount: number;
  note: string;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function totalOf(joints: TallyJoint[]): number {
  return round2(joints.reduce((a, j) => (j.lengthFt !== null ? a + j.lengthFt : a), 0));
}

export function reconcileTallies(
  a: TallyResult,
  b: TallyResult,
  opts: { toleranceFt?: number; perJointEpsilonFt?: number } = {}
): Reconciliation {
  const toleranceFt = opts.toleranceFt ?? 2;
  const eps = opts.perJointEpsilonFt ?? 0.001;

  const totalAFt = totalOf(a.joints);
  const totalBFt = totalOf(b.joints);
  const totalDiffFt = round2(totalAFt - totalBFt);
  const totalPass = Math.abs(totalDiffFt) <= toleranceFt;

  const byJoint = new Map<number, JointDiff>();
  for (const j of a.joints) byJoint.set(j.joint, { joint: j.joint, a: j.lengthFt, b: null, diffFt: null, status: "only_a" });
  for (const j of b.joints) {
    const cur = byJoint.get(j.joint);
    if (!cur) { byJoint.set(j.joint, { joint: j.joint, a: null, b: j.lengthFt, diffFt: null, status: "only_b" }); continue; }
    cur.b = j.lengthFt;
    if (cur.a !== null && cur.b !== null) {
      const d = round2(cur.a - cur.b);
      cur.diffFt = d;
      cur.status = Math.abs(d) <= eps ? "match" : "mismatch";
    } else {
      cur.status = cur.a !== null ? "only_a" : "only_b";
    }
  }

  const diffs = [...byJoint.values()].sort((x, y) => x.joint - y.joint);
  const issues = diffs.filter((d) => d.status !== "match");
  const countsMatch = a.joints.length === b.joints.length;

  const note = !countsMatch
    ? `Joint counts differ (${a.joints.length} vs ${b.joints.length}) — a joint was missed or double-counted.`
    : totalPass
    ? `Totals agree within ±${toleranceFt} ft (${Math.abs(totalDiffFt)} ft apart)${issues.length ? `, but ${issues.length} joint(s) disagree — reconcile those.` : " — good tally."}`
    : `Totals are ${Math.abs(totalDiffFt)} ft apart, beyond the ±${toleranceFt} ft tolerance — reconcile before calling it.`;

  return {
    totalAFt, totalBFt, totalDiffFt, toleranceFt, totalPass,
    jointCountA: a.joints.length, jointCountB: b.joints.length, countsMatch,
    diffs, issueCount: issues.length, note,
  };
}
