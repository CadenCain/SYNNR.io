import { requireCompany } from "@/lib/saas/auth";
import { testText } from "@/lib/saas/judge";
import { readAll } from "@/lib/saas/read-all";
import { saasDb } from "@/lib/saas/db";
import { YARD_TZ } from "@/lib/saas/format";
import { outcomeOf, reasonsOf, type LoadoutRecord } from "@/lib/saas/loadout-record";
import { loadoutFilters, rangeOf, jobPattern } from "./filters";

/**
 * Every load-out record as a spreadsheet: one row per piece that went on, so
 * a shop can hand an operator or an auditor the whole history. The records
 * stay locked in RollReady; this is a copy. The records page's filters carry
 * over (a yard, an answer, who, a date range, a job or well), so one
 * operator's auditor gets that operator's load-outs and nobody else's.
 */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  // Names are typed by people: one starting =, +, -, or @ would run as a
  // formula when the sheet opens in Excel, so it goes in as plain text.
  const raw = String(v ?? "");
  const s = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const when = (iso: string | undefined | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: YARD_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "";
const HOW: Record<string, string> = { nfc: "NFC tap", qr: "QR scan", hand: "Checked by hand" };
/** "BOP rams closed for travel: done by Dale 11/10/2026, 5:02 AM; Tools tied down: not done" */
const rollChecksText = (checks: LoadoutRecord["roll_checks"]) => (checks ?? [])
  .map((c) => `${c.label}: ${c.ok ? `done${c.by ? ` by ${c.by}` : ""}${c.at ? ` ${when(c.at)}` : ""}` : "not done"}`).join("; ");

export async function GET(request: Request) {
  const { company } = await requireCompany();
  const db = await saasDb();
  const f = loadoutFilters(new URL(request.url).searchParams);
  const range = rangeOf(f);
  // Every load-out that matches, however many: "every load-out" means every one.
  const page = (a: number, b: number) => {
    let q = db.from("saas_loadout_scans").select("id, unit_name, yard_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned, proof_token, job, roll_checks, photo_path", { count: "exact" })
      .eq("company_id", company.id);
    if (f.yard) q = q.eq("yard_id", f.yard);
    if (f.by) q = q.eq("scanned_by", f.by);
    if (range.gte) q = q.gte("finished_at", range.gte);
    if (range.lt) q = q.lt("finished_at", range.lt);
    if (f.job) q = q.ilike("job", jobPattern(f.job));
    // Old records saved before the answer was stored (verdict null) are worked out below.
    if (f.show === "ready") q = q.or("verdict.eq.ready,verdict.is.null");
    else if (f.show) q = q.or("verdict.neq.ready,verdict.is.null");
    return q.order("finished_at", { ascending: false }).order("id").range(a, b);
  };
  const [rows, { data: yards }] = await Promise.all([
    readAll<unknown>(page),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);
  const recs = (rows ?? []) as (Pick<LoadoutRecord, "id" | "unit_name" | "yard_id" | "finished_at" | "scanned_by" | "verdict" | "reasons" | "pieces" | "not_scanned" | "proof_token" | "job" | "roll_checks" | "photo_path">)[];
  // Every override the company has (a few per month), not a 5,000-id list in a URL.
  const { data: ov, error: ovErr } = recs.length
    ? { data: await readAll<unknown>((a, b) => db.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at", { count: "exact" }).eq("company_id", company.id).order("loadout_id").range(a, b)), error: null }
    : { data: [], error: null };
  if (ovErr) return new Response("Couldn't read the overrides. Try the export again.", { status: 500 });
  const overrides = new Map(((ov ?? []) as { loadout_id: string; by_name: string; reason: string; created_at: string }[]).map((o) => [o.loadout_id, o]));
  const yardName = new Map(((yards ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));
  const offRows = await readAll<{ loadout_id: string }>((a, b) => db.from("saas_loadout_link_offs").select("loadout_id", { count: "exact" }).eq("company_id", company.id).order("loadout_id").range(a, b));
  const linkOff = new Set(offRows.map((o) => o.loadout_id));

  const header = ["Load-out", "Truck", "Yard", "Job or well", "Answer", "Why", "Loaded by", "Override by", "Override reason",
    "Roll checks", "Truck photo",
    "Piece", "Serial", "How", "Scanned at", "Scanned by", "Bad when scanned", "Tests when scanned", "Proof link"];
  const lines = [header.map(esc).join(",")];
  for (const r of recs) {
    const o = overrides.get(r.id);
    const outcome = outcomeOf(r, o ? { ...o } : null);
    if (f.show && outcome !== f.show) continue;
    const answer = { ready: "READY", override: "Rolled on override", blocked: "NOT READY" }[outcome];
    const base = [when(r.finished_at), r.unit_name, r.yard_id ? yardName.get(r.yard_id) ?? "" : "", r.job ?? "", answer, reasonsOf(r).join("; "),
      r.scanned_by ?? "", o?.by_name ?? "", o?.reason ?? "", rollChecksText(r.roll_checks), r.photo_path ? "yes" : ""];
    // A link the shop shut off is dead: say so instead of handing it out again.
    const tail = [linkOff.has(r.id) ? "shut off" : `https://www.synnr.io/l/${r.proof_token}`];
    if (!r.pieces.length) lines.push([...base, "", "", "", "", "", "", "", ...tail].map(esc).join(","));
    for (const p of r.pieces) {
      lines.push([...base, p.name, p.serial ?? "", HOW[p.how] ?? p.how, when(p.at), p.by ?? r.scanned_by ?? "", p.red ? "yes" : "",
        (p.tests ?? []).map((t) => testText(t)).join("; "), ...tail].map(esc).join(","));
    }
  }
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rollready-load-outs${f.from || f.to ? `-${f.from || "start"}-to-${f.to || "now"}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
