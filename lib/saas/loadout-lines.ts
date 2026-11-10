/**
 * What a truck has to leave with, and whether it did. Pure, so the phone (as
 * the hand scans) and the server (when the load-out is saved) work it out the
 * same way, and tests pin it.
 *
 * The list comes from three places: the truck's default kit, any packages
 * picked for the job, and quick lines added for today. A line is a kind of
 * piece and how many ("Plug valve 2-inch", 4). Any scanned piece whose name
 * matches fills it; one piece fills one line.
 */

export type LineSource = "kit" | "package" | "plan" | "quick";

export interface ExpectedLine {
  label: string;
  qty: number;
  source: LineSource;
  /** The package's name, for package lines. */
  package?: string;
}

export interface LinePiece { id: string; name: string; serial: string | null }

export interface FilledLine extends ExpectedLine {
  filled: LinePiece[];
}

/** Lowercase words, with 2", 2 in, 2-inch, and 2 inch all read as "2in". */
export function lineTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[\u201c\u201d\u2033]/g, '"').replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/(?:(\d+)(?:-|\s+))?(\d+)\/(\d+)/g, (_m, w, n, d) => String((w ? Number(w) : 0) + Number(n) / Number(d)))
    .replace(/(\d)\s*(?:"|''|-?\s*inch(?:es)?\b|-?\s*in\b\.?)/g, "$1in ")
    .replace(/(\d)\s*(?:'|-?\s*f(?:oo|ee)?t\b\.?)/g, "$1ft ")
    .replace(/#\s*(\d)/g, "#$1")
    .replace(/[^a-z0-9.#]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t && t !== "#" && !STOP.has(t));
}
const STOP = new Set(["a", "an", "the", "of", "and", "for", "with", "w"]);

/** Same words, any order: "2-inch plug valve" is "Plug valve 2"". */
const sameWords = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ");

/** Every word of the line is in the piece's name: "BOP" fills "BOP stack". */
export function lineMatches(label: string, pieceName: string): boolean {
  const want = lineTokens(label);
  if (!want.length) return false;
  const have = new Set(lineTokens(pieceName));
  return want.every((t) => have.has(t));
}

/**
 * Fill each line with scanned pieces. Exact name matches go first, then the
 * most specific lines ("Plug valve 2-inch" before "Plug valve"), so a
 * general line doesn't take the piece a specific line needed.
 */
export function fillLines(lines: ExpectedLine[], scanned: LinePiece[]): FilledLine[] {
  const out: FilledLine[] = lines.map((l) => ({ ...l, qty: Math.max(1, Math.floor(l.qty) || 1), filled: [] }));
  const want = out.map((l) => lineTokens(l.label));
  const exact = (li: number, p: LinePiece) => sameWords(want[li], lineTokens(p.name));
  // Exact-name lines first, then the most specific: same preference as before, but as an order to try, not a final say.
  const order = (p: LinePiece) => out.map((_, i) => i).filter((i) => lineMatches(out[i].label, p.name))
    .sort((a, b) => Number(exact(b, p)) - Number(exact(a, p)) || want[b].length - want[a].length || a - b);
  const prefs = new Map(scanned.map((p) => [p.id, order(p)]));
  // Augmenting paths: a piece can bump another piece to a different line it also fits, so no line is short while a fit exists.
  const place = (p: LinePiece, seen: Set<number>): boolean => {
    for (const li of prefs.get(p.id)!) {
      if (seen.has(li)) continue;
      seen.add(li);
      const line = out[li];
      if (line.filled.length < line.qty) { line.filled.push(p); return true; }
      for (let k = 0; k < line.filled.length; k++) {
        const other = line.filled[k];
        if (place(other, seen)) { line.filled.splice(k, 1, p); return true; }
      }
    }
    return false;
  };
  const used = new Set<string>();
  for (const p of scanned) { if (!used.has(p.id) && place(p, new Set())) used.add(p.id); }
  // Keep each line's pieces in scan order.
  const at = new Map(scanned.map((p, i) => [p.id, i]));
  for (const l of out) l.filled.sort((a, b) => at.get(a.id)! - at.get(b.id)!);
  return out;
}

/** Lines still short of pieces. */
export const shortLines = (filled: FilledLine[]) => filled.filter((l) => l.filled.length < l.qty);

/** Kit, packages, and quick lines into one list. Same label from two sources stays two lines (the kit's plug valves and the package's plug valves both have to be there). */
export function expectedLines(input: {
  kit: { label: string; qty: number }[];
  packages: { name: string; lines: { label: string; qty: number }[] }[];
  /** Extra pieces a manager planned for this job. */
  planned?: { label: string; qty: number }[];
  quick: { label: string; qty: number }[];
}): ExpectedLine[] {
  const clean = (s: string) => s.trim().slice(0, 80);
  return [
    ...input.kit.map((l) => ({ label: clean(l.label), qty: l.qty, source: "kit" as const })),
    ...input.packages.flatMap((p) => p.lines.map((l) => ({ label: clean(l.label), qty: l.qty, source: "package" as const, package: p.name }))),
    ...(input.planned ?? []).map((l) => ({ label: clean(l.label), qty: l.qty, source: "plan" as const })),
    ...input.quick.map((l) => ({ label: clean(l.label), qty: l.qty, source: "quick" as const })),
  ].filter((l) => l.label);
}

/** Where a line on the list came from, in plain words. */
export const lineSourceLabel = (l: { source: LineSource; package?: string }) =>
  l.source === "kit" ? "Truck kit" : l.source === "package" ? l.package ?? "Package" : l.source === "plan" ? "Planned for this job" : "Quick line";

/**
 * In a yard that scans tags only, which pieces have to be scanned off their
 * tag: pressure iron, and anything that fills a line on the list. A hand tool
 * that isn't on the list can still be checked by hand.
 */
export function needsTagScan(p: { name: string; category: string }, lineLabels: string[], testedCategories: Set<string>): boolean {
  return testedCategories.has(p.category) || lineLabels.some((label) => lineMatches(label, p.name));
}

/** A serial or truck name worth taking out of a name: letters and digits both, 3 or more long ("P-01", "R-1", "FE-201"). A bare "1502" or "2" is a size, not a name. */
const nameLike = (s: string) => s.length >= 3 && /[a-z]/i.test(s) && /\d/.test(s);
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/**
 * "Quad BOP stack #3" → "Quad BOP stack": the kind of piece, not the one
 * piece. Also takes out what only names the one piece: its serial and the
 * truck it rides on ("Fluid end, P-01" → "Fluid end"; "Reel R-1, 2-3/8in,
 * 16,400 ft" with serial R-1 → "Reel, 2-3/8in"), and what's left on a reel
 * (1,000 ft or more, which changes every time the tubing is cut). A short
 * length like a pup joint's "10 ft" is part of the kind and stays.
 */
export function pieceKind(name: string, strip: (string | null | undefined)[] = []): string {
  const plain = name.replace(/\s*#\s*\d+\b/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 80);
  let s = name.replace(/\s*#\s*\d+\b/g, " ");
  for (const w of new Set(strip.map((x) => String(x ?? "").trim()).filter(nameLike))) {
    s = s.replace(new RegExp(`(?<![a-z0-9])${escRe(w)}(?![a-z0-9])`, "gi"), " ");
  }
  s = s.replace(/(?<![\d,.])(?:\d{1,3}(?:,\d{3})+|\d{4,})(?:\.\d+)?\s*(?:ft|feet|foot|')(?![a-z])\.?/gi, " ")
    .replace(/\(\s*\)/g, " ");
  // Split on the commas between parts, never one inside a number: "15,000 psi" stays as typed.
  const kind = s.split(/(?<!\d),|,(?!\d{3}(?!\d))/).map((p) => p.replace(/\s+/g, " ").replace(/^[\s\-:;]+|[\s\-:;]+$/g, "")).filter(Boolean).join(", ").slice(0, 80);
  // Nothing that names a kind is left (a piece named just "P-01"): keep the name.
  return /[a-z]/i.test(kind) ? kind : plain;
}

/**
 * A truck's kit from the pieces on it: one line per kind of piece, with how
 * many, in first-seen order. Pass each piece's serial and the truck names
 * (this truck's, or every truck's) so a line names the kind of piece, and
 * any good one of that kind fills it, not only the one that was on it.
 */
export function kitLinesFrom(pieces: (string | { name: string; serial?: string | null })[], truckNames: string[] = []): { label: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const p of pieces) {
    const k = typeof p === "string" ? pieceKind(p, truckNames) : pieceKind(p.name, [p.serial, ...truckNames]);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([label, qty]) => ({ label, qty }));
}

export const pieceLabel = (p: { name: string; serial: string | null }) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`;

/**
 * Why a piece on the load-out blocks it. out_on_job: on another truck's job
 * that hasn't been checked in. signed_out: signed out to someone for more
 * than a shift and only checked on by hand. scanned_since: scanned onto
 * another truck after this phone scanned it.
 */
export interface BadPiece { name: string; serial: string | null; why: "red_tagged" | "out_of_test" | "no_test_date" | "no_test_on_file" | "no_paper" | "needs_redress" | "out_on_job" | "signed_out" | "scanned_since"; detail?: string }

/**
 * Pieces with no test on file that can't go on: pressure iron always, and any
 * piece filling a line on the list that the yard's other iron of that kind
 * carries a test for. Without this, a piece added from a phone ("Quad BOP
 * stack #9", no paper) could fill the BOP line while the real BOP, out of
 * test, rode along marked "not going this trip".
 */
export function untestedPieces(input: {
  scanned: { id: string; name: string; serial: string | null; category: string }[];
  hasTest: Set<string>;
  filled: FilledLine[];
  testedCategories: Set<string>;
  /** Does other iron that would fill this line carry a test? */
  lineIsTested: (label: string) => boolean;
}): (BadPiece & { id: string })[] {
  const lineOf = new Map<string, string>();
  for (const l of input.filled) for (const f of l.filled) lineOf.set(f.id, l.label);
  return input.scanned
    .filter((p) => !input.hasTest.has(p.id))
    .filter((p) => input.testedCategories.has(p.category) || input.filled.some((l) => lineMatches(l.label, p.name) && input.lineIsTested(l.label)))
    .map((p) => ({ id: p.id, name: p.name, serial: p.serial, why: "no_test_on_file" as const }));
}

/**
 * READY or NOT READY, and every reason, in plain words. Anything missing,
 * out of test, or red-tagged makes it NOT READY. There is no "ready with
 * warnings": a hand can't wave a truck through.
 */
export function loadoutVerdict(input: {
  lines: FilledLine[];
  bad: BadPiece[];
  cantFind: { name: string; serial: string | null }[];
  truckPaper: { title: string; detail: string }[];
  /** How many pieces went on. A truck with nothing scanned on isn't READY, list or no list. */
  scanned?: number;
}): { verdict: "ready" | "not_ready"; reasons: string[] } {
  const reasons: string[] = [];
  if (input.scanned === 0) reasons.push("Nothing was scanned onto the truck");
  for (const l of shortLines(input.lines)) {
    reasons.push(`Short: ${l.label}, ${l.filled.length} of ${l.qty} scanned${l.package ? ` (${l.package})` : ""}`);
  }
  for (const p of input.cantFind) reasons.push(`Can't find: ${pieceLabel(p)}`);
  for (const p of input.bad) {
    const what = p.why === "red_tagged" ? "Red-tagged" : p.why === "no_test_date" ? "No test date on file"
      : p.why === "no_test_on_file" ? "No test on file" : p.why === "no_paper" ? "No paper on file"
      : p.why === "needs_redress" ? "Needs redress" : p.why === "out_on_job" ? "Out on another truck's job"
      : p.why === "signed_out" ? "Signed out" : p.why === "scanned_since" ? "Scanned onto another truck after you" : "Out of test";
    reasons.push(`${what}: ${pieceLabel(p)}${p.detail ? `, ${p.detail}` : ""}`);
  }
  for (const t of input.truckPaper) reasons.push(`Truck paper: ${t.title} ${t.detail}`);
  return { verdict: reasons.length ? "not_ready" : "ready", reasons };
}
