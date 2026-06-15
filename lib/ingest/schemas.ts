import { z } from "zod";

/**
 * Module 1 — AI Ingestion Engine schemas. The model self-reports a confidence
 * per FIELD (per the spec's confidence-scored routing design), so the engine
 * can auto-accept the clear cases and route the uncertain ones to HITL review.
 */

export const DOC_TYPES = [
  "CERTIFICATION",
  "RATE_SHEET",
  "FIELD_TICKET",
  "LOADOUT_PHOTO",
  "MSA_DOCUMENT",
  "SOP_DOCUMENT",
  "UNKNOWN",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const ClassificationSchema = z.object({
  document_type: z.enum(DOC_TYPES),
  confidence: z.number().min(0).max(1).describe("0.0–1.0 confidence in the document type"),
});

/** A single extracted value plus the model's self-assessed confidence in it. */
const conf = z.number().min(0).max(1).describe("0.0–1.0 confidence in THIS field's value");
const strField = z.object({ value: z.string(), confidence: conf });
const numField = z.object({ value: z.number(), confidence: conf });

// Phase-1 launch document types: Certifications + Rate Sheets.
export const CertExtractionSchema = z.object({
  employee_name: strField,
  certification_type: strField.describe("e.g. H2S Clear, SafeLand, TWIC, Rigging, BOP"),
  issuing_body: strField,
  issued_date: strField.describe("ISO date YYYY-MM-DD, or empty string if absent"),
  expiration_date: strField.describe("ISO date YYYY-MM-DD, or empty string if absent"),
});
export type CertExtraction = z.infer<typeof CertExtractionSchema>;

export const RateSheetExtractionSchema = z.object({
  operator_name: strField,
  effective_date: strField.describe("ISO date YYYY-MM-DD, or empty string"),
  line_items: z.array(
    z.object({
      service_code: strField.describe("e.g. WL-PERF-01"),
      description: strField,
      unit: strField.describe("e.g. per hour, per run, per foot"),
      rate: numField.describe("USD dollars"),
      negotiated_discount_pct: numField.describe("0–100"),
    })
  ),
});
export type RateSheetExtraction = z.infer<typeof RateSheetExtractionSchema>;

export const FLAGS = ["AUTO_ACCEPTED", "REVIEW_REQUIRED", "MANUAL_ENTRY"] as const;
export type Flag = (typeof FLAGS)[number];

/** Flattened, routed field — one row per extracted value for the HITL screen + DB. */
export type FieldRow = {
  field_path: string; // 'expiration_date', 'line_items[0].rate'
  label: string;
  value: string | number | null;
  confidence: number;
  flag: Flag;
  business_rule_override: boolean;
};

export type IngestionResult = {
  documentType: DocType;
  classificationConfidence: number;
  fields: FieldRow[];
  counts: { auto: number; review: number; manual: number };
  usedSample: boolean;
};
