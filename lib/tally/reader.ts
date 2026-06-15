import type { TallyReader, TallyRead } from "./types";
import { SAMPLE_SHEET3 } from "./sample";

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
    // Intentionally not implemented yet — wiring point for generateObject vision.
    // It must return a TallyRead in the exact same shape as SampleReader.
    void this.input;
    throw new Error("TallyShot VisionReader.read() not implemented yet — sample path is the cardless demo.");
  }
}
