/**
 * A deliberately messy sample job (field ticket + invoice + pricebook) used
 * when no readable uploads are available, so the engine always has something
 * real to reconcile. Mirrors the kind of mixed-format input SYNNR targets.
 */
export const SAMPLE_INPUTS = {
  ticket: `FIELD TICKET — Job RC-4821 (Pad 14 turnaround) — Apex Midstream
Crew B-7 / Mike Ross. Closed 08/14/2025.
- Crane & rigging: 4 days on site
- Standby (waiting on company man): 6.5 hrs logged
- Consumables used: rigging straps, chemical, misc (42 line items, see attached)
Backup photos attached: 2 of 5 required.
Customer signature: NOT SIGNED (foreman left early)`,
  invoice: `DRAFT INVOICE — Job RC-4821 — Apex Midstream
- Crane & rigging — 4 days @ $1,250.00/day = $5,000.00
- Standby — 0 hrs billed
(consumables not itemized on this invoice)`,
  pricebook: `MSA #882 RATE SHEET — Apex Midstream
- Crane & rigging: $1,795.00 / day
- Standby labor: $220.00 / hr
- Consumables: billed at cost + 15% per pricebook`,
};

export type EngineInput = { ticket?: string; invoice?: string; pricebook?: string; raw?: string };

export function buildInput(parts: EngineInput) {
  // Real uploaded text (mixed formats) — let the model separate ticket /
  // invoice / pricebook lines itself.
  if (parts.raw && parts.raw.trim()) {
    return `Reconcile this job. The documents below are real, mixed-format uploads (field tickets, invoices, pricebooks/MSAs). Extract typed records — ticket lines (performed), invoice lines (billed, with rates), pricebook/MSA rates, signature presence, and photo counts.\n\n${parts.raw.slice(0, 24000)}`;
  }
  const t = parts.ticket || SAMPLE_INPUTS.ticket;
  const i = parts.invoice || SAMPLE_INPUTS.invoice;
  const p = parts.pricebook || SAMPLE_INPUTS.pricebook;
  return `Reconcile this job. Extract typed records from the three documents below.\n\n=== FIELD TICKET ===\n${t}\n\n=== DRAFT INVOICE ===\n${i}\n\n=== PRICEBOOK / MSA ===\n${p}`;
}

/**
 * Pre-extracted records for the sample job above — lets sample runs execute
 * the deterministic detectors with NO model call (no AI Gateway required).
 * Math: standby 6.5 hr × $220 = $1,430 missed; consumables 6 lots × $160 =
 * $960 missed; crane ($1,795 − $1,250) × 4 days = $2,180 rate. Total $4,570,
 * plus 2 doc blockers (2/5 photos, unsigned ticket).
 */
export const SAMPLE_EXTRACTION = {
  job_number: "RC-4821",
  signature_present: false,
  photos_attached: 2,
  photos_required: 5,
  ticket_lines: [
    { code: "crane", label: "Crane & rigging", qty: 4, unit: "day" },
    { code: "standby", label: "Standby labor", qty: 6.5, unit: "hr" },
    { code: "consumables", label: "Consumables", qty: 6, unit: "lot" },
  ],
  invoice_lines: [
    { code: "crane", label: "Crane & rigging", qty: 4, rate_cents: 125000, unit: "day" },
  ],
  pricebook: [
    { code: "crane", label: "Crane & rigging", contract_rate_cents: 179500, unit: "day" },
    { code: "standby", label: "Standby labor", contract_rate_cents: 22000, unit: "hr" },
    { code: "consumables", label: "Consumables", contract_rate_cents: 16000, unit: "lot" },
  ],
} as const;
