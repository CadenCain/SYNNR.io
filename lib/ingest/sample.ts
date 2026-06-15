import type { CertExtraction, RateSheetExtraction } from "./schemas";

/**
 * Deterministic sample extractions — let the full ingestion + HITL flow run with
 * NO model call (no AI Gateway card required), the same pattern as the audit
 * engine's sample path. Confidence values are chosen to show a realistic mix:
 * some auto-accepted (green), some review (amber), one manual (red).
 */

// A scanned/handwritten H2S card: name/cert read clean, issuing body a bit soft,
// the handwritten expiration date is the one the reviewer must key in.
export const SAMPLE_CERT: CertExtraction = {
  employee_name: { value: "Mike Ross", confidence: 0.98 },
  certification_type: { value: "H2S Clear", confidence: 0.97 },
  issuing_body: { value: "PEC / SafeLand", confidence: 0.86 },
  issued_date: { value: "2025-09-01", confidence: 0.91 },
  expiration_date: { value: "2026-09-01", confidence: 0.58 },
};

export const SAMPLE_CERT_SOURCE = `H2S CLEAR — TRAINING CERTIFICATE  (scanned card)
Name: Mike Ross
Course: H2S Clear (SafeLand-aligned)
Provider: PEC / SafeLand
Issued: 09/01/2025
Expires: 09/01/2026   [handwritten, faint]
Cardholder signature on file.`;

// An Excel rate sheet pasted/scanned — most cells clean, one rate cell smudged,
// one discount cell the model isn't sure about.
export const SAMPLE_RATE_SHEET: RateSheetExtraction = {
  operator_name: { value: "Apex Midstream", confidence: 0.96 },
  effective_date: { value: "2026-01-01", confidence: 0.9 },
  line_items: [
    {
      service_code: { value: "WL-PERF-01", confidence: 0.95 },
      description: { value: "Wireline perforating run", confidence: 0.94 },
      unit: { value: "per run", confidence: 0.93 },
      rate: { value: 4200, confidence: 0.99 },
      negotiated_discount_pct: { value: 10, confidence: 0.82 },
    },
    {
      service_code: { value: "WL-STBY-01", confidence: 0.92 },
      description: { value: "Standby labor", confidence: 0.9 },
      unit: { value: "per hour", confidence: 0.91 },
      rate: { value: 220, confidence: 0.74 },
      negotiated_discount_pct: { value: 0, confidence: 0.97 },
    },
  ],
};

export const SAMPLE_RATE_SHEET_SOURCE = `MSA #882 RATE SHEET — Apex Midstream
Effective: 01/01/2026
WL-PERF-01  Wireline perforating run   per run   $4,200   disc 10%
WL-STBY-01  Standby labor              per hour  $2?0     disc 0%   [smudge]`;
