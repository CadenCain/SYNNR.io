import { generateObject } from "ai";
import { ExtractionSchema, type Extraction } from "./schemas";

// AI Gateway model id (override with AI_MODEL). On Vercel, gateway auth is
// automatic; locally set AI_GATEWAY_API_KEY.
const MODEL = process.env.AI_MODEL || "anthropic/claude-3.5-haiku";

const SYSTEM = `You are SYNNR's field-billing extraction engine.
Extract ONLY typed facts from the documents — do NOT judge what is under-billed
or owed; downstream code does that. Rules:
- Convert every dollar amount to integer cents (e.g. $1,795.00 -> 179500).
- Use short stable codes per concept and reuse the SAME code across ticket,
  invoice, and pricebook so they can be matched (e.g. "crane", "standby", "consumables").
- ticket_lines.qty = quantity actually performed; invoice_lines.qty = quantity billed.
- If a value is absent, use 0 (qty/rate) or sensible defaults; never invent charges.`;

export async function extractRecords(input: string): Promise<Extraction> {
  const { object } = await generateObject({
    model: MODEL,
    schema: ExtractionSchema,
    system: SYSTEM,
    prompt: input,
  });
  return object;
}
