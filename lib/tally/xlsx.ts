import ExcelJS from "exceljs";
import type { TallyResult, TallyJoint } from "./types";

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
  /** Column headers, in order: joint #, length, per-10 subtotal, flag. */
  headers: { joint: string; length: string; subtotal: string; flag: string };
  /** ARGB fills for flagged rows by severity. */
  fills: { range: string; lowConfidence: string; unreadable: string };
  lengthUnit: string;
};

export const MKS_TEMPLATE: XlsxTemplate = {
  sheetName: "Tally",
  title: "CASING – TUBING – RECORD",
  headers: { joint: "No.", length: "Length (ft)", subtotal: "Per-10 Subtotal", flag: "Flag" },
  fills: { range: "FFF4CCCC", lowConfidence: "FFFCE5CD", unreadable: "FFF4CCCC" },
  lengthUnit: "ft",
};

function fillFor(j: TallyJoint, t: XlsxTemplate): string | null {
  if (j.flag === "RANGE") return t.fills.range;
  if (j.flag === "UNREADABLE") return t.fills.unreadable;
  if (j.flag === "LOW_CONFIDENCE") return t.fills.lowConfidence;
  return null;
}

export async function buildTallyWorkbook(
  result: TallyResult,
  opts: Partial<XlsxTemplate> = {}
): Promise<ExcelJS.Workbook> {
  const t: XlsxTemplate = { ...MKS_TEMPLATE, ...opts };
  const wb = new ExcelJS.Workbook();
  wb.creator = "SYNNR TallyShot";
  const ws = wb.addWorksheet(t.sheetName);

  // Title + sheet metadata
  ws.mergeCells("A1:D1");
  ws.getCell("A1").value = t.title;
  ws.getCell("A1").font = { bold: true, size: 14 };
  const metaBits = [
    result.meta.company && `Company: ${result.meta.company}`,
    result.meta.sheetNo && `Sheet: ${result.meta.sheetNo}`,
    result.meta.size && `Size: ${result.meta.size}`,
    result.usedSample && "[SAMPLE — cardless demo]",
  ].filter(Boolean);
  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = metaBits.join("   ");
  ws.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

  // Header row
  const headerRowIdx = 4;
  const header = ws.getRow(headerRowIdx);
  header.values = [t.headers.joint, t.headers.length, t.headers.subtotal, t.headers.flag];
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1714" } };
    c.font = { bold: true, color: { argb: "FFECE5D7" } };
  });
  ws.columns = [
    { key: "joint", width: 8 },
    { key: "length", width: 14 },
    { key: "subtotal", width: 18 },
    { key: "flag", width: 48 },
  ];

  const subtotalAt = new Map<number, number>();
  for (const s of result.subtotals) subtotalAt.set(s.to, s.ft);

  // Joint rows
  let rowIdx = headerRowIdx + 1;
  for (const j of result.joints) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = j.joint;
    row.getCell(2).value = j.lengthFt;
    const sub = subtotalAt.get(j.joint);
    if (sub !== undefined) row.getCell(3).value = sub;
    row.getCell(4).value = j.trusted ? "" : `${j.flag}: ${j.reason}`;

    const fill = fillFor(j, t);
    if (fill) {
      for (let c = 1; c <= 4; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      }
      // a cell comment carrying the reason (fill + comment, per spec)
      row.getCell(2).note = `${j.flag}: ${j.reason}\nRaw read: "${j.raw}" @ ${(j.confidence * 100).toFixed(0)}%`;
    }
    rowIdx++;
  }

  // Summary block
  rowIdx += 1;
  const summary: Array<[string, string | number]> = [
    ["Joint count", result.jointCount],
    ["Grand total (trusted)", `${result.grandTotalFt} ${t.lengthUnit}`],
    ["Provisional total (incl. flagged)", `${result.provisionalTotalFt} ${t.lengthUnit}`],
    ["Flagged cells", result.flaggedCount],
    [
      "String-length cross-check",
      result.crossCheck.ran ? (result.crossCheck.pass ? `PASS (${result.crossCheck.note})` : `FAIL (${result.crossCheck.note})`) : "n/a",
    ],
    ["Confirmed final", result.confirmedFinal ? "Yes" : "No — resolve flags first"],
  ];
  for (const [label, value] of summary) {
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = label;
    ws.mergeCells(rowIdx, 2, rowIdx, 4);
    row.getCell(2).value = value;
    row.getCell(1).font = { bold: true };
    rowIdx++;
  }

  return wb;
}

/** Convenience: serialize the workbook to a Buffer (API response / file write). */
export async function exportTallyXlsx(result: TallyResult, opts: Partial<XlsxTemplate> = {}): Promise<Buffer> {
  const wb = await buildTallyWorkbook(result, opts);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
