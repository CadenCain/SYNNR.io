import { YARD_TZ } from "@/lib/saas/format";

/**
 * The pieces every spreadsheet download shares: one cell made safe, a time
 * in the yard's clock, and the file response. Same rules as the load-out and
 * equipment exports.
 */

/** One cell. Names are typed by people: one starting =, +, -, or @ would run
 *  as a formula when the sheet opens in Excel, so it goes in as plain text. */
export const esc = (v: unknown) => {
  const raw = String(v ?? "");
  const s = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const when = (iso: string | undefined | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: YARD_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "";

export const csvText = (header: string[], rows: unknown[][]) =>
  [header, ...rows].map((line) => line.map(esc).join(",")).join("\n") + "\n";

export function csvResponse(text: string, filename: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const HOW: Record<string, string> = { nfc: "NFC tap", qr: "QR scan", hand: "Checked by hand" };
