/**
 * TallyShot — casing/tubing tally pipeline (SYNNR product #1).
 *
 * Photograph a handwritten tally sheet → parse the implied decimal → flag the
 * shaky digits → QC math (per-10 subtotals, grand total, cross-check) → Excel.
 *
 * Reader-agnostic: SampleReader (cardless fixture) and VisionReader (AI Gateway)
 * feed the identical downstream pipeline. Excel export lives in ./xlsx.
 */
export * from "./types";
export { parseImpliedDecimal, extractJoint, extractJoints } from "./extract";
export { round, subtotalsByBlock, crossCheck, buildResult } from "./qc";
export { SampleReader, VisionReader, type VisionInput } from "./reader";
export { runTally, runTallySample, summarize } from "./run";
export { SAMPLE_SHEET3, SAMPLE_SHEET3_CELLS, SAMPLE_TALLY_CONFIG } from "./sample";
export { exportTallyXlsx, buildTallyWorkbook, MKS_TEMPLATE, type XlsxTemplate, type XlsxOptions } from "./xlsx";
export { buildTallyPdf } from "./pdf";
export { reconcileTallies, type Reconciliation, type JointDiff } from "./reconcile";
export { LAYOUT_FIXTURES, LAYOUT_NOTEBOOK, LAYOUT_GRID, LAYOUT_MKS_FORM } from "./layouts";
