import { extractRecords, type EnginePart } from "./extract";
import { detect } from "./detect";
import { buildInput, SAMPLE_INPUTS, SAMPLE_EXTRACTION, type EngineInput } from "./sample";
import type { EngineFinding, Extraction } from "./schemas";

export type EngineFile = { bytes: Uint8Array; mediaType: string; name: string };

export type EngineResult = {
  jobNumber: string;
  findings: EngineFinding[];
  recoverableCents: number;
  extraction: Extraction;
};

const FILE_INSTRUCTION =
  "Reconcile this job. Extract typed records (field-ticket lines performed, " +
  "invoice lines billed with rates, pricebook/MSA rates, signature presence, " +
  "photo counts) from the attached documents and images. They are real, " +
  "mixed-format uploads — separate tickets, invoices, and pricebooks yourself.";

/**
 * The reconciliation engine: (multimodal) LLM extraction -> deterministic
 * detectors. Accepts raw text and/or binary files (PDFs, images). Falls back
 * to the sample inputs when nothing is provided.
 */
export async function runEngine(
  input: EngineInput & { files?: EngineFile[] } = {}
): Promise<EngineResult> {
  const files = input.files ?? [];
  const parts: EnginePart[] = [];

  // Pure sample run (no uploads, no text): the records are known, so skip the
  // model entirely — detectors run deterministically with no AI Gateway dependency.
  const hasRealInput =
    files.length > 0 || !!input.raw?.trim() || !!input.ticket || !!input.invoice || !!input.pricebook;
  if (!hasRealInput) {
    const extraction: Extraction = {
      ...SAMPLE_EXTRACTION,
      ticket_lines: [...SAMPLE_EXTRACTION.ticket_lines],
      invoice_lines: [...SAMPLE_EXTRACTION.invoice_lines],
      pricebook: [...SAMPLE_EXTRACTION.pricebook],
    };
    const findings = detect(extraction);
    return {
      jobNumber: extraction.job_number || "RC-4821",
      findings,
      recoverableCents: findings.reduce((s, f) => s + f.amount_cents, 0),
      extraction,
    };
  }

  if (files.length) {
    parts.push({
      type: "text",
      text: FILE_INSTRUCTION + (input.raw ? "\n\nAlso consider this text:\n" + input.raw.slice(0, 12000) : ""),
    });
    for (const f of files) {
      if (f.mediaType.startsWith("image/")) parts.push({ type: "image", image: f.bytes });
      else parts.push({ type: "file", data: f.bytes, mediaType: f.mediaType, filename: f.name });
    }
  } else {
    parts.push({ type: "text", text: buildInput(input) });
  }

  const extraction = await extractRecords(parts);
  const findings = detect(extraction);
  const recoverableCents = findings.reduce((s, f) => s + f.amount_cents, 0);
  return {
    jobNumber: extraction.job_number || "RC-" + (4800 + findings.length * 7),
    findings,
    recoverableCents,
    extraction,
  };
}

export { SAMPLE_INPUTS };
