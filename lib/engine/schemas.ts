import { z } from "zod";

/**
 * What the LLM is asked to EXTRACT from messy job inputs. It only pulls typed
 * numbers — it never decides what's under-billed. The detectors (detect.ts) do
 * the deciding in deterministic code, so every finding is auditable.
 */
export const ExtractionSchema = z.object({
  job_number: z.string().nullable().describe("job / ticket number if present"),
  signature_present: z.boolean().describe("is the field ticket signed by the customer?"),
  photos_attached: z.number().int().describe("count of backup photos attached"),
  photos_required: z.number().int().describe("count of backup photos required for this job type"),
  ticket_lines: z.array(
    z.object({
      code: z.string().describe("short stable code, e.g. 'standby', 'crane', 'consumables'"),
      label: z.string(),
      qty: z.number().describe("quantity actually performed per the field ticket"),
      unit: z.string().nullable(),
    })
  ),
  invoice_lines: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      qty: z.number().describe("quantity billed on the invoice"),
      rate_cents: z.number().int().describe("billed rate in integer cents (e.g. $185.00 -> 18500)"),
      unit: z.string().nullable(),
    })
  ),
  pricebook: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      contract_rate_cents: z.number().int().describe("contracted/MSA rate in integer cents"),
      unit: z.string().nullable(),
    })
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export type EngineFinding = {
  type: "missed" | "rate" | "doc";
  title: string;
  subtitle: string;
  amount_cents: number;
  blocker: string | null;
  evidence: { label: string; ok: boolean; detail: string }[];
};
