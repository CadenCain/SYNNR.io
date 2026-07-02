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
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** All parseable dates in the text, as ISO strings. Exposed for tests. */
export function datesInText(text: string): string[] {
  const out = new Set<string>();
  const t = text.replace(/\s+/g, " ");

  // 2027-06-15 / 2027/6/15
  for (const m of t.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const d = iso(+m[1], +m[2], +m[3]);
    if (d) out.add(d);
  }
  // 06/15/2027, 6-15-27
  for (const m of t.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/g)) {
    const d = iso(+m[3], +m[1], +m[2]);
    if (d) out.add(d);
  }
  // 15 Jun 2027 / 15 JUNE, 2027
  for (const m of t.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2}|\d{2})\b/g)) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) { const d = iso(+m[3], mo, +m[1]); if (d) out.add(d); }
  }
  // Jun 15, 2027 / JUNE 15 2027
  for (const m of t.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2}|\d{2})\b/g)) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) { const d = iso(+m[3], mo, +m[2]); if (d) out.add(d); }
  }
  // 06/2027 (month-year only → last day of that month)
  for (const m of t.matchAll(/\b(\d{1,2})\s*[/-]\s*(20\d{2})\b/g)) {
    const mo = +m[1];
    if (mo >= 1 && mo <= 12) {
      const last = new Date(Date.UTC(+m[2], mo, 0)).getUTCDate();
      const d = iso(+m[2], mo, last);
      if (d) out.add(d);
    }
  }
  return [...out];
}

/** The most plausible expiration: latest FUTURE date within 15 years. */
export function pickExpiration(dates: string[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const ceiling = `${new Date().getFullYear() + 15}-12-31`;
  const future = dates.filter((d) => d > today && d <= ceiling).sort();
  return future.length ? future[future.length - 1] : null;
}

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
