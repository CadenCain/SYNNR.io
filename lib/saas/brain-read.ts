import { tidy } from "./brain";

/**
 * Reading a file into plain text, on the server. A PDF comes back a page at
 * a time (so a passage can say which page it's on); Word and text files
 * come back whole. A file with no words in it (a scan, a photo saved as a
 * PDF) is refused with the reason, in plain words, rather than loaded empty.
 */
export type ReadResult = { ok: true; pages: string[]; paged: boolean } | { ok: false; problem: string };

const SCAN = "This PDF is a scan: it's pictures of pages, with no words in it to read. Reading scans isn't on yet. For now, type or paste the important parts in as a note.";

export async function readBytes(bytes: Uint8Array, ext: "pdf" | "docx" | "text"): Promise<ReadResult> {
  try {
    if (ext === "pdf") {
      const { extractText } = await import("unpdf");
      const { text } = await extractText(bytes, { mergePages: false });
      const pages = text.map(tidy);
      const chars = pages.reduce((n, p) => n + p.length, 0);
      // A real page of writing is hundreds of characters. A scan gives back nothing, or page numbers.
      if (chars < Math.max(80, pages.length * 25)) return { ok: false, problem: SCAN };
      return { ok: true, pages, paged: true };
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = tidy(value);
      if (text.length < 20) return { ok: false, problem: "There are no words in that Word file to read." };
      return { ok: true, pages: [text], paged: false };
    }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    // A file that isn't text decodes into a wall of replacement marks.
    const bad = (raw.match(/�/g) ?? []).length;
    if (bad > raw.length / 50) return { ok: false, problem: "That file isn't plain text. Save it as a PDF and load that." };
    const text = tidy(raw);
    if (text.length < 20) return { ok: false, problem: "That file is empty." };
    return { ok: true, pages: [text], paged: false };
  } catch (e) {
    console.error("[brain] read:", e instanceof Error ? e.message : e);
    return { ok: false, problem: ext === "pdf" ? "That PDF couldn't be opened. If it has a password on it, take the password off and load it again." : "That file couldn't be opened. Save it again and load it once more." };
  }
}
