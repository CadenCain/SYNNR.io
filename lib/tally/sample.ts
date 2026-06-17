import type { RawCell, TallyRead, TallyConfig } from "./types";
import { DEFAULT_TALLY_CONFIG } from "./types";

/**
 * Deterministic cardless fixture — transcribed from the MKS Services
 * "CASING – TUBING – RECORD" Sheet No. 3 (Range-3 casing, ~32 ft joints).
 *
 * Faithful to the real sheet's shape and magnitude; exact digits are a
 * realistic stand-in (truck-paper isn't always legible). The tests hand-total
 * THIS array, so the pipeline math is verified against the fixture itself —
 * independent of transcription fidelity.
 *
 * Two kinds of trouble are seeded on purpose so the flag paths are exercised:
 *   - out-of-range "pup"/misread joints (mirrors the real 30.72 / 30.46 that
 *     showed up mixed into columns of 31–32 ft joints), and
 *   - a couple of smudged, low-confidence cells.
 * Everything else reads clean and high-confidence.
 */

const C = 0.98; // clean, confident read

// Raw 4-digit reads ("3230" = 32.30 ft). Joint order matches the sheet (1..100).
// confidence defaults to C; overrides below seed the flagged cases.
const RAW: Array<[number, string, number?]> = [
  // 1–10
  [1, "3230"], [2, "3246"], [3, "3230"], [4, "3241"], [5, "3245"],
  [6, "3236"], [7, "3237"], [8, "3240"], [9, "3237"], [10, "3231"],
  // 11–20
  [11, "3236"], [12, "3237"], [13, "3237"], [14, "3233"], [15, "3230"],
  [16, "3246"], [17, "3248"], [18, "3229"], [19, "3230"], [20, "3230"],
  // 21–30  (joint 26 smudged → low confidence)
  [21, "3236"], [22, "3231"], [23, "3230"], [24, "3230"], [25, "3235"],
  [26, "3225", 0.61], [27, "3245"], [28, "3245"], [29, "3245"], [30, "3245"],
  // 31–40
  [31, "3238"], [32, "3235"], [33, "3236"], [34, "3225"], [35, "3230"],
  [36, "3230"], [37, "3248"], [38, "3243"], [39, "3245"], [40, "3246"],
  // 41–50  (joint 47 is a short pup / misread → out of range)
  [41, "3248"], [42, "3228"], [43, "3245"], [44, "3234"], [45, "3234"],
  [46, "3230"], [47, "3072", 0.83], [48, "3234"], [49, "3245"], [50, "3228"],
  // 51–60
  [51, "3235"], [52, "3226"], [53, "3240"], [54, "3247"], [55, "3225"],
  [56, "3233"], [57, "3230"], [58, "3230"], [59, "3238"], [60, "3245"],
  // 61–70
  [61, "3246"], [62, "3245"], [63, "3228"], [64, "3248"], [65, "3245"],
  [66, "3246"], [67, "3245"], [68, "3235"], [69, "3246"], [70, "3240"],
  // 71–80  (joint 73 smudged → low confidence)
  [71, "3247"], [72, "3233"], [73, "3233", 0.55], [74, "3236"], [75, "3235"],
  [76, "3246"], [77, "3225"], [78, "3238"], [79, "3240"], [80, "3231"],
  // 81–90
  [81, "3247"], [82, "3245"], [83, "3233"], [84, "3046", 0.79], [85, "3235"],
  [86, "3240"], [87, "3236"], [88, "3246"], [89, "3225"], [90, "3220"],
  // 91–100
  [91, "3235"], [92, "3226"], [93, "3228"], [94, "3245"], [95, "3240"],
  [96, "3244"], [97, "3231"], [98, "3241"], [99, "3248"], [100, "3245"],
];

/** A few field notes, as a hand would mark them on the sheet. */
const NOTES: Record<number, string> = {
  1: "Guide shoe",
  2: "Float collar",
  47: "Pup joint",
  50: "Centralizer",
};

export const SAMPLE_SHEET3_CELLS: RawCell[] = RAW.map(([joint, raw, confidence]) => ({
  joint,
  raw,
  confidence: confidence ?? C,
  note: NOTES[joint],
}));

/**
 * Independent total the crew wrote on the sheet, used for the cross-check.
 * Set within tolerance of the full (provisional) read so the cardless demo's
 * cross-check PASSES; a test perturbs it to exercise the fail path.
 */
export const SAMPLE_SHEET3_INDEPENDENT_TOTAL_FT = 3233.0;

/**
 * Config tuned to THIS sheet's joint population (~32 ft Range-3 casing). The
 * tighter band is what lets the two short anomalies (30.72, 30.46) fall out as
 * RANGE flags — the global DEFAULT_TALLY_CONFIG band is intentionally looser.
 */
export const SAMPLE_TALLY_CONFIG: TallyConfig = {
  ...DEFAULT_TALLY_CONFIG,
  range: { min: 31, max: 33 },
};

export const SAMPLE_SHEET3: TallyRead = {
  meta: {
    company: "MKS Services LLC",
    sheetNo: "3",
    size: '2 3/8" tubing',
    tailedBy: "(sample)",
    date: "",
  },
  cells: SAMPLE_SHEET3_CELLS,
  independent: { jointCount: 100, totalFt: SAMPLE_SHEET3_INDEPENDENT_TOTAL_FT },
  usedSample: true,
};
