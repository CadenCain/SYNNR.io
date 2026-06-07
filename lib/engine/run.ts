import { extractRecords } from "./extract";
import { detect } from "./detect";
import { buildInput, SAMPLE_INPUTS, type EngineInput } from "./sample";
import type { EngineFinding, Extraction } from "./schemas";

export type EngineResult = {
  jobNumber: string;
  findings: EngineFinding[];
  recoverableCents: number;
  extraction: Extraction;
};

/**
 * The reconciliation engine: LLM extraction -> deterministic detectors.
 * Falls back to the sample inputs when none are provided.
 */
export async function runEngine(parts: EngineInput = {}): Promise<EngineResult> {
  const extraction = await extractRecords(buildInput(parts));
  const findings = detect(extraction);
  const recoverableCents = findings.reduce((s, f) => s + f.amount_cents, 0);
  return {
    jobNumber: extraction.job_number || "RC-" + (4800 + (findings.length * 7)),
    findings,
    recoverableCents,
    extraction,
  };
}

export { SAMPLE_INPUTS };
