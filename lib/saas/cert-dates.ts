/**
 * Date reading for cert photos. Pure, so the phone (to pre-fill the date)
 * and the server (to check it) read the paper exactly the same way.
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

/**
 * OCR reads a phone photo of a cert with the usual letter/digit swaps:
 * "2O27", "O3/26", "l2/31". Fix them only where they sit between or beside
 * digits and date separators, so words stay words.
 */
export function normalizeOcr(text: string): string {
  let t = text.replace(/\s+/g, " ");
  const swap: Record<string, string> = { O: "0", o: "0", Q: "0", D: "0", I: "1", l: "1", "|": "1", i: "1", S: "5", s: "5", B: "8", Z: "2", z: "2" };
  // Repeat: a run like "2O2l" needs two passes to settle.
  for (let pass = 0; pass < 2; pass++) {
    t = t.replace(/(?<=[\d/.-])[OoQDIl|iSsBZz](?=[\d/.-])/g, (c) => swap[c] ?? c);
    t = t.replace(/(?<=\d)[OoQDIl|iSsBZz](?=\d)/g, (c) => swap[c] ?? c);
    t = t.replace(/\b[OoQD](?=\d[/.-])/g, "0");
  }
  return t;
}

export interface FoundDate {
  iso: string;
  /** "EXP 03/2027" style: the card names a month, not a day. iso is the last day of it. */
  monthOnly: boolean;
}

/** Every parseable date on the page, with whether it named a day. */
export function findDates(text: string): FoundDate[] {
  const out = new Map<string, FoundDate>();
  const add = (d: string | null, monthOnly: boolean) => {
    if (!d) return;
    const prev = out.get(d);
    if (!prev || (prev.monthOnly && !monthOnly)) out.set(d, { iso: d, monthOnly });
  };
  const t = normalizeOcr(text);

  // 2027-06-15 / 2027/6/15
  for (const m of t.matchAll(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) add(iso(+m[1], +m[2], +m[3]), false);
  // 06/15/2027, 6-15-27 (US order: this is West Texas paper)
  for (const m of t.matchAll(/\b(\d{1,2})\s?[-/.]\s?(\d{1,2})\s?[-/.]\s?(20\d{2}|\d{2})\b/g)) add(iso(+m[3], +m[1], +m[2]), false);
  // 15 Jun 2027 / 15 JUNE, 2027
  for (const m of t.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(20\d{2}|\d{2})\b/g)) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo) add(iso(+m[3], mo, +m[1]), false);
  }
  // Jun 15, 2027 / JUNE 15 2027
  for (const m of t.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(20\d{2}|\d{2})\b/g)) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) add(iso(+m[3], mo, +m[2]), false);
  }
  // 06/2027 and JUN 2027 (month-year only: the last day of that month)
  const lastDay = (y: number, mo: number) => iso(y, mo, new Date(Date.UTC(y, mo, 0)).getUTCDate());
  for (const m of t.matchAll(/(?<![\d/.-])(\d{1,2})\s*[/-]\s*(20\d{2})\b/g)) {
    const mo = +m[1];
    if (mo >= 1 && mo <= 12) add(lastDay(+m[2], mo), true);
  }
  // (not "15 June 2027": that one names a day and was read above)
  for (const m of t.matchAll(/(?<!\d[\s.,-]*)\b([A-Za-z]{3,9})\.?,?\s+(20\d{2})\b/g)) {
    const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo) add(lastDay(+m[2], mo), true);
  }
  return [...out.values()];
}

/** All parseable dates in the text, as ISO strings. */
export function datesInText(text: string): string[] {
  return findDates(text).map((d) => d.iso);
}

/** The most plausible expiration: the latest future date within 15 years. */
export function pickExpiration(dates: string[], today: string = new Date().toISOString().slice(0, 10)): string | null {
  const ceiling = `${Number(today.slice(0, 4)) + 15}-12-31`;
  const future = dates.filter((d) => d > today && d <= ceiling).sort();
  return future.length ? future[future.length - 1] : null;
}

/** Does the paper carry this date? An exact day, or a month-only date in the same month. */
export function paperHasDate(found: FoundDate[], date: string): boolean {
  return found.some((f) => f.iso === date || (f.monthOnly && f.iso.slice(0, 7) === date.slice(0, 7)));
}

/** "2027-03-26" → "03/26/2027", the way the paper usually prints it. */
export function usDate(isoDate: string): string {
  return `${isoDate.slice(5, 7)}/${isoDate.slice(8, 10)}/${isoDate.slice(0, 4)}`;
}
