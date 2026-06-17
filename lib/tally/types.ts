/**
 * TallyShot — casing/tubing tally pipeline types.
 *
 * The product: a crew hand-tallies each pipe joint's length on paper; someone
 * then keys 100–300 numbers into Excel to get the Grand Total (= measured
 * footage in the hole), a billing AND well-integrity record. TallyShot reads
 * the sheet, parses the implied decimal, runs the QC math, and flags any value
 * it isn't sure about instead of silently trusting it.
 *
 * The whole pipeline is reader-agnostic: a SampleReader (deterministic fixture,
 * no card) and a VisionReader (AI Gateway, lights up when the card is added)
 * produce the SAME TallyRead shape, so everything downstream is identical.
 */

/** One cell exactly as the reader saw it — raw digits, no decimal applied yet. */
export type RawCell = {
  /** 1-based joint number on the sheet. */
  joint: number;
  /** Raw read, decimal implied (e.g. "3230" = 32.30 ft). Empty string = blank. */
  raw: string;
  /** 0.0–1.0 — how sure the reader is of THIS cell (legibility / handwriting). */
  confidence: number;
  /** Joint type; pups/crossovers/shoe skip the range flag. Defaults to "joint". */
  kind?: JointKind;
  /** Field note written by the joint — shoe, float collar, centralizer, X-O, etc. */
  note?: string;
};

/** What any reader (sample or vision) returns for one tally sheet. */
export type TallyRead = {
  /** Sheet metadata from the form header — context, not counts. */
  meta: {
    company?: string;
    well?: string;
    lease?: string;
    rig?: string;
    /** String spec — what a company man reads first: size, weight, grade, connection. */
    size?: string;
    weight?: string;
    grade?: string;
    connection?: string;
    sheetNo?: string;
    tailedBy?: string;
    date?: string;
  };
  cells: RawCell[];
  /**
   * The crew's INDEPENDENT count, for the cross-check — e.g. "No. in Hole" or
   * pieces-on-rack math written on the sheet. Lets us catch a missed/added joint
   * even when every individual cell reads clean. Optional.
   */
  independent?: { jointCount?: number; totalFt?: number };
  /** True when the read came from the cardless fixture (demo), false for vision. */
  usedSample: boolean;
};

export const TALLY_FLAGS = ["TRUSTED", "RANGE", "LOW_CONFIDENCE", "UNREADABLE"] as const;
export type TallyFlag = (typeof TALLY_FLAGS)[number];

/** Joint type — pups/crossovers/shoe are legitimately off-length and must NOT range-flag. */
export const JOINT_KINDS = ["joint", "pup", "crossover", "shoe"] as const;
export type JointKind = (typeof JOINT_KINDS)[number];

/** One joint after parsing + flagging. */
export type TallyJoint = {
  joint: number;
  raw: string;
  /** Parsed length in feet (raw with implied decimal applied), or null if blank/unparseable. */
  lengthFt: number | null;
  /** Running shoe depth: start depth + sum of lengths down to this joint (2 dp). */
  cumulativeFt: number | null;
  /** Joint / pup / crossover / shoe — pups & subs are exempt from the range check. */
  kind: JointKind;
  confidence: number;
  flag: TallyFlag;
  /** Human-readable reason when flagged (shown in review + xlsx). */
  reason: string;
  /** Field note for this joint — shoe, float collar, centralizer, X-O, etc. */
  note: string;
  /** A flagged joint is provisional — never counted as final until confirmed. */
  trusted: boolean;
};

export type TallyConfig = {
  /** Digits after the implied decimal (2 → "3230" = 32.30). */
  decimalPlaces: number;
  /** Plausible per-joint length band (ft); outside → RANGE flag. */
  range: { min: number; max: number };
  /** Cells at/above this confidence are trusted; below → LOW_CONFIDENCE flag. */
  confidenceThreshold: number;
  /** Running subtotal cadence (Reed's method: every 10 joints). */
  subtotalEvery: number;
  /** Grand-total vs independent-count tolerance (ft) for the cross-check. */
  crossCheckToleranceFt: number;
  /** Fixed point for the cumulative (running shoe-depth) column — casing: wellhead depth. */
  startDepthFt: number;
};

export const DEFAULT_TALLY_CONFIG: TallyConfig = {
  decimalPlaces: 2,
  range: { min: 28, max: 34 }, // Range-3 tubing/casing joints; pups/anomalies fall out and get flagged
  confidenceThreshold: 0.7,
  subtotalEvery: 10,
  crossCheckToleranceFt: 2,
  startDepthFt: 0,
};

export type Subtotal = {
  /** Joint range this subtotal covers, e.g. {from:1,to:10}. */
  from: number;
  to: number;
  /** Sum of TRUSTED joint lengths in this block. */
  ft: number;
  /** Count of joints in this block carrying a flag (provisional). */
  flagged: number;
};

export type CrossCheck = {
  ran: boolean;
  expectedFt: number | null;
  actualFt: number;
  diffFt: number;
  toleranceFt: number;
  pass: boolean;
  note: string;
};

/** The complete pipeline output for one sheet. */
export type TallyResult = {
  meta: TallyRead["meta"];
  joints: TallyJoint[];
  subtotals: Subtotal[];
  /** Sum of TRUSTED joint lengths only (flagged values are NOT silently included). */
  grandTotalFt: number;
  /** Sum of ALL parsed lengths incl. flagged — provisional, shown for transparency. */
  provisionalTotalFt: number;
  jointCount: number;
  trustedCount: number;
  flaggedCount: number;
  flagged: TallyJoint[];
  crossCheck: CrossCheck;
  /** False while any joint is flagged — the export is not a confirmed final yet. */
  confirmedFinal: boolean;
  usedSample: boolean;
};

/** A reader turns a (sample id | image) into a TallyRead. Pipeline depends only on this. */
export interface TallyReader {
  read(): Promise<TallyRead>;
}
