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
    .replace(/(\d)\s*(?:"|''|-?\s*inch(?:es)?\b|-?\s*in\b\.?)/g, "$1in ")
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t && !STOP.has(t));
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
  const used = new Set<string>();
  const take = (line: FilledLine, ok: (p: LinePiece) => boolean) => {
    for (const p of scanned) {
      if (line.filled.length >= line.qty) return;
      if (!used.has(p.id) && ok(p)) { line.filled.push(p); used.add(p.id); }
    }
  };
  for (const line of out) {
    const want = lineTokens(line.label);
    take(line, (p) => sameWords(want, lineTokens(p.name)));
  }
  const bySpecific = [...out].sort((a, b) => lineTokens(b.label).length - lineTokens(a.label).length);
  for (const line of bySpecific) take(line, (p) => lineMatches(line.label, p.name));
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

/** "Quad BOP stack #3" → "Quad BOP stack": the kind of piece, not the one piece. */
export const pieceKind = (name: string) => name.replace(/\s*#\s*\d+\b/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 80);

/** A truck's kit from the pieces on it: one line per kind of piece, with how many, in first-seen order. */
export function kitLinesFrom(names: string[]): { label: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const n of names) { const k = pieceKind(n); if (k) counts.set(k, (counts.get(k) ?? 0) + 1); }
  return [...counts].map(([label, qty]) => ({ label, qty }));
}

export const pieceLabel = (p: { name: string; serial: string | null }) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`;

export interface BadPiece { name: string; serial: string | null; why: "red_tagged" | "out_of_test" | "no_test_date" | "no_test_on_file"; detail?: string }

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
    .filter((p) => input.testedCategories.has(p.category) || (lineOf.has(p.id) && input.lineIsTested(lineOf.get(p.id)!)))
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
    const what = p.why === "red_tagged" ? "Red-tagged" : p.why === "no_test_date" ? "No test date on file" : p.why === "no_test_on_file" ? "No test on file" : "Out of test";
    reasons.push(`${what}: ${pieceLabel(p)}${p.detail ? `, ${p.detail}` : ""}`);
  }
  for (const t of input.truckPaper) reasons.push(`Truck paper: ${t.title} ${t.detail}`);
  return { verdict: reasons.length ? "not_ready" : "ready", reasons };
}
