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
  opts: XlsxOptions = {}
): Promise<ExcelJS.Workbook> {
  const t: XlsxTemplate = { ...MKS_TEMPLATE, ...(opts.template ?? {}) };
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

  // Dual-tally reconciliation block (when a second count was reconciled)
  const rec = opts.reconciliation;
  if (rec) {
    rowIdx += 1;
    const head = ws.getRow(rowIdx);
    ws.mergeCells(rowIdx, 1, rowIdx, 4);
    head.getCell(1).value = "DUAL-TALLY RECONCILIATION";
    head.getCell(1).font = { bold: true, size: 12 };
    rowIdx++;

    const recRows: Array<[string, string | number]> = [
      ["Tally A total", `${rec.totalAFt} ${t.lengthUnit}`],
      ["Tally B total", `${rec.totalBFt} ${t.lengthUnit}`],
      ["Difference", `${rec.totalDiffFt} ${t.lengthUnit}`],
      ["Tolerance", `±${rec.toleranceFt} ${t.lengthUnit}`],
      ["Result", rec.totalPass ? "PASS — within tolerance" : "FAIL — reconcile before calling it"],
      ["Joint counts", rec.countsMatch ? `Match (${rec.jointCountA})` : `Mismatch (${rec.jointCountA} vs ${rec.jointCountB})`],
      ["Disagreements", rec.issueCount],
    ];
    for (const [label, value] of recRows) {
      const row = ws.getRow(rowIdx);
      row.getCell(1).value = label;
      ws.mergeCells(rowIdx, 2, rowIdx, 4);
      row.getCell(2).value = value;
      row.getCell(1).font = { bold: true };
      if (label === "Result") {
        for (let c = 1; c <= 4; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: rec.totalPass ? "FFD9EAD3" : "FFF4CCCC" } };
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
        row.getCell(3).value = d.b;
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
