/**
 * TallyShot pipeline tests — run cardless with Node's built-in runner:
 *   node --test lib/tally/tally.test.ts
 *
 * Verifies the QC math against a hand-total of the fixture, the flag paths
 * (low-confidence + out-of-range), that flagged values are excluded from the
 * trusted/final total, and the cross-check pass/fail behavior.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { parseImpliedDecimal } from "./extract";
import { runTally, runTallySample } from "./run";
import { buildResult } from "./qc";
import { extractJoints } from "./extract";
import { SampleReader } from "./reader";
import { SAMPLE_SHEET3_CELLS, SAMPLE_TALLY_CONFIG, SAMPLE_SHEET3 } from "./sample";
import { exportTallyXlsx } from "./xlsx";
import ExcelJS from "exceljs";

const PLACES = SAMPLE_TALLY_CONFIG.decimalPlaces;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// joints flagged on purpose in the fixture
const FLAGGED_JOINTS = new Set([26, 73, 47, 84]);

test("implied-decimal parsing", () => {
  assert.equal(parseImpliedDecimal("3230", 2), 32.3);
  assert.equal(parseImpliedDecimal("31 21", 2), 31.21);
  assert.equal(parseImpliedDecimal("3046", 2), 30.46);
  assert.equal(parseImpliedDecimal("31.34", 2), 31.34); // already-decimal respected
  assert.equal(parseImpliedDecimal("", 2), null);
  assert.equal(parseImpliedDecimal("   ", 2), null);
  assert.equal(parseImpliedDecimal("806", 2), 8.06); // pads short reads
});

test("grand total + per-10 subtotals match a hand-total of the fixture", async () => {
  const result = await runTallySample();

  // Hand-total the fixture HERE, independently of the pipeline.
  const parsed = SAMPLE_SHEET3_CELLS.map((c) => ({ joint: c.joint, ft: Number(c.raw) / 100 }));
  const expectedTrusted = round2(
    parsed.filter((p) => !FLAGGED_JOINTS.has(p.joint)).reduce((a, p) => a + p.ft, 0)
  );
  const expectedProvisional = round2(parsed.reduce((a, p) => a + p.ft, 0));

  assert.equal(result.jointCount, 100);
  assert.equal(result.grandTotalFt, expectedTrusted, "grand total = trusted sum");
  assert.equal(result.provisionalTotalFt, expectedProvisional, "provisional = all-cells sum");

  // Per-10 subtotals: trusted sum of each block, hand-computed.
  assert.equal(result.subtotals.length, 10);
  for (const s of result.subtotals) {
    const hand = round2(
      parsed
        .filter((p) => p.joint >= s.from && p.joint <= s.to && !FLAGGED_JOINTS.has(p.joint))
        .reduce((a, p) => a + p.ft, 0)
    );
    assert.equal(s.ft, hand, `subtotal ${s.from}-${s.to}`);
  }

  // Subtotals of trusted blocks must reconstruct the grand total exactly.
  const sumOfSubtotals = round2(result.subtotals.reduce((a, s) => a + s.ft, 0));
  assert.equal(sumOfSubtotals, result.grandTotalFt, "Σ subtotals = grand total");
});

test("seeded low-confidence and out-of-range cells get flagged", async () => {
  const result = await runTallySample();

  const flaggedJointNums = new Set(result.flagged.map((f) => f.joint));
  for (const j of FLAGGED_JOINTS) {
    assert.ok(flaggedJointNums.has(j), `joint ${j} should be flagged`);
  }
  assert.equal(result.flaggedCount, FLAGGED_JOINTS.size);
  assert.equal(result.trustedCount, 100 - FLAGGED_JOINTS.size);

  // The two short anomalies flag as RANGE even though their confidence is fine.
  assert.equal(result.joints.find((j) => j.joint === 47)?.flag, "RANGE");
  assert.equal(result.joints.find((j) => j.joint === 84)?.flag, "RANGE");
  // The smudged cells flag as LOW_CONFIDENCE.
  assert.equal(result.joints.find((j) => j.joint === 26)?.flag, "LOW_CONFIDENCE");
  assert.equal(result.joints.find((j) => j.joint === 73)?.flag, "LOW_CONFIDENCE");
});

test("flagged values are NEVER silently included in the trusted/final total", async () => {
  const result = await runTallySample();

  // confirmedFinal must be false while flags exist
  assert.equal(result.confirmedFinal, false);

  // grand total must equal trusted-only; adding flagged lengths must change it
  const flaggedFt = round2(result.flagged.reduce((a, f) => a + (f.lengthFt ?? 0), 0));
  assert.ok(flaggedFt > 0);
  assert.equal(round2(result.grandTotalFt + flaggedFt), result.provisionalTotalFt);

  // every flagged joint is marked not-trusted
  for (const f of result.flagged) assert.equal(f.trusted, false);
});

test("a clean sheet with no flags is confirmedFinal", async () => {
  // strip the seeded trouble: clamp confidence high, lengths in-band
  const clean = structuredClone(SAMPLE_SHEET3);
  clean.cells = clean.cells.map((c) => ({
    joint: c.joint,
    raw: FLAGGED_JOINTS.has(c.joint) ? "3235" : c.raw, // replace anomalies with in-band reads
    confidence: 0.99,
  }));
  const result = await runTally(new SampleReader(clean), SAMPLE_TALLY_CONFIG);
  assert.equal(result.flaggedCount, 0);
  assert.equal(result.confirmedFinal, true);
  assert.equal(result.grandTotalFt, result.provisionalTotalFt);
});

test("string-length cross-check passes within tolerance and fails outside it", async () => {
  // default sample independent total is within tolerance → PASS
  const pass = await runTallySample();
  assert.equal(pass.crossCheck.ran, true);
  assert.equal(pass.crossCheck.pass, true);
  assert.ok(Math.abs(pass.crossCheck.diffFt) <= SAMPLE_TALLY_CONFIG.crossCheckToleranceFt);

  // perturb the independent total well beyond tolerance → FAIL
  const off = structuredClone(SAMPLE_SHEET3);
  off.independent = { totalFt: (off.independent?.totalFt ?? 0) + 50 };
  const fail = await runTally(new SampleReader(off), SAMPLE_TALLY_CONFIG);
  assert.equal(fail.crossCheck.pass, false);
  assert.ok(Math.abs(fail.crossCheck.diffFt) > SAMPLE_TALLY_CONFIG.crossCheckToleranceFt);

  // no independent total on the sheet → cross-check skipped (ran:false, pass:true)
  const none = structuredClone(SAMPLE_SHEET3);
  delete none.independent;
  const skipped = await runTally(new SampleReader(none), SAMPLE_TALLY_CONFIG);
  assert.equal(skipped.crossCheck.ran, false);
});

test("xlsx export produces a valid, readable workbook with the right shape", async () => {
  const result = await runTallySample();
  const buf = await exportTallyXlsx(result);
  assert.ok(buf.length > 0);

  // round-trip: read it back and verify structure + a flagged-row fill
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.getWorksheet("Tally");
  assert.ok(ws, "Tally worksheet exists");

  // header row at row 4
  assert.equal(ws!.getRow(4).getCell(1).value, "No.");
  assert.equal(ws!.getRow(4).getCell(2).value, "Length (ft)");

  // joint 1 is row 5, length 32.3
  assert.equal(ws!.getRow(5).getCell(1).value, 1);
  assert.equal(ws!.getRow(5).getCell(2).value, 32.3);

  // a flagged joint (47, RANGE) row carries the flag text + a fill
  const row47 = ws!.getRow(5 + 47 - 1);
  assert.equal(row47.getCell(1).value, 47);
  assert.match(String(row47.getCell(4).value), /RANGE/);
  const fill = row47.getCell(2).fill as ExcelJS.FillPattern;
  assert.equal(fill?.type, "pattern");
});

test("the cardless demo runs without any AI Gateway env", async () => {
  const hadKey = process.env.AI_GATEWAY_API_KEY;
  delete process.env.AI_GATEWAY_API_KEY;
  try {
    const result = await runTallySample();
    assert.equal(result.usedSample, true);
    assert.ok(result.grandTotalFt > 0);
  } finally {
    if (hadKey !== undefined) process.env.AI_GATEWAY_API_KEY = hadKey;
  }
});

// keep buildResult/extractJoints referenced for direct-unit clarity
test("buildResult is pure over extracted joints", () => {
  const joints = extractJoints(SAMPLE_SHEET3_CELLS, SAMPLE_TALLY_CONFIG);
  const r1 = buildResult(joints, SAMPLE_SHEET3, SAMPLE_TALLY_CONFIG);
  const r2 = buildResult(joints, SAMPLE_SHEET3, SAMPLE_TALLY_CONFIG);
  assert.deepEqual(r1.subtotals, r2.subtotals);
  assert.equal(r1.grandTotalFt, r2.grandTotalFt);
});
