import { when, HOW } from "./csv";

/**
 * The rows of the audit spreadsheets, worked out from the records as stored.
 * Pure, so the tests can feed them records. The routes read the records
 * (every one, company-scoped) and hand them in.
 */

// ── Check-ins ────────────────────────────────────────────────────────────────

interface WentOut { truck?: string | null; by?: string | null; with?: string | null; at?: string | null }
export interface ReturnPiece {
  name: string; serial: string | null; how?: string | null; at?: number | string | null; to?: "truck" | "yard" | null; rack?: string | null;
  from_unit?: string | null; red_tag?: string | null; out_days?: number | null; red?: boolean; went_out?: WentOut | null; needs_redress?: boolean;
}
export interface NotBack { name: string; serial: string | null; outcome: "still_out" | "missing"; went_out?: WentOut | null }
export interface ReturnRec {
  id: string; yard_id: string | null; unit_name: string | null; returned_by: string | null; finished_at: string;
  pieces: ReturnPiece[] | null; not_returned: NotBack[] | null;
}

export const CHECKIN_HEADER = ["Checked in", "Truck", "Yard", "Checked in by", "Piece", "Serial", "How", "Scanned at", "Went to",
  "Came back on", "Went out", "Days out", "Red tag reason", "Bad when checked in", "Needs redress", "Not back"];

const atIso = (at: number | string | null | undefined) =>
  typeof at === "number" ? new Date(at).toISOString() : at || null;

/** Where it had been: "Signed out to Dale 11/02/2026, 6:10 AM" or "On CT-03 11/02/2026, 5:40 AM, loaded by Dale". */
export function wentOutText(w: WentOut | null | undefined): string {
  if (!w) return "";
  if (w.with) return `Signed out to ${w.with}${w.at ? ` ${when(w.at)}` : ""}`;
  if (w.truck) return `On ${w.truck}${w.at ? ` ${when(w.at)}` : ""}${w.by ? `, loaded by ${w.by}` : ""}`;
  return "";
}

/** One row per piece checked in, and one per piece that didn't come back. */
export function checkinRows(recs: ReturnRec[], yardName: Map<string, string>): unknown[][] {
  const out: unknown[][] = [];
  for (const r of recs) {
    const base = [when(r.finished_at), r.unit_name ?? "No truck (iron into the yard)", r.yard_id ? yardName.get(r.yard_id) ?? "" : "", r.returned_by ?? ""];
    const pieces = r.pieces ?? [];
    const notBack = r.not_returned ?? [];
    for (const p of pieces) {
      const to = p.to === "truck" ? `Back on ${r.unit_name ?? "the truck"}` : p.to === "yard" ? `Into the yard${p.rack ? `: ${p.rack}` : ""}` : "";
      out.push([...base, p.name, p.serial ?? "", p.how ? HOW[p.how] ?? p.how : "", when(atIso(p.at)), to,
        p.from_unit ?? "", wentOutText(p.went_out), p.out_days ?? "", p.red_tag ?? "", p.red ? "yes" : "", p.needs_redress ? "yes" : "", ""]);
    }
    for (const n of notBack) {
      out.push([...base, n.name, n.serial ?? "", "", "", "", "", wentOutText(n.went_out), "", "", "", "",
        n.outcome === "missing" ? "Can't find" : "Still out"]);
    }
    if (!pieces.length && !notBack.length) out.push([...base, "", "", "", "", "", "", "", "", "", "", "", ""]);
  }
  return out;
}

// ── Tools out ────────────────────────────────────────────────────────────────

export interface SignoutRec { asset_name: string; serial: string | null; out_name: string; job_note: string | null; out_at: string; back_at: string | null; back_by: string | null; back_note: string | null }
export interface ToolOutRec { stock_id: string; out_name: string; qty: number; job_note: string | null; out_at: string; out_by: string | null; back_at: string | null; back_by: string | null; back_used: number | null; back_unused: number | null }
export interface StockRec { id: string; name: string; vendor: string | null; yard_id: string | null }
export interface StockLogRec { stock_id: string; kind: string; note: string | null; by_name: string | null; created_at: string }
export interface EventRec { kind: string; message: string; actor: string | null; created_at: string }

export const TOOLS_HEADER = ["When", "What", "Tool", "Serial", "Yard", "How many", "With", "Job", "By", "Back", "Back by", "Ran", "Didn't run", "Note"];

const LOG_WHAT: Record<string, string> = { added: "Started counting", vendor: "Vendor visit", count: "Shelf counted" };

/**
 * The whole sign-out sheet: tools signed out one by one (hand-offs close one
 * line and open the next), setting tools taken off a counted shelf, the
 * vendor's visits and shelf counts, and every redress. Newest first.
 */
export function toolRows(input: {
  signouts: SignoutRec[]; toolOuts: ToolOutRec[]; stocks: StockRec[]; log: StockLogRec[]; redress: EventRec[]; yardName: Map<string, string>;
}): unknown[][] {
  const stock = new Map(input.stocks.map((s) => [s.id, s]));
  const toolName = (id: string) => { const s = stock.get(id); return s ? `${s.name}${s.vendor ? ` (${s.vendor})` : ""}` : "Setting tools"; };
  const yardOf = (id: string) => { const y = stock.get(id)?.yard_id; return y ? input.yardName.get(y) ?? "" : ""; };
  const rows: { at: string; cells: unknown[] }[] = [];
  for (const s of input.signouts) {
    rows.push({ at: s.out_at, cells: [when(s.out_at), "Signed out", s.asset_name, s.serial ?? "", "", 1, s.out_name, s.job_note ?? "", "",
      s.back_at ? when(s.back_at) : "Still out", s.back_by ?? "", "", "", s.back_note ?? ""] });
  }
  for (const o of input.toolOuts) {
    rows.push({ at: o.out_at, cells: [when(o.out_at), "Setting tools out (counted)", toolName(o.stock_id), "", yardOf(o.stock_id), o.qty, o.out_name, o.job_note ?? "", o.out_by ?? "",
      o.back_at ? when(o.back_at) : "Still out", o.back_by ?? "", o.back_used ?? "", o.back_unused ?? "", ""] });
  }
  for (const l of input.log) {
    const what = LOG_WHAT[l.kind];
    if (!what) continue;
    rows.push({ at: l.created_at, cells: [when(l.created_at), what, toolName(l.stock_id), "", yardOf(l.stock_id), "", "", "", l.by_name ?? "", "", "", "", "", l.note ?? ""] });
  }
  for (const e of input.redress) {
    rows.push({ at: e.created_at, cells: [when(e.created_at), "Redressed", "", "", "", "", "", "", e.actor ?? "", "", "", "", "", e.message] });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at)).map((r) => r.cells);
}

// ── Test history ─────────────────────────────────────────────────────────────

export interface UploadRec {
  id: string; item_id: string | null; created_at: string; uploaded_by_name: string | null; evidence: string;
  claimed_issued: string | null; claimed_expiration: string | null; pending_until: string | null; verdict: string; status: string;
  applied_at: string | null; reviewed_by_name: string | null; reviewed_at: string | null; review_note: string | null;
}
export interface ItemRec { id: string; title: string; parent_type: string; parent_id: string; expiration_date: string | null; last_upload_id: string | null }

export const TESTS_HEADER = ["Sent in", "Piece or truck", "Serial", "Test or cert", "Paper", "Tested", "Good until (as sent in)",
  "Good until (on file now)", "Where it stands", "Sent in by", "Checked by", "Checked at", "Note", "Cert photo"];

/** Where an upload stands, in plain words. */
export function standing(u: Pick<UploadRec, "status" | "applied_at">): string {
  if (u.status === "applied") return "On file";
  if (u.status === "superseded") return u.applied_at ? "Replaced by a newer test" : "Not used: a newer one came in";
  if (u.status === "waiting") return "Waiting on a manager";
  if (u.status === "rejected") return "Turned down";
  return u.status;
}

/**
 * Every cert photo ever sent in, so a retest doesn't wipe out the one before
 * it: grouped by piece and test, newest first, each with a link to its photo
 * (opens for someone signed in to this company).
 */
export function testHistoryRows(input: {
  uploads: UploadRec[]; items: ItemRec[];
  pieces: Map<string, { name: string; serial: string | null }>; trucks: Map<string, string>; certUrl: (id: string) => string;
}): unknown[][] {
  const item = new Map(input.items.map((i) => [i.id, i]));
  const rows = input.uploads.map((u) => {
    const it = u.item_id ? item.get(u.item_id) : undefined;
    const piece = it?.parent_type === "asset" ? input.pieces.get(it.parent_id) : undefined;
    const truck = it?.parent_type === "unit" ? input.trucks.get(it.parent_id) : undefined;
    const who = !it ? "Test deleted" : piece ? piece.name : truck ? `${truck} (truck paper)` : "";
    const checkedBy = u.reviewed_by_name ?? (u.applied_at && u.verdict === "verified" ? "RollReady, against the photo" : "");
    const cells = [when(u.created_at), who, piece?.serial ?? "", it?.title ?? "", u.evidence === "temporary" ? "Retest paper, cert on the way" : "Cert",
      u.claimed_issued ?? "", u.claimed_expiration ?? (u.pending_until ? `${u.pending_until} (temporary)` : ""),
      it && it.last_upload_id === u.id ? it.expiration_date ?? "" : "", standing(u), u.uploaded_by_name ?? "", checkedBy,
      when(u.reviewed_at ?? u.applied_at), u.review_note ?? "", input.certUrl(u.id)];
    // Deleted tests last, then by piece, serial and test, newest first within each.
    return { key: [it ? "0" : "1", String(who).toLowerCase(), piece?.serial ?? "", it?.title ?? ""].join("\u0000"), at: u.created_at, cells };
  });
  return rows.sort((a, b) => a.key.localeCompare(b.key) || b.at.localeCompare(a.at)).map((r) => r.cells);
}
