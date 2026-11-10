import type { SupabaseClient } from "@supabase/supabase-js";
import { YARD_TZ, yardZone, zoneShort } from "@/lib/saas/format";

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

/**
 * "11/10/2026, 5:02 AM". Pass the yard's zone (even null, for Central) and it
 * reads on that yard's clock with the zone on it: "11/10/2026, 5:02 AM MT".
 */
export const when = (iso: string | undefined | null, tz?: string | null) => {
  if (!iso) return "";
  const s = new Date(iso).toLocaleString("en-US", { timeZone: tz === undefined ? YARD_TZ : yardZone(tz), year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" });
  return tz === undefined ? s : `${s} ${zoneShort(tz)}`;
};

/**
 * Each of this company's yards' time zone, by yard id. Before migration 0035
 * is in (no time_zone column) or for a yard with none, it's empty and the
 * time reads Central.
 */
export async function companyYardZones(db: SupabaseClient, companyId: string): Promise<Map<string, string>> {
  const { data, error } = await db.from("saas_yards").select("id, time_zone").eq("company_id", companyId);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; time_zone: string | null }[]).filter((y) => y.time_zone).map((y) => [y.id, y.time_zone!]));
}

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
