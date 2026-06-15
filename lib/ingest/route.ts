import type { CertExtraction, RateSheetExtraction, FieldRow, Flag } from "./schemas";

/**
 * Confidence-scored routing (spec §4). Per-field thresholds:
 *  - financial fields (rate, discount) default to a stricter 0.98 auto-accept.
 *  - everything else: ≥0.95 auto, 0.70–0.94 review, <0.70 manual entry.
 * A field that fails a business rule is downgraded to REVIEW regardless of
 * its AI confidence (spec §3 Phase 4).
 */
const AUTO_DEFAULT = 0.95;
const AUTO_FINANCIAL = 0.98;
const REVIEW_FLOOR = 0.7;
const FINANCIAL = /(\.rate$|discount)/i;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
const isISO = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function route(
  field_path: string,
  label: string,
  value: string | number | null,
  confidence: number,
  ruleViolation: boolean
): FieldRow {
  const autoThreshold = FINANCIAL.test(field_path) ? AUTO_FINANCIAL : AUTO_DEFAULT;
  let flag: Flag =
    confidence >= autoThreshold ? "AUTO_ACCEPTED" : confidence >= REVIEW_FLOOR ? "REVIEW_REQUIRED" : "MANUAL_ENTRY";
  // empty value can never auto-accept
  const empty = value === null || value === "" || (typeof value === "number" && Number.isNaN(value));
  if (empty) flag = "MANUAL_ENTRY";
  if (ruleViolation && flag === "AUTO_ACCEPTED") flag = "REVIEW_REQUIRED";
  return { field_path, label, value, confidence, flag, business_rule_override: ruleViolation };
}

export function routeCert(x: CertExtraction): FieldRow[] {
  const exp = x.expiration_date.value || "";
  // Business rule: a cert loaded as current shouldn't already be expired — flag for review.
  const expiredAtIngest = isISO(exp) && exp < todayISO();
  const issued = x.issued_date.value || "";
  const issuedAfterExp = isISO(issued) && isISO(exp) && issued > exp;
  return [
    route("employee_name", "Employee name", x.employee_name.value || null, x.employee_name.confidence, false),
    route("certification_type", "Certification", x.certification_type.value || null, x.certification_type.confidence, false),
    route("issuing_body", "Issuing body", x.issuing_body.value || null, x.issuing_body.confidence, false),
    route("issued_date", "Issued date", issued || null, x.issued_date.confidence, issuedAfterExp),
    route("expiration_date", "Expiration date", exp || null, x.expiration_date.confidence, expiredAtIngest || issuedAfterExp),
  ];
}

export function routeRateSheet(x: RateSheetExtraction): FieldRow[] {
  const rows: FieldRow[] = [
    route("operator_name", "Operator / customer", x.operator_name.value || null, x.operator_name.confidence, false),
    route("effective_date", "Effective date", x.effective_date.value || null, x.effective_date.confidence, false),
  ];
  x.line_items.forEach((li, i) => {
    const rateBad = !(typeof li.rate.value === "number" && li.rate.value > 0); // rate must be a positive number
    const discBad = li.negotiated_discount_pct.value < 0 || li.negotiated_discount_pct.value > 100; // 0–100
    rows.push(
      route(`line_items[${i}].service_code`, `Line ${i + 1} · service code`, li.service_code.value || null, li.service_code.confidence, false),
      route(`line_items[${i}].description`, `Line ${i + 1} · description`, li.description.value || null, li.description.confidence, false),
      route(`line_items[${i}].unit`, `Line ${i + 1} · unit`, li.unit.value || null, li.unit.confidence, false),
      route(`line_items[${i}].rate`, `Line ${i + 1} · rate (USD)`, li.rate.value, li.rate.confidence, rateBad),
      route(`line_items[${i}].negotiated_discount_pct`, `Line ${i + 1} · discount %`, li.negotiated_discount_pct.value, li.negotiated_discount_pct.confidence, discBad)
    );
  });
  return rows;
}

export function countByFlag(fields: FieldRow[]) {
  return {
    auto: fields.filter((f) => f.flag === "AUTO_ACCEPTED").length,
    review: fields.filter((f) => f.flag === "REVIEW_REQUIRED").length,
    manual: fields.filter((f) => f.flag === "MANUAL_ENTRY").length,
  };
}
