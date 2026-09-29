import path from "node:path";
import { findDates } from "./cert-dates";

/**
 * Read the text off a cert photo, on the server. The phone reads it too, to
 * pre-fill the date, but a phone can be made to say anything; this is the
 * read the checks trust.
 *
 * Tesseract, no AI. The English model ships with the app
 * (lib/saas/ocr-data), so a read never depends on a CDN being up.
 * Returns null when the photo can't be read at all, which the caller treats
 * as "a manager looks at it", never as a pass.
 */

const LANG_PATH = path.join(process.cwd(), "lib", "saas", "ocr-data");
const READ_TIMEOUT_MS = 20_000;

/**
 * Straighten by the phone's EXIF, shrink, go grayscale. Two looks at it:
 * contrast-limited equalization first (evens out shade and glare without
 * blowing up the grain), plain grayscale as the second try. A full
 * contrast stretch was tried and dropped: on a clean white card it turned
 * JPEG grain into noise and the date came back as garbage.
 */
async function prepare(buf: Buffer): Promise<Buffer[]> {
  try {
    const sharp = (await import("sharp")).default;
    const base = () => sharp(buf).rotate()
      .resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true })
      .grayscale();
    return [
      await base().clahe({ width: 64, height: 64, maxSlope: 3 }).jpeg({ quality: 92 }).toBuffer(),
      await base().jpeg({ quality: 92 }).toBuffer(),
    ];
  } catch {
    return [buf];
  }
}

/** A read is only as good as the dates it finds, then the words. */
const score = (text: string) => findDates(text).length * 1000 + text.replace(/[^A-Za-z0-9]/g, "").length;

interface OcrWorker { recognize: (img: Buffer) => Promise<{ data: { text?: string } }>; terminate: () => Promise<unknown> }

export async function readPhotoText(buf: Buffer): Promise<string | null> {
  const box: { worker: OcrWorker | null } = { worker: null };
  // One clock around everything, starting the reader included: a reader that
  // can't start must fail fast (and the upload goes to a manager), not hang
  // the request until the platform kills it.
  const timeout = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), READ_TIMEOUT_MS));
  const work = (async () => {
    const imgs = await prepare(buf);
    const { createWorker } = await import("tesseract.js");
    const worker = (await createWorker("eng", 1, {
      langPath: LANG_PATH,
      gzip: false,
      cacheMethod: "none",
      errorHandler: (e: unknown) => console.error("[cert-read] worker error:", e),
    })) as unknown as OcrWorker;
    box.worker = worker;
    let best = "";
    for (const img of imgs) {
      const { data } = await worker.recognize(img);
      const text = data.text ?? "";
      if (score(text) > score(best)) best = text;
      if (findDates(best).length > 0) break; // good enough: don't spend a second read
    }
    return best;
  })();
  try {
    const res = await Promise.race([work, timeout]);
    if (res === "timeout") {
      console.error("[cert-read] timed out");
      return null;
    }
    return res;
  } catch (e) {
    console.error("[cert-read] failed:", e instanceof Error ? e.message : e);
    return null;
  } finally {
    work.catch(() => {});
    if (box.worker) await box.worker.terminate().catch(() => {});
  }
}
