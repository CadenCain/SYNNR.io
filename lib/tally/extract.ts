import type { RawCell, TallyJoint, TallyConfig, TallyFlag } from "./types";

/**
 * Apply the implied decimal: digits are feet.hundredths with the point dropped,
 * so the last `decimalPlaces` digits are the fraction. "3230" → 32.30,
 * "31 21" → 31.21. Tolerates spaces/dots and an already-present decimal point.
 * Returns null for blank or non-numeric reads.
 */
export function parseImpliedDecimal(raw: string, decimalPlaces: number): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // If the reader already gave a real decimal, trust it as-is.
  if (s.includes(".")) {
    const n = Number(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  if (decimalPlaces <= 0) {
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }
  const padded = digits.padStart(decimalPlaces + 1, "0"); // ensure at least one whole digit
  const whole = padded.slice(0, padded.length - decimalPlaces);
  const frac = padded.slice(padded.length - decimalPlaces);
  const n = Number(`${whole}.${frac}`);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse + flag one cell. A flagged value is provisional (trusted:false) and is
 * never silently counted as final. Range failures flag regardless of how
 * confident the read was — a confidently-read short joint still needs eyes.
 */
export function extractJoint(cell: RawCell, cfg: TallyConfig): TallyJoint {
  const lengthFt = parseImpliedDecimal(cell.raw, cfg.decimalPlaces);
  const confidence = cell.confidence;
  const kind = cell.kind ?? "joint";

  let flag: TallyFlag = "TRUSTED";
  let reason = "";

  if (lengthFt === null) {
    flag = "UNREADABLE";
    reason = cell.raw?.trim() ? `Couldn't parse "${cell.raw}"` : "Blank cell";
  } else if (kind === "joint" && (lengthFt < cfg.range.min || lengthFt > cfg.range.max)) {
    // pups, crossovers, and the shoe joint are legitimately off-length — never range-flag them
    flag = "RANGE";
    reason = `${lengthFt.toFixed(cfg.decimalPlaces)} ft is outside the expected ${cfg.range.min}–${cfg.range.max} ft — probable misread or pup joint`;
  } else if (confidence < cfg.confidenceThreshold) {
    flag = "LOW_CONFIDENCE";
    reason = `Read confidence ${(confidence * 100).toFixed(0)}% is below ${(cfg.confidenceThreshold * 100).toFixed(0)}% — confirm the digits`;
  }

  return {
    joint: cell.joint,
    raw: cell.raw,
    lengthFt,
    cumulativeFt: null, // filled by buildResult (needs joint order)
    kind,
    confidence,
    flag,
    reason,
    trusted: flag === "TRUSTED",
  };
}

export function extractJoints(cells: RawCell[], cfg: TallyConfig): TallyJoint[] {
  return [...cells]
    .sort((a, b) => a.joint - b.joint)
    .map((c) => extractJoint(c, cfg));
}
