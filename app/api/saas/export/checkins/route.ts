import { requireCompany } from "@/lib/saas/auth";
import { readAll } from "@/lib/saas/read-all";
import { saasDb } from "@/lib/saas/db";
import { localToday } from "@/lib/saas/status";
import { csvText, csvResponse } from "../csv";
import { CHECKIN_HEADER, checkinRows, type ReturnRec } from "../rows";

/**
 * Every check-in as a spreadsheet: one row per piece that came back (who
 * checked it in, when, where it went, red tags and why, redress) and one per
 * piece that didn't (still out, or can't be found). What an insurance agent
 * or an auditor asks for: proof iron is looked at when it comes back. Open
 * in every subscription state; the records are the shop's.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [recs, { data: yards }] = await Promise.all([
    readAll<ReturnRec>((a, b) => db.from("saas_returns")
      .select("id, yard_id, unit_name, returned_by, finished_at, pieces, not_returned", { count: "exact" })
      .eq("company_id", company.id).order("finished_at", { ascending: false }).order("id").range(a, b)),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);
  const yardName = new Map(((yards ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));
  return csvResponse(csvText(CHECKIN_HEADER, checkinRows(recs, yardName)), `rollready-check-ins-${localToday()}.csv`);
}
