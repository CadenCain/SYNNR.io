/**
 * The brain: a shop's own documents, cut into passages a question can be
 * answered from. Pure rules, shared by the server and the screen, so the
 * way a document is cut up, and what counts as an answer, is in one place.
 */

/** What a document is, in the shop's words. */
export const DOC_KINDS = [
  { id: "procedure", label: "How we do it", hint: "Procedures, rig-up and rig-down, checklists, safety" },
  { id: "contract", label: "Customer terms", hint: "MSAs, bids, what a customer requires on location" },
  { id: "pricing", label: "Pricing", hint: "Price sheets, rates, what you charge and when" },
  { id: "report", label: "Job reports", hint: "Operation reports, post-job write-ups, tickets" },
  { id: "note", label: "Notes", hint: "What everybody knows and nobody wrote down" },
  { id: "other", label: "Other", hint: "Anything else the crew should be able to ask about" },
] as const;
export type DocKind = (typeof DOC_KINDS)[number]["id"];
export const isDocKind = (v: unknown): v is DocKind => DOC_KINDS.some((k) => k.id === v);
export const kindLabel = (k: string | null | undefined) => DOC_KINDS.find((x) => x.id === k)?.label ?? "Other";

export type Doc = {
  id: string; title: string; kind: DocKind; origin: "file" | "note" | "sample";
  file_name: string | null; bytes: number | null; pages: number | null;
  status: "reading" | "ready" | "failed"; problem: string | null; chars: number;
  managers_only: boolean; added_by_name: string | null; created_at: string;
};

/** One passage of a document. */
export type Piece = { idx: number; section: string | null; page: number | null; body: string };

/** A passage is about this long: enough to hold a clause or a step with what's around it. */
export const CHUNK_TARGET = 1100;
export const CHUNK_MAX = 1800;
/** The most passages one document is cut into (around 700 pages). Past that, it's loaded in parts. */
export const MAX_CHUNKS = 1500;
/** A note typed or pasted in. */
export const MAX_NOTE_CHARS = 200_000;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Text as it came out of a file, made plain: one kind of line break, no stray control characters. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f﻿]/g, "")
    .replace(/ /g, " ")
    // A word broken across a line by a hyphen is one word.
    .replace(/([a-z])-\n([a-z])/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const SMALL = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "/", "-", "&"]);

/**
 * Whether a line is a heading: "7. Standby", "ARTICLE IV", "RIG UP", a
 * markdown "#", or a short line ending in a colon. A numbered step that
 * ends in a period is a sentence, not a heading.
 */
export function isHeading(line: string): boolean {
  const s = line.trim();
  if (s.length < 3 || s.length > 90) return false;
  if (/^#{1,6}\s+\S/.test(s)) return true;
  const n = words(s).length;
  if (n > 12) return false;
  if (/[.;,]$/.test(s)) return false;
  if (/^(article|section|exhibit|appendix|schedule|attachment|part)\s+[\dA-Za-z]+\b/i.test(s)) return true;
  // "7. Standby", "7.2 Standby Time", "3. Rates and Charges": a number, then a few capitalized words.
  // "3. Pressure test to 5,000 psi" is a step, and stays with the steps around it.
  const numbered = s.match(/^\d{1,2}(\.\d{1,2}){0,3}[.)]?\s+(.+)$/);
  if (numbered) {
    const rest = words(numbered[2]);
    return rest.length <= 6 && rest.every((w) => /^[A-Z(&]/.test(w) || SMALL.has(w.toLowerCase()));
  }
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 4 && letters === letters.toUpperCase() && n <= 9) return true;
  if (/:$/.test(s) && s.length <= 60 && n <= 7) return true;
  return false;
}

/** A few words starting with a capital and ending without a full stop: the look of a plain heading. */
const isTitleLine = (line: string) => {
  const t = line.trim();
  return t.length >= 3 && t.length <= 48 && words(t).length <= 6 && /^[A-Z]/.test(t) && !/[.,;!?]$/.test(t) && t.replace(/[^A-Za-z]/g, "").length >= 3;
};

const headingText = (line: string) => line.trim().replace(/^#{1,6}\s+/, "").replace(/:$/, "").slice(0, 160);

/** A line too long to be one passage, cut at the ends of sentences. */
function splitLong(line: string): string[] {
  if (line.length <= CHUNK_MAX) return [line];
  const out: string[] = [];
  let cur = "";
  for (const s of line.split(/(?<=[.!?;])\s+/)) {
    // A "sentence" with no end in sight is cut where it has to be.
    for (let i = 0; i < s.length; i += CHUNK_MAX) {
      const part = s.slice(i, i + CHUNK_MAX);
      if (cur && cur.length + part.length + 1 > CHUNK_TARGET) { out.push(cur); cur = part; }
      else cur = cur ? `${cur} ${part}` : part;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Cut a document into passages. A heading starts a new one (so a passage is
 * a section, or part of one, and says which); otherwise a passage ends at
 * the end of a sentence once it's long enough. `pages` is the text a page
 * at a time for a PDF, or the whole text as one entry for anything else.
 */
export function chunkPages(pages: string[], paged = pages.length > 1): Piece[] {
  const out: Piece[] = [];
  let lines: string[] = [];
  let size = 0;
  // How much of the passage so far is writing, not headings.
  let content = 0;
  let section: string | null = null;
  let startSection: string | null = null;
  let startPage: number | null = null;

  const flush = () => {
    const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (body && out.length < MAX_CHUNKS) out.push({ idx: out.length, section: startSection, page: startPage, body: body.slice(0, 3800) });
    lines = []; size = 0; content = 0;
  };

  // Every line with the page it's on, so a line can be judged by what comes before and after it.
  const all: { line: string; page: number | null }[] = [];
  pages.forEach((raw, p) => {
    for (const full of tidy(raw).split("\n")) for (const line of splitLong(full)) all.push({ line, page: paged ? p + 1 : null });
  });

  all.forEach(({ line, page }, i) => {
    // A short line standing on its own, with a paragraph under it, is a heading too ("Standby", "On location").
    const alone = (i === 0 || !all[i - 1].line.trim()) && isTitleLine(line) && (all.slice(i + 1).find((x) => x.line.trim())?.line.trim().length ?? 0) >= 40;
    const heading = isHeading(line) || alone;
    // A heading closes what came before it: a clause is its own passage, however short, and says which clause it is.
    if (heading && content >= 40) flush();
    // A line that would run the passage over its length starts the next one.
    if (size > 0 && size + line.length + 1 > CHUNK_MAX) flush();
    if (heading) section = headingText(line);
    if (size === 0) { if (!line.trim()) return; startSection = section; startPage = page; }
    // Nothing but headings so far (a title, then the first section): the passage goes by the latest one.
    // A line or two under one heading, then another: the passage holds both, and says both.
    else if (heading) startSection = content === 0 || !startSection ? section : `${startSection} / ${section}`.slice(0, 160);
    lines.push(line);
    size += line.length + 1;
    if (!heading) content += line.trim().length;
    const ends = !line.trim() || /[.!?:;)\]]$/.test(line.trim());
    if (size >= CHUNK_MAX || (size >= CHUNK_TARGET && ends)) flush();
  });
  flush();
  return out;
}

/** What the person asking is shown, and what's kept. */
export type Source = {
  /** The number it's cited by, from 1. */
  n: number;
  from: "doc" | "list";
  /** The document, or the job list. */
  id: string;
  title: string;
  /** "Customer terms", "Job list". */
  type: string;
  section: string | null;
  page: number | null;
  idx: number | null;
  body: string;
};
export type AnswerPart = { text: string; cites: number[] };
export type Answer = {
  /** Written from the passages, the passages themselves, or nothing found. */
  how: "ai" | "passages" | "none";
  parts: AnswerPart[];
  sources: Source[];
  /** Something the person should know about this answer, in plain words. */
  note?: string | null;
};

/** Where a source is, the way a person would say it: "Section 7, Standby · page 4". */
export function sourceWhere(s: Pick<Source, "section" | "page">): string {
  return [s.section, s.page ? `page ${s.page}` : null].filter(Boolean).join(" · ");
}

/** The words of a question that carry meaning, for matching a job list by hand. */
const STOP = new Set("a an and are as at be by do does for from how i in is it of on or our that the this to we what when where which who with you your take takes need needs bring go goes out job jobs".split(" "));
export function keyWords(text: string): string[] {
  return [...new Set(text.toLowerCase().replace(/[^a-z0-9/.\-\s]/g, " ").split(/\s+/).map((w) => w.replace(/^[-.]+|[-.]+$/g, "")).filter((w) => w.length > 1 && !STOP.has(w)))];
}

/** Words that pad a question and say nothing about what it's after. */
const FILLER = new Set("say says said tell tells told know knows much many long get gets got use uses used want wants please thing things anything something someone anyone would could should shall may might must also like have has had about there their them they his her its was were will been being can any all make makes made let lets give gives happen happens kind".split(" "));

/** The words of a question that say what it's about, as the database splits them. */
export function askedWords(question: string): string[] {
  return [...new Set(question.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w) && !FILLER.has(w)))];
}

/** A few words the way a person would list them: “hotel”, “lodging” or “per diem”. */
export function quoted(words: string[]): string {
  const q = words.map((w) => `“${w}”`);
  return q.length <= 1 ? q.join("") : `${q.slice(0, -1).join(", ")} or ${q[q.length - 1]}`;
}

/**
 * What an answer should open with when the question uses words that none
 * of the shop's documents or job lists do. `missing` is what the database
 * says no document mentions; `lists` is every word on the shop's job
 * lists. Null when every word that matters is in there somewhere.
 *
 * Most of what was asked about missing: there is nothing to answer from,
 * and it says so. Some of it missing: the passages it found are only the
 * closest, and it says which word they don't have.
 */
export function unknownSays(question: string, missing: string[], lists: string[] = []): { none: boolean; text: string } | null {
  const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
  const onLists = new Set(lists.flatMap((l) => l.toLowerCase().split(/[^a-z0-9]+/)).map(stem));
  const asked = askedWords(question);
  const unknown = asked.filter((w) => missing.includes(w) && !onLists.has(stem(w)));
  if (!unknown.length) return null;
  const names = quoted(unknown.slice(0, 4));
  const none = unknown.length * 2 > asked.length;
  return { none, text: none ? `Your documents never mention ${names}. I won't guess.` : `Your documents never mention ${names}. These are the closest passages, word for word.` };
}

/**
 * How well a job list fits a question: every word of the list's name that
 * the question has counts for a lot, a word found in its lines counts a
 * little. Zero means it has nothing to do with it.
 */
export function listScore(question: string, list: { name: string; lines: string[] }): number {
  const asked = keyWords(question);
  if (!asked.length) return 0;
  const name = keyWords(list.name);
  const body = new Set(list.lines.flatMap(keyWords));
  const stem = (w: string) => w.replace(/(ing|ed|es|s)$/, "");
  const inName = asked.filter((w) => name.some((x) => stem(x) === stem(w))).length;
  const inBody = asked.filter((w) => [...body].some((x) => stem(x) === stem(w))).length;
  // Named in the question (most of the list's name is there), or plainly about what's on it.
  const named = name.length > 0 && inName / name.length >= 0.5;
  return named ? 10 + inName * 3 + inBody : inBody >= 2 ? inBody : 0;
}

/** A job list as a passage: what goes on the truck, and what's proven after. */
export function listAsText(list: { name: string; lines: { label: string; qty: number; critical: boolean; phase: string }[] }): string {
  const load = list.lines.filter((l) => l.phase !== "after");
  const after = list.lines.filter((l) => l.phase === "after");
  const row = (l: { label: string; qty: number; critical: boolean }) => `- ${l.label}${l.qty > 1 ? ` x ${l.qty}` : ""}${l.critical ? " (critical: stops the job if it's missing)" : ""}`;
  return [
    `Job list: ${list.name}`,
    load.length ? `What goes on the truck:\n${load.map(row).join("\n")}` : "Nothing on this list yet.",
    after.length ? `What the crew proves with a photo after the job:\n${after.map((l) => `- ${l.label}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

/** A file's name without its ending, as a first title: "MSA_Acme-2026.pdf" reads "MSA Acme 2026". */
export function titleFromFile(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Untitled";
}

/** What SYNNR can read, by the file's ending. Anything else gets a plain reason. */
export function fileKind(name: string): { ok: true; ext: "pdf" | "docx" | "text"; mime: string } | { ok: false; problem: string } {
  const ext = (name.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] ?? "").toLowerCase();
  if (ext === "pdf") return { ok: true, ext: "pdf", mime: "application/pdf" };
  if (ext === "docx") return { ok: true, ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  if (ext === "txt" || ext === "text") return { ok: true, ext: "text", mime: "text/plain" };
  if (ext === "md") return { ok: true, ext: "text", mime: "text/markdown" };
  if (ext === "csv") return { ok: true, ext: "text", mime: "text/csv" };
  if (ext === "doc") return { ok: false, problem: "That's an old Word file. Save it as .docx or PDF and load that." };
  if (ext === "xlsx" || ext === "xls") return { ok: false, problem: "Spreadsheets can't be read yet. Save the sheet as a PDF or a CSV and load that." };
  if (["jpg", "jpeg", "png", "heic", "webp", "gif"].includes(ext)) return { ok: false, problem: "Photos of paper can't be read yet. Type or paste the important part in as a note." };
  return { ok: false, problem: "SYNNR reads PDF, Word (.docx), and plain text files." };
}
