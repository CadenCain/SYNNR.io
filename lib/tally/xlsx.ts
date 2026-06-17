import ExcelJS from "exceljs";
import type { TallyResult, TallyJoint } from "./types";
import type { Reconciliation } from "./reconcile";

export type XlsxOptions = { template?: Partial<XlsxTemplate>; reconciliation?: Reconciliation };

/**
 * Export a TallyResult to a real .xlsx. This is the ONLY module that depends on
 * exceljs — the pipeline/QC/tests stay dependency-free.
 *
 * Layout is template-able via `opts` so a customer's own format can be matched
 * later; defaults mirror the MKS "CASING – TUBING – RECORD" sheet.
 */

export type XlsxTemplate = {
  sheetName: string;
  title: string;
  /** Column headers, in order: joint #, length, cumulative, per-10 subtotal, flag, comments. */
  headers: { joint: string; length: string; cumulative: string; subtotal: string; flag: string; comments: string };
  /** ARGB fills for flagged rows by severity. */
  fills: { range: string; lowConfidence: string; unreadable: string };
  lengthUnit: string;
};

export const MKS_TEMPLATE: XlsxTemplate = {
  sheetName: "Tally",
  title: "CASING – TUBING – RECORD",
  headers: { joint: "No.", length: "Length (ft)", cumulative: "Cumulative (ft)", subtotal: "Per-10 Subtotal", flag: "Flag", comments: "Comments" },
  fills: { range: "FFF4CCCC", lowConfidence: "FFFCE5CD", unreadable: "FFF4CCCC" },
  lengthUnit: "ft",
};

function fillFor(j: TallyJoint, t: XlsxTemplate): string | null {
  if (j.flag === "RANGE") return t.fills.range;
  if (j.flag === "UNREADABLE") return t.fills.unreadable;
  if (j.flag === "LOW_CONFIDENCE") return t.fills.lowConfidence;
  return null;
}

const NUM = "#,##0.00";
const INK = "FF1A1714";
const BONE = "FFECE5D7";
const GRID = "FFD9D3C6";
const thin = { style: "thin" as const, color: { argb: GRID } };
const allBorders = { top: thin, left: thin, bottom: thin, right: thin };

function flagLabel(j: TallyJoint): string {
  if (j.flag === "RANGE") return "Review — out of range";
  if (j.flag === "LOW_CONFIDENCE") return "Review — low confidence";
  if (j.flag === "UNREADABLE") return "Review — unreadable";
  return "";
}

export async function buildTallyWorkbook(
  result: TallyResult,
  opts: XlsxOptions = {}
): Promise<ExcelJS.Workbook> {
  const t: XlsxTemplate = { ...MKS_TEMPLATE, ...(opts.template ?? {}) };
  const wb = new ExcelJS.Workbook();
  wb.creator = "SYNNR TallyShot";
  const ws = wb.addWorksheet(t.sheetName, { views: [{ state: "frozen", ySplit: 4 }] });

  ws.columns = [
    { key: "joint", width: 7 },
    { key: "length", width: 13 },
    { key: "cumulative", width: 15 },
    { key: "subtotal", width: 16 },
    { key: "flag", width: 28 },
    { key: "comments", width: 24 },
  ];

  // Title + metadata
  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = t.title;
  ws.getCell("A1").font = { bold: true, size: 15, color: { argb: INK } };
  const m = result.meta;
  // Line 1: who / where. Line 2: the string spec a company man reads first.
  const whoBits = [
    m.well && `Well: ${m.well}`,
    m.company && `Company: ${m.company}`,
    m.lease && `Lease: ${m.lease}`,
    m.rig && `Rig: ${m.rig}`,
    m.sheetNo && `Sheet ${m.sheetNo}`,
    m.date && m.date,
    result.usedSample && "SAMPLE",
  ].filter(Boolean);
  const specBits = [
    m.size && `Size: ${m.size}`,
    m.weight && `Weight: ${m.weight} lb/ft`,
    m.grade && `Grade: ${m.grade}`,
    m.connection && `Connection: ${m.connection}`,
  ].filter(Boolean);
  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = whoBits.join("   ·   ");
  ws.getCell("A2").font = { italic: true, size: 10, color: { argb: "FF8A8276" } };
  ws.mergeCells("A3:F3");
  ws.getCell("A3").value = specBits.join("   ·   ");
  ws.getCell("A3").font = { bold: true, size: 10, color: { argb: INK } };
  ws.getRow(1).height = 22;

  // Header row (row 4)
  const headerRowIdx = 4;
  const header = ws.getRow(headerRowIdx);
  header.values = [t.headers.joint, t.headers.length, t.headers.cumulative, t.headers.subtotal, t.headers.flag, t.headers.comments];
  header.height = 20;
  header.eachCell((c, col) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    c.font = { bold: true, color: { argb: BONE } };
    c.alignment = { vertical: "middle", horizontal: col === 1 ? "center" : col >= 5 ? "left" : "right" };
    c.border = allBorders;
  });

  const subtotalAt = new Map<number, number>();
  for (const s of result.subtotals) subtotalAt.set(s.to, s.ft);

  // Joint rows
  let rowIdx = headerRowIdx + 1;
  for (const j of result.joints) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = j.joint;
    row.getCell(1).alignment = { horizontal: "center" };
    row.getCell(2).value = j.lengthFt;
    row.getCell(2).numFmt = NUM;
    row.getCell(2).alignment = { horizontal: "right" };
    // cumulative shoe depth
    row.getCell(3).value = j.cumulativeFt;
    row.getCell(3).numFmt = NUM;
    row.getCell(3).alignment = { horizontal: "right" };
    if (j.kind !== "joint") row.getCell(3).note = `${j.kind}`;
    const sub = subtotalAt.get(j.joint);
    if (sub !== undefined) {
      row.getCell(4).value = sub;
      row.getCell(4).numFmt = NUM;
      row.getCell(4).font = { bold: true };
      row.getCell(4).alignment = { horizontal: "right" };
    }
    row.getCell(5).value = j.kind !== "joint" ? `${j.kind}${flagLabel(j) ? " · " + flagLabel(j) : ""}` : flagLabel(j);
    row.getCell(6).value = j.note || "";

    for (let c = 1; c <= 6; c++) row.getCell(c).border = allBorders;

    const fill = fillFor(j, t);
    if (fill) {
      for (let c = 1; c <= 6; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      row.getCell(5).font = { color: { argb: "FF9A4A2A" }, bold: true };
      // full reason lives in a comment, not spilling across the sheet
      row.getCell(2).note = `${j.reason}\nRaw read: "${j.raw}" @ ${(j.confidence * 100).toFixed(0)}%`;
    }
    rowIdx++;
  }

  // Grand-total row
  const gt = ws.getRow(rowIdx);
  gt.getCell(1).value = "GRAND TOTAL (trusted)";
  ws.mergeCells(rowIdx, 1, rowIdx, 3);
  gt.getCell(1).font = { bold: true };
  gt.getCell(4).value = result.grandTotalFt;
  gt.getCell(4).numFmt = NUM;
  gt.getCell(4).font = { bold: true, size: 12 };
  gt.getCell(4).alignment = { horizontal: "right" };
  for (let c = 1; c <= 6; c++) gt.getCell(c).border = { ...allBorders, top: { style: "medium", color: { argb: INK } } };
  rowIdx += 2;

  // Summary block
  const summary: Array<[string, string | number]> = [
    ["Joints", result.jointCount],
    ["Flagged for review", result.flaggedCount],
    ["Provisional total (incl. flagged)", `${result.provisionalTotalFt.toFixed(2)} ${t.lengthUnit}`],
    ["String-length cross-check", result.crossCheck.ran ? (result.crossCheck.pass ? "PASS" : "FAIL") : "n/a"],
    ["Confirmed final", result.confirmedFinal ? "Yes" : "No — resolve flags first"],
  ];
  for (const [label, value] of summary) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = label;
    ws.mergeCells(rowIdx, 1, rowIdx, 3);
    row.getCell(1).font = { color: { argb: "FF8A8276" } };
    ws.mergeCells(rowIdx, 4, rowIdx, 6);
    row.getCell(4).value = value;
    row.getCell(4).font = { bold: true };
    rowIdx++;
  }

  // Dual-tally reconciliation block (when a second count was reconciled)
  const rec = opts.reconciliation;
  if (rec) {
    rowIdx += 1;
    const head = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, 6);
    head.getCell(1).value = "DUAL-TALLY RECONCILIATION";
    head.getCell(1).font = { bold: true, size: 12 };
    rowIdx++;

    const recRows: Array<[string, string | number]> = [
      ["Tally A total", `${rec.totalAFt.toFixed(2)} ${t.lengthUnit}`],
      ["Tally B total", `${rec.totalBFt.toFixed(2)} ${t.lengthUnit}`],
      ["Difference", `${rec.totalDiffFt.toFixed(2)} ${t.lengthUnit}`],
      ["Tolerance", `±${rec.toleranceFt} ${t.lengthUnit}`],
      ["Result", rec.totalPass ? "PASS — within tolerance" : "FAIL — reconcile before calling it"],
      ["Joint counts", rec.countsMatch ? `Match (${rec.jointCountA})` : `Mismatch (${rec.jointCountA} vs ${rec.jointCountB})`],
      ["Disagreements", rec.issueCount],
    ];
    for (const [label, value] of recRows) {
      const row = ws.getRow(rowIdx);
      row.getCell(1).value = label;
      ws.mergeCells(rowIdx, 2, rowIdx, 6);
      row.getCell(2).value = value;
      row.getCell(1).font = { bold: true };
      if (label === "Result") {
        for (let c = 1; c <= 6; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: rec.totalPass ? "FFD9EAD3" : "FFF4CCCC" } };
      }
      rowIdx++;
    }

    // list each disagreeing joint so nothing is auto-resolved
    const issues = rec.diffs.filter((d) => d.status !== "match");
    if (issues.length) {
      rowIdx += 1;
      const ih = ws.getRow(rowIdx);
      ih.values = ["Joint", "Tally A", "Tally B", "Δ / status"];
      ih.eachCell((c) => { c.font = { bold: true }; });
      rowIdx++;
      for (const d of issues) {
        const row = ws.getRow(rowIdx);
        row.getCell(1).value = d.joint;
        row.getCell(2).value = d.a;
        row.getCell(2).numFmt = NUM;
        row.getCell(3).value = d.b;
        row.getCell(3).numFmt = NUM;
        row.getCell(4).value = d.status === "mismatch" ? `${d.diffFt} ft` : d.status === "only_a" ? "missing in B" : "missing in A";
        for (let c = 1; c <= 4; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE5CD" } };
        rowIdx++;
      }
    }
  }

  return wb;
}

/** Convenience: serialize the workbook to a Buffer (API response / file write). */
export async function exportTallyXlsx(result: TallyResult, opts: XlsxOptions = {}): Promise<Buffer> {
  const wb = await buildTallyWorkbook(result, opts);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
