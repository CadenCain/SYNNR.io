import { generateObject, type ModelMessage } from "ai";
import {
  ClassificationSchema,
  CertExtractionSchema,
  RateSheetExtractionSchema,
  type DocType,
  type IngestionResult,
} from "./schemas";
import { routeCert, routeRateSheet, countByFlag } from "./route";
import { SAMPLE_CERT, SAMPLE_RATE_SHEET, SAMPLE_CERT_SOURCE, SAMPLE_RATE_SHEET_SOURCE } from "./sample";

const TEXT_MODEL = process.env.AI_MODEL || "anthropic/claude-3.5-haiku";
const VISION_MODEL = process.env.AI_MODEL_VISION || "anthropic/claude-sonnet-4.5";
const CLASSIFY_CONFIDENCE_FLOOR = 0.6; // below this -> UNKNOWN / Unmapped queue

export type IngestPart =
  | { type: "text"; text: string }
  | { type: "image"; image: Uint8Array }
  | { type: "file"; data: Uint8Array; mediaType: string; filename?: string };

export type IngestInput = {
  parts?: IngestPart[];
  /** caller hint or known type; skips classification when provided */
  docHint?: DocType;
  /** no parts + sample:true -> deterministic cardless demo */
  sample?: DocType;
};

const CLASSIFY_SYSTEM = `You are SYNNR's document classifier for oilfield service companies.
Identify the document type. CERTIFICATION = an employee training/safety cert (H2S, SafeLand,
TWIC, rigging, BOP). RATE_SHEET = an operator/customer price book or MSA rate schedule.
FIELD_TICKET, LOADOUT_PHOTO, MSA_DOCUMENT, SOP_DOCUMENT as named. If unsure, return UNKNOWN
with low confidence. Report your confidence honestly.`;

const EXTRACT_SYSTEM = `You are SYNNR's field-document extraction engine.
Extract ONLY the requested fields from the document/image. For EACH field, also return a
confidence between 0 and 1 reflecting how sure you are of THAT specific value (legibility,
ambiguity, handwriting). Dates as ISO YYYY-MM-DD; empty string if a field is truly absent.
Never invent values — a low-confidence empty is better than a confident guess.`;

export function sampleSource(type: DocType): string {
  if (type === "CERTIFICATION") return SAMPLE_CERT_SOURCE;
  if (type === "RATE_SHEET") return SAMPLE_RATE_SHEET_SOURCE;
  return "";
}

/** Classify → extract per type → route every field by confidence + business rules. */
export async function runIngestion(input: IngestInput): Promise<IngestionResult> {
  // --- cardless sample path: no model calls ---
  if (input.sample) {
    if (input.sample === "RATE_SHEET") {
      const fields = routeRateSheet(SAMPLE_RATE_SHEET);
      return { documentType: "RATE_SHEET", classificationConfidence: 0.97, fields, counts: countByFlag(fields), usedSample: true };
    }
    const fields = routeCert(SAMPLE_CERT);
    return { documentType: "CERTIFICATION", classificationConfidence: 0.98, fields, counts: countByFlag(fields), usedSample: true };
  }

  const parts = input.parts ?? [];
  if (!parts.length) throw new Error("no document supplied");
  const hasBinary = parts.some((p) => p.type !== "text");
  const model = hasBinary ? VISION_MODEL : TEXT_MODEL;

  // --- classify (unless hinted) ---
  let docType: DocType = input.docHint ?? "UNKNOWN";
  let classConf = input.docHint ? 1 : 0;
  if (!input.docHint) {
    const { object: c } = await generateObject({
      model,
      schema: ClassificationSchema,
      system: CLASSIFY_SYSTEM,
      messages: [{ role: "user", content: parts }] as ModelMessage[],
    });
    docType = c.confidence < CLASSIFY_CONFIDENCE_FLOOR ? "UNKNOWN" : c.document_type;
    classConf = c.confidence;
  }

  // --- extract per type ---
  if (docType === "CERTIFICATION") {
    const { object } = await generateObject({
      model, schema: CertExtractionSchema, system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: parts }] as ModelMessage[],
    });
    const fields = routeCert(object);
    return { documentType: docType, classificationConfidence: classConf, fields, counts: countByFlag(fields), usedSample: false };
  }
  if (docType === "RATE_SHEET") {
    const { object } = await generateObject({
      model, schema: RateSheetExtractionSchema, system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: parts }] as ModelMessage[],
    });
    const fields = routeRateSheet(object);
    return { documentType: docType, classificationConfidence: classConf, fields, counts: countByFlag(fields), usedSample: false };
  }

  // Unknown / not-yet-supported type -> Unmapped queue (no fields extracted).
  return { documentType: docType, classificationConfidence: classConf, fields: [], counts: { auto: 0, review: 0, manual: 0 }, usedSample: false };
}
