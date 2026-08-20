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

/**
 * Header → column mapping for the bulk importer. Real yard spreadsheets never
 * agree on names: the same column arrives as "Asset ID", "Serial Number",
 * "Unit #", or "Equipment Tag" depending on who built the sheet. Every alias
 * is normalized through norm() first ("Unit #" → "unit", "Serial Number" →
 * "serial_number"), so punctuation and casing never matter. First alias hit
 * wins; a header that matches nothing is simply ignored (never a crash).
 *
 * Collision rule: "type" belongs to the unit — cert kinds must say "kind" or
 * "cert type". Deliberately absent: bare "name" (ambiguous between unit,
 * asset, and crew sheets) and "date" (ambiguous between issued and expires).
 */
export const HEADER_ALIASES = {
  unit: ["unit", "unit_name", "unit_number", "unit_no", "unit_id", "truck", "truck_number", "truck_no", "vehicle", "vehicle_number", "rig", "rig_number"],
  unitType: ["unit_type", "type"],
  asset: ["asset", "asset_name", "asset_id", "asset_tag", "asset_number", "equipment", "equipment_tag", "equipment_id", "equipment_number", "serial", "serial_number", "serial_no", "sn", "tag", "tag_number"],
  category: ["category", "asset_category", "class"],
  crew: ["crew", "crew_member", "hand", "employee", "worker", "driver", "operator", "technician", "tech"],
  item: ["item", "cert", "certification", "certificate", "title", "inspection", "document", "doc", "card"],
  kind: ["kind", "item_kind", "cert_kind", "item_type", "cert_type"],
  issued: ["issued", "issued_date", "issue_date", "issued_on", "date_issued", "effective_date"],
  expires: ["expires", "expiration", "expiration_date", "expires_at", "expiry", "expiry_date", "exp_date", "due", "due_date", "renewal", "renewal_date", "valid_until", "valid_through", "good_through"],
} as const;

export type HeaderMap = Record<keyof typeof HEADER_ALIASES, number>;

/** Raw header row → column indexes (-1 = column absent). */
export function mapHeader(rawHeader: string[]): HeaderMap {
  const header = rawHeader.map(norm);
  const idx = (names: readonly string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const out = {} as HeaderMap;
  for (const key of Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]) {
    out[key] = idx(HEADER_ALIASES[key]);
  }
  return out;
}

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
