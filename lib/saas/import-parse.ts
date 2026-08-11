/**
 * The pure half of the importer — parsing and normalization, extracted from
 * the "use server" action so it can be pressure-tested directly. Nothing in
 * here touches the database; the action composes these and does the writes.
 */

/** Minimal CSV: quoted fields, escaped quotes, CRLF, blank-line skip. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (q) {
        if (ch === '"' && raw[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export const matchValue = (input: string, list: { value: string; label: string }[], fallback: string) => {
  const n = norm(input);
  return list.find((x) => x.value === n || norm(x.label) === n)?.value ?? (input ? n : fallback);
};

/**
 * Accept YYYY-MM-DD or M/D/YYYY (Excel default). Returns ISO or null; throws
 * a plain-English label on garbage.
 *
 * The round-trip check exists because "13/45/2026" used to sail through as
 * "2026-13-45": the dry-run preview does no DB writes, so an impossible date
 * passed preview clean and then blew up halfway through commit — breaking the
 * promise that preview shows every error before anything is written.
 */
export function parseDate(s: string): string | null {
  if (!s) return null;
  let iso: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  else {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  if (iso) {
    const [y, mo, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return iso;
    throw new Error(`impossible date "${s}" — check month and day`);
  }
  throw new Error(`bad date "${s}" (use YYYY-MM-DD or M/D/YYYY)`);
}
