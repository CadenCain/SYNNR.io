import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TallyResult } from "./types";

/**
 * One-click PDF tally record — confirmed values + sign-off line, for invoice
 * backup / well-file / the scale-weights buyer. Pure pdf-lib (no native deps,
 * no font files — uses the built-in Helvetica), so it runs fine on serverless.
 *
 * This is the ONLY PDF dependency; the pipeline/QC stay dependency-free.
 */

const INK = rgb(0.1, 0.09, 0.08);
const GRAY = rgb(0.46, 0.44, 0.4);
const LINE = rgb(0.82, 0.8, 0.75);
const AMBER = rgb(0.6, 0.29, 0.16);

/** Helvetica is WinAnsi — strip to plain ASCII so any note/value always encodes. */
function clean(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, "-")
    .replace(/→/g, "->")
    .replace(/[^\x20-\x7E]/g, "");
}

const PAGE_W = 612, PAGE_H = 792, MARGIN = 40;
// Column left-x positions across the content width.
const COLX = { no: 40, length: 86, cum: 168, comments: 250, flag: 452 };
const ROW_H = 15;

export async function buildTallyPdf(result: TallyResult): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (p: PDFPage, s: string, x: number, yy: number, size: number, f: PDFFont, color = INK) =>
    p.drawText(clean(s), { x, y: yy, size, font: f, color });

  // ── Title block ──
  text(page, "CASING - TUBING - RECORD", MARGIN, y, 16, bold);
  y -= 18;
  const m = result.meta;
  const who = [m.well && `Well: ${m.well}`, m.company && `Company: ${m.company}`, m.lease && `Lease: ${m.lease}`, m.rig && `Rig: ${m.rig}`, m.sheetNo && `Sheet ${m.sheetNo}`, m.date, result.usedSample && "SAMPLE"].filter(Boolean).join("   -   ");
  if (who) { text(page, who, MARGIN, y, 9, font, GRAY); y -= 13; }
  const spec = [m.size && `Size: ${m.size}`, m.weight && `Weight: ${m.weight} lb/ft`, m.grade && `Grade: ${m.grade}`, m.connection && `Connection: ${m.connection}`].filter(Boolean).join("   -   ");
  if (spec) { text(page, spec, MARGIN, y, 9, bold); y -= 13; }
  y -= 6;

  // Headline numbers
  text(page, `Grand total (trusted): ${result.grandTotalFt.toFixed(2)} ft`, MARGIN, y, 11, bold);
  text(page, `${result.trustedCount}/${result.jointCount} joints trusted   -   ${result.flaggedCount} flagged   -   cross-check ${result.crossCheck.ran ? (result.crossCheck.pass ? "PASS" : "FAIL") : "n/a"}`, MARGIN + 230, y, 9, font, GRAY);
  y -= 18;

  // ── Table header ──
  const drawHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - 2 * MARGIN, height: 16, color: INK });
    const bone = rgb(0.93, 0.9, 0.84);
    text(page, "No.", COLX.no + 4, y, 9, bold, bone);
    text(page, "Length", COLX.length, y, 9, bold, bone);
    text(page, "Cumulative", COLX.cum, y, 9, bold, bone);
    text(page, "Comments", COLX.comments, y, 9, bold, bone);
    text(page, "Flag", COLX.flag, y, 9, bold, bone);
    y -= ROW_H + 2;
  };
  drawHead();

  const newPageIfNeeded = () => {
    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawHead();
    }
  };

  // ── Joint rows ──
  for (const j of result.joints) {
    newPageIfNeeded();
    const flagged = !j.trusted;
    if (flagged) page.drawRectangle({ x: MARGIN, y: y - 3, width: PAGE_W - 2 * MARGIN, height: ROW_H, color: rgb(0.96, 0.9, 0.82) });
    const c = flagged ? AMBER : INK;
    text(page, String(j.joint), COLX.no + 4, y, 9, font, c);
    text(page, j.lengthFt != null ? j.lengthFt.toFixed(2) : "—", COLX.length, y, 9, font, c);
    text(page, j.cumulativeFt != null ? j.cumulativeFt.toFixed(2) : "—", COLX.cum, y, 9, font, c);
    const note = [j.kind !== "joint" ? `[${j.kind}]` : "", j.note].filter(Boolean).join(" ");
    if (note) text(page, note.slice(0, 38), COLX.comments, y, 9, font, c);
    const flagTxt = flagged ? (j.flag === "RANGE" ? "Review - out of range" : j.flag === "LOW_CONFIDENCE" ? "Review - low confidence" : "Review - unreadable") : "";
    if (flagTxt) text(page, flagTxt, COLX.flag, y, 8, bold, AMBER);
    y -= ROW_H;
  }

  // ── Totals + summary ──
  y -= 4;
  page.drawLine({ start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 }, thickness: 1, color: INK });
  newPageIfNeeded();
  text(page, "GRAND TOTAL (trusted)", COLX.no + 4, y - 4, 10, bold);
  text(page, `${result.grandTotalFt.toFixed(2)} ft`, COLX.cum, y - 4, 11, bold);
  y -= 24;

  const summary = [
    `Provisional total (incl. flagged): ${result.provisionalTotalFt.toFixed(2)} ft`,
    `Confirmed final: ${result.confirmedFinal ? "Yes" : "No - resolve flags first"}`,
    result.crossCheck.ran ? `String-length cross-check: ${result.crossCheck.pass ? "PASS" : "FAIL"} (${result.crossCheck.note})` : "",
  ].filter(Boolean);
  for (const s of summary) { newPageIfNeeded(); text(page, s, MARGIN, y, 9, font, GRAY); y -= 13; }

  // ── Sign-off line ──
  y -= 16;
  newPageIfNeeded();
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LINE });
  y -= 14;
  text(page, "Verified by: ______________________________     Date: ____________", MARGIN, y, 10, font, INK);
  y -= 16;
  text(page, "Generated by SYNNR TallyShot - it reads the clean digits and flags the shaky ones; a human confirms.", MARGIN, y, 7.5, font, GRAY);

  return doc.save();
}
