"use client";

/**
 * Read a likely EXPIRATION date off a cert/DOT proof photo — the trust-layer
 * pattern operators actually asked for: the machine reads, the human closes
 * the gap. The extracted date is NEVER saved without explicit confirmation;
 * callers must hold it in an "unconfirmed" state until the user accepts or
 * corrects it.
 *
 * Tesseract.js runs fully client-side (wasm; models fetched on first use, so
 * nothing loads unless a photo is picked). If no plausible FUTURE date is
 * found we return null — a wrong guess is worse than no guess.
 */
import { datesInText, pickExpiration } from "./saas/cert-dates";

// The parsing lives in lib/saas/cert-dates.ts so the server reads paper the
// same way the phone does. Re-exported for the existing tests.
export { datesInText, pickExpiration };

export async function extractExpirationDate(file: File): Promise<string | null> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(file);
    await worker.terminate();
    return pickExpiration(datesInText(data.text ?? ""));
  } catch (e) {
    console.error("[ocr] read failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
