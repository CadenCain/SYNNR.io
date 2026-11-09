import { requireCompany } from "@/lib/saas/auth";
import { readAll } from "@/lib/saas/read-all";
import { saasDb } from "@/lib/saas/db";
import { localToday } from "@/lib/saas/status";
import { csvText, csvResponse } from "../csv";
import { TOOLS_HEADER, toolRows, type SignoutRec, type ToolOutRec, type StockRec, type StockLogRec, type EventRec } from "../rows";

/**
 * The whole Tools out sheet as a spreadsheet, not just the newest lines on
 * the page: every sign-out and hand-off, every setting tool taken off a
 * counted shelf and how many ran, the vendor's visits and shelf counts, and
 * every redress, each with a name and a time.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [signouts, toolOuts, stocks, log, redress, { data: yards }] = await Promise.all([
    readAll<SignoutRec>((a, b) => db.from("saas_signouts")
      .select("id, asset_name, serial, out_name, job_note, out_at, back_at, back_by, back_note", { count: "exact" })
      .eq("company_id", company.id).order("out_at", { ascending: false }).order("id").range(a, b)),
    readAll<ToolOutRec>((a, b) => db.from("saas_tool_outs")
      .select("id, stock_id, out_name, qty, job_note, out_at, out_by, back_at, back_by, back_used, back_unused", { count: "exact" })
      .eq("company_id", company.id).order("out_at", { ascending: false }).order("id").range(a, b)),
    // Stopped-counting lists too: their old lines still name them.
    readAll<StockRec>((a, b) => db.from("saas_tool_stocks").select("id, name, vendor, yard_id", { count: "exact" })
      .eq("company_id", company.id).order("id").range(a, b)),
    readAll<StockLogRec>((a, b) => db.from("saas_tool_stock_log").select("id, stock_id, kind, note, by_name, created_at", { count: "exact" })
      .eq("company_id", company.id).in("kind", ["added", "vendor", "count"]).order("created_at", { ascending: false }).order("id").range(a, b)),
    readAll<EventRec>((a, b) => db.from("saas_events").select("id, kind, message, actor, created_at", { count: "exact" })
      .eq("company_id", company.id).eq("kind", "redressed").order("created_at", { ascending: false }).order("id").range(a, b)),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);
  const yardName = new Map(((yards ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));
  return csvResponse(csvText(TOOLS_HEADER, toolRows({ signouts, toolOuts, stocks, log, redress, yardName })), `rollready-tools-out-${localToday()}.csv`);
}
