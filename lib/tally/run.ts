import type { TallyReader, TallyResult, TallyConfig } from "./types";
import { DEFAULT_TALLY_CONFIG } from "./types";
import { extractJoints } from "./extract";
import { buildResult } from "./qc";
import { SampleReader } from "./reader";
import { SAMPLE_TALLY_CONFIG } from "./sample";

/**
 * The pipeline: read → extract (implied-decimal + flag) → QC (subtotals,
 * totals, cross-check). It depends only on the TallyReader interface, so the
 * sample and vision paths run the EXACT same downstream code.
 */
export async function runTally(reader: TallyReader, cfg: TallyConfig = DEFAULT_TALLY_CONFIG): Promise<TallyResult> {
  const read = await reader.read();
  const joints = extractJoints(read.cells, cfg);
  return buildResult(joints, read, cfg);
}

/** Cardless demo: run the whole pipeline on the MKS Sheet 3 fixture, no card. */
export async function runTallySample(cfg: TallyConfig = SAMPLE_TALLY_CONFIG): Promise<TallyResult> {
  return runTally(new SampleReader(), cfg);
}

/** Compact, human-readable run summary for the console. */
export function summarize(r: TallyResult): string {
  const lines: string[] = [];
  lines.push(`TallyShot — ${r.meta.company ?? "tally sheet"}${r.meta.sheetNo ? ` · Sheet ${r.meta.sheetNo}` : ""}${r.usedSample ? "  [SAMPLE / cardless]" : ""}`);
  lines.push(`  Joints: ${r.jointCount}   Trusted: ${r.trustedCount}   Flagged: ${r.flaggedCount}`);
  lines.push(`  Grand total (trusted): ${r.grandTotalFt} ft`);
  lines.push(`  Provisional total (incl. flagged): ${r.provisionalTotalFt} ft`);
  lines.push(`  Cross-check: ${r.crossCheck.ran ? (r.crossCheck.pass ? "PASS" : "FAIL") : "n/a"} — ${r.crossCheck.note}`);
  lines.push(`  Confirmed final: ${r.confirmedFinal ? "yes" : "no — resolve flags first"}`);
  if (r.flagged.length) {
    lines.push(`  Flagged cells:`);
    for (const f of r.flagged) {
      lines.push(`    • Joint ${f.joint}: "${f.raw}"${f.lengthFt !== null ? ` (${f.lengthFt} ft)` : ""} — ${f.flag}: ${f.reason}`);
    }
  }
  return lines.join("\n");
}
