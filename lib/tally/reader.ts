import { generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import type { TallyReader, TallyRead } from "./types";
import { SAMPLE_SHEET3 } from "./sample";

const VISION_MODEL = process.env.AI_MODEL_VISION || "anthropic/claude-sonnet-4.5";

/** What the model returns for a photographed tally sheet (raw, no decimal applied). */
const VisionTallySchema = z.object({
  meta: z.object({
    company: z.string().describe("company/header name, or empty"),
    sheetNo: z.string().describe("sheet number, or empty"),
    size: z.string().describe("pipe size e.g. 2 3/8, or empty"),
    tailedBy: z.string().describe("who tallied, or empty"),
    date: z.string().describe("date as written, or empty"),
  }),
  cells: z
    .array(
      z.object({
        joint: z.number().int().describe("1-based joint/row number on the sheet"),
        raw: z.string().describe("the length EXACTLY as written, digits only, decimal implied (e.g. '3134')"),
        confidence: z.number().min(0).max(1).describe("0–1 how sure you are of THIS reading"),
      })
    )
    .describe("one entry per joint, in sheet order"),
  independent: z
    .object({
      jointCount: z.number().int().describe("count the crew wrote, if any"),
      totalFt: z.number().describe("grand/sheet total the crew wrote, if any"),
    })
    .partial()
    .optional(),
});

const VISION_SYSTEM = `You read handwritten oilfield casing/tubing tally sheets from a photo.
Return EVERY joint as { joint, raw, confidence }.

LAYOUT IS DIFFERENT ON EVERY SHEET — sometimes daily, rig to rig. DO NOT assume
any fixed grid, column count, or template. Auto-detect the structure on THIS
image every time:
- Figure out how the sheet is laid out (printed form, free grid, or notebook),
  how many columns of numbers there are, and the reading order (typically top-to-
  bottom within a column, then left-to-right across columns).
- Find the joint numbering it uses (often only every 10th is written, e.g.
  "70", "80"); infer the 1..N sequence for the rest in the order they're read.
- Ignore non-length marks (headers, labels, signatures, totals) — those go in
  meta/independent, not in cells.

CRITICAL RULES:
- "raw" is the length EXACTLY as written, digits only, with the decimal DROPPED
  (write "3134" for 31.34, "3230" for 32.30). Never add a decimal point.
- Set "confidence" honestly per cell: lower it for smudged, overwritten, or
  ambiguous digits. Do NOT guess a confident value for an unclear mark.
- Capture header fields and any crew-written grand/sheet total into
  meta/independent so the totals can be cross-checked.
- Number the joints in the exact order they appear on THIS sheet's layout.`;

/**
 * Cardless reader — returns the MKS Sheet 3 fixture deterministically. No
 * model, no network, no card. The whole pipeline runs on this.
 */
export class SampleReader implements TallyReader {
  constructor(private readonly read_: TallyRead = SAMPLE_SHEET3) {}
  async read(): Promise<TallyRead> {
    // structuredClone so callers can't mutate the shared fixture
    return structuredClone(this.read_);
  }
}

export type VisionInput = {
  /** Image bytes of the tally sheet (photo / scan). */
  image: Uint8Array;
  mediaType?: string;
};

/**
 * Vision reader — reads a real photographed tally sheet via the AI Gateway.
 * Stubbed until the gateway card is configured: it throws a clear, actionable
 * error. When the card is added, implement read() here (generateObject against
 * a tabular schema) and EVERYTHING downstream stays identical — the pipeline
 * only depends on the TallyReader interface, so real vision "just lights up".
 */
export class VisionReader implements TallyReader {
  constructor(private readonly input: VisionInput) {}

  async read(): Promise<TallyRead> {
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.AI_GATEWAY_URL) {
      throw new Error(
        "TallyShot vision is not configured: add the AI Gateway card (AI_GATEWAY_API_KEY) to read real tally photos. The cardless sample path works without it."
      );
    }

    const { object } = await generateObject({
      model: VISION_MODEL,
      schema: VisionTallySchema,
      system: VISION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Read every joint length from this tally sheet." },
            { type: "image", image: this.input.image, mediaType: this.input.mediaType },
          ],
        },
      ] as ModelMessage[],
    });

    return {
      meta: {
        company: object.meta.company || undefined,
        sheetNo: object.meta.sheetNo || undefined,
        size: object.meta.size || undefined,
        tailedBy: object.meta.tailedBy || undefined,
        date: object.meta.date || undefined,
      },
      cells: object.cells.map((c) => ({ joint: c.joint, raw: c.raw, confidence: c.confidence })),
      independent: object.independent,
      usedSample: false,
    };
  }
}
