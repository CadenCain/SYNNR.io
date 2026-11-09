import type { SupabaseClient } from "@supabase/supabase-js";
import { localToday } from "./status";
import { daysOut } from "./whereabouts";

/**
 * Setting tools a vendor keeps a yard stocked with, counted (migration
 * 0033): ready on the shelf, used and waiting on the vendor's pickup, and
 * out with someone. Read here for Tools out and the morning email.
 */

export interface ToolOut { id: string; stockId: string; userId: string | null; name: string; qty: number; note: string | null; outAt: string }
export interface ToolStock {
  id: string; name: string; vendor: string | null; yardId: string; yardName: string;
  ready: number; used: number; lowAt: number;
  outs: ToolOut[];
  /** How many are out with people right now. */
  out: number;
  /** How many came back used this month (yard time): what the vendor will bill for. */
  ranThisMonth: number;
  /** The vendor's last swap, if one is on file in the last 60 days. */
  lastVendor: { at: string; note: string | null } | null;
}

type StockRow = { id: string; name: string; vendor: string | null; yard_id: string; ready: number; used: number; low_at: number };
type OutRow = { id: string; stock_id: string; out_user: string | null; out_name: string; qty: number; job_note: string | null; out_at: string };
type LogRow = { stock_id: string; kind: string; used_delta: number; note: string | null; created_at: string };

/** "Silver Fox setting tool" -> "3 Silver Fox setting tools". */
export const countOf = (n: number, name: string) => `${n} ${name}${n === 1 || /s$/i.test(name) ? "" : "s"}`;

/** Running low: at or under the number the manager set. */
export const isLow = (s: Pick<ToolStock, "ready" | "lowAt">) => s.ready <= s.lowAt;

/** The yard-time month a timestamp falls in ("2026-11"). */
const monthOf = (iso: string) => localToday(new Date(iso)).slice(0, 7);

/** Build each yard's count from the rows (pure, so it can be tested). */
export function buildToolStocks(stocks: StockRow[], yards: { id: string; name: string }[], outs: OutRow[], log: LogRow[], now: Date = new Date()): ToolStock[] {
  const yardName = new Map(yards.map((y) => [y.id, y.name]));
  const month = localToday(now).slice(0, 7);
  return stocks.map((s) => {
    const mine = outs.filter((o) => o.stock_id === s.id).sort((a, b) => a.out_at.localeCompare(b.out_at))
      .map((o) => ({ id: o.id, stockId: o.stock_id, userId: o.out_user, name: o.out_name, qty: o.qty, note: o.job_note, outAt: o.out_at }));
    const myLog = log.filter((l) => l.stock_id === s.id);
    const ranThisMonth = myLog.filter((l) => l.kind === "back" && monthOf(l.created_at) === month).reduce((n, l) => n + Math.max(0, l.used_delta), 0);
    const v = myLog.filter((l) => l.kind === "vendor").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: s.id, name: s.name, vendor: s.vendor, yardId: s.yard_id, yardName: yardName.get(s.yard_id) ?? "A yard",
      ready: s.ready, used: s.used, lowAt: s.low_at, outs: mine, out: mine.reduce((n, o) => n + o.qty, 0),
      ranThisMonth, lastVendor: v ? { at: v.created_at, note: v.note } : null,
    };
  }).sort((a, b) => a.yardName.localeCompare(b.yardName) || a.name.localeCompare(b.name));
}

export async function getToolStocks(db: SupabaseClient, companyId: string, now: Date = new Date()): Promise<ToolStock[]> {
  const since = new Date(now.getTime() - 62 * 86400e3).toISOString();
  const [{ data: stocks }, { data: yards }, { data: outs }, { data: log }] = await Promise.all([
    db.from("saas_tool_stocks").select("id, name, vendor, yard_id, ready, used, low_at").eq("company_id", companyId).is("archived_at", null).limit(200),
    db.from("saas_yards").select("id, name").eq("company_id", companyId),
    db.from("saas_tool_outs").select("id, stock_id, out_user, out_name, qty, job_note, out_at").eq("company_id", companyId).is("back_at", null).limit(500),
    db.from("saas_tool_stock_log").select("stock_id, kind, used_delta, note, created_at").eq("company_id", companyId)
      .in("kind", ["back", "vendor"]).gte("created_at", since).order("created_at", { ascending: false }).limit(2000),
  ]);
  return buildToolStocks((stocks ?? []) as StockRow[], (yards ?? []) as { id: string; name: string }[], (outs ?? []) as OutRow[], (log ?? []) as LogRow[], now);
}

/** "Silver Fox setting tool" -> "Silver Fox setting tools". */
export const plural = (name: string) => (/s$/i.test(name) ? name : `${name}s`);

/** "Odessa Yard, Silver Fox setting tools: 1 ready, 5 used waiting on pickup. Call Silver Fox." (the morning email's line for a low shelf). */
export function lowLine(s: ToolStock): string {
  const parts = [`${s.ready === 0 ? "none" : s.ready} ready`];
  if (s.used) parts.push(`${s.used} used waiting on pickup`);
  if (s.out) parts.push(`${s.out} out`);
  return `${s.yardName}, ${plural(s.name)}: ${parts.join(", ")}.${s.vendor ? ` Call ${s.vendor}.` : ""}`;
}

/** Setting tools out with someone past the yard's limit, by name: "With Dale Wooten: 1 Silver Fox setting tool, out 9 days". */
export function lateOutLines(stocks: ToolStock[], limitDays: number, nowMs: number): string[] {
  const out: string[] = [];
  for (const s of stocks) for (const o of s.outs) {
    const d = daysOut(o.outAt, nowMs);
    if (d >= limitDays) out.push(`With ${o.name}: ${countOf(o.qty, s.name)}, out ${d} days`);
  }
  return out;
}
