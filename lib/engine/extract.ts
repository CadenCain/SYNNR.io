import { generateObject, type ModelMessage } from "ai";
import { ExtractionSchema, type Extraction } from "./schemas";

// Text-only extraction is cheap (haiku); when binary docs/images are attached we
// use a vision/PDF-capable model. Both overridable via env. On Vercel, AI
// Gateway auth is automatic; locally set AI_GATEWAY_API_KEY.
const TEXT_MODEL = process.env.AI_MODEL || "anthropic/claude-3.5-haiku";
const VISION_MODEL = process.env.AI_MODEL_VISION || "anthropic/claude-sonnet-4.5";

export type EnginePart =
  | { type: "text"; text: string }
  | { type: "image"; image: Uint8Array }
  | { type: "file"; data: Uint8Array; mediaType: string; filename?: string };

const SYSTEM = `You are SYNNR's field-billing extraction engine.
Extract ONLY typed facts from the documents/images — do NOT judge what is
under-billed or owed; downstream code does that. Rules:
- Convert every dollar amount to integer cents (e.g. $1,795.00 -> 179500).
- Use short stable codes per concept and reuse the SAME code across ticket,
  invoice, and pricebook so they can be matched (e.g. "crane", "standby", "consumables").
- ticket_lines.qty = quantity actually performed; invoice_lines.qty = quantity billed.
- For images/scans: read handwriting and stamps; report signature_present and
  photo counts from what you can see.
- If a value is absent, use 0 (qty/rate) or sensible defaults; never invent charges.`;

export async function extractRecords(parts: EnginePart[]): Promise<Extraction> {
  const hasBinary = parts.some((p) => p.type !== "text");
  const model = hasBinary ? VISION_MODEL : TEXT_MODEL;
  const { object } = await generateObject({
    model,
    schema: ExtractionSchema,
    system: SYSTEM,
    messages: [{ role: "user", content: parts }] as ModelMessage[],
  });
  return object;
}
