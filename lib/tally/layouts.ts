import type { RawCell, TallyRead, TallyConfig } from "./types";
import { DEFAULT_TALLY_CONFIG } from "./types";
import { SAMPLE_SHEET3, SAMPLE_TALLY_CONFIG } from "./sample";

/**
 * Layout fixtures — tally-sheet layout changes per rig, sometimes daily, so the
 * reader must DETECT and RE-MAP each sheet (handled in VisionReader's prompt).
 *
 * Architecturally, layout handling is isolated in the READER: it normalizes any
 * source layout (MKS form, field notebook, printed grid, arbitrary column
 * counts/orders) into a flat list of { joint, raw, confidence } cells. Every
 * downstream step (extract → flag → QC → export) is therefore layout-agnostic.
 *
 * These fixtures are what the reader emits for three genuinely different
 * layouts (modeled on Reed's posted sheets). The tests run the SAME pipeline on
 * each and prove the totals come out right — i.e. layout doesn't matter once
 * normalized.
 */

const cells = (vals: string[], startConf = 0.98): RawCell[] =>
  vals.map((raw, i) => ({ joint: i + 1, raw, confidence: startConf }));

// Tubing config (~31 ft Range-2 joints) — tighter band than the casing sheet.
const TUBING_CFG: TallyConfig = { ...DEFAULT_TALLY_CONFIG, range: { min: 30.5, max: 32.5 } };

/** 1) Field notebook — a free column of lengths, every 10th labeled on paper. */
export const LAYOUT_NOTEBOOK: TallyRead = {
  meta: { company: "(field notebook)", size: '2 3/8" tubing', tailedBy: "(sample)" },
  cells: cells(["3134", "3166", "3151", "3154", "3174", "3161", "3160", "3160", "3183", "3141", "3158", "3170"]),
  usedSample: true,
};

/** 2) Printed grid — joint # + length packed per cell, two columns on the page. */
export const LAYOUT_GRID: TallyRead = {
  meta: { company: "(printed grid)", size: '2 3/8" tubing', tailedBy: "(sample)" },
  cells: cells(["3121", "3106", "3119", "3118", "3120", "3106", "3142", "3151", "3133", "3150", "3157", "3148"]),
  usedSample: true,
};

/** 3) MKS Services pre-printed form — the casing sheet (reuses Sheet 3). */
export const LAYOUT_MKS_FORM = SAMPLE_SHEET3;

export const LAYOUT_FIXTURES: Array<{ key: string; label: string; read: TallyRead; cfg: TallyConfig }> = [
  { key: "notebook", label: "Field notebook", read: LAYOUT_NOTEBOOK, cfg: TUBING_CFG },
  { key: "grid", label: "Printed grid", read: LAYOUT_GRID, cfg: TUBING_CFG },
  { key: "mks_form", label: "MKS pre-printed form", read: LAYOUT_MKS_FORM, cfg: SAMPLE_TALLY_CONFIG },
];
