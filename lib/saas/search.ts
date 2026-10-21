import type { EquipState } from "./equipment";
import type { Place } from "./whereabouts";

/**
 * Yard search, pure: one box that takes a serial ("4471"), a description
 * ("plug valve"), a truck ("CT-03"), a yard ("Odessa"), a rack note, a test
 * name, and a status in plain words ("red-tagged", "missing", "out", "out
 * too long", "out of test", "due"). Status words filter; every other word
 * has to match somewhere on the piece.
 */

export interface SearchablePiece {
  id: string;
  name: string;
  serial: string | null;
  typeLabel: string;
  where: string;
  note: string | null;
  nextTitle: string | null;
  state: EquipState;
  place: Place;
}

export type StatusWant = { state?: EquipState; place?: Place | "out_any" };

const PHRASES: [RegExp, StatusWant][] = [
  [/\bout of test\b|\bexpired\b|\boverdue test\b|\bpast due\b/g, { state: "overdue" }],
  [/\bout too long\b|\btoo long\b|\boverdue\b/g, { place: "out_too_long" }],
  [/\bred[- ]?tag(ged)?\b|\bout of service\b/g, { place: "red_tagged" }],
  [/\bmissing\b|\bcan'?t find\b|\blost\b/g, { place: "missing" }],
  [/\bdue soon\b|\bdue\b/g, { state: "due" }],
  [/\bout on (a )?job\b|\bout\b/g, { place: "out_any" }],
  [/\bon (a |the )?truck\b/g, { place: "on_truck" }],
  [/\bin (the )?yard\b/g, { place: "in_yard" }],
];

export function parseQuery(q: string): { words: string[]; want: StatusWant } {
  let rest = ` ${q.toLowerCase()} `;
  const want: StatusWant = {};
  for (const [re, w] of PHRASES) {
    if (re.test(rest)) {
      if (w.state && !want.state) want.state = w.state;
      if (w.place && !want.place) want.place = w.place;
      rest = rest.replace(re, " ");
    }
    re.lastIndex = 0;
  }
  const words = rest.split(/[\s,]+/).map((w) => w.replace(/[^a-z0-9.#/-]/g, "")).filter((w) => w.length > 0);
  return { words, want };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function searchPieces<P extends SearchablePiece>(pieces: P[], q: string, limit = 50): P[] {
  const { words, want } = parseQuery(q);
  if (!words.length && !want.state && !want.place) return [];
  const scored: { p: P; score: number }[] = [];
  for (const p of pieces) {
    if (want.state && p.state !== want.state) continue;
    if (want.place && (want.place === "out_any" ? !(p.place === "out" || p.place === "out_too_long") : p.place !== want.place)) continue;
    const hay = [p.name, p.serial ?? "", p.typeLabel, p.where, p.note ?? "", p.nextTitle ?? ""].join(" ").toLowerCase();
    const hayN = norm(hay);
    if (!words.every((w) => hay.includes(w) || hayN.includes(norm(w)))) continue;
    // Serial hits first: the number stamped on the iron is how a hand finds it.
    const sn = norm(p.serial ?? "");
    const joined = norm(words.join(""));
    const score = !words.length ? 0 : sn && sn === joined ? 3 : sn && joined && sn.includes(joined) ? 2 : norm(p.name).includes(joined) ? 1 : 0;
    scored.push({ p, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name)).slice(0, limit).map((x) => x.p);
}

/** Trucks and yards by name (and a truck's door number). */
export function matchesName(q: string, ...fields: (string | null | undefined)[]): boolean {
  const { words } = parseQuery(q);
  if (!words.length) return false;
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  const hayN = norm(hay);
  return words.every((w) => hay.includes(w) || hayN.includes(norm(w)));
}
