import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { YARD_TZ } from "@/lib/saas/format";
import { outcomeOf, reasonsOf, type LoadoutRecord } from "@/lib/saas/loadout-record";

/**
 * Every load-out record as a spreadsheet: one row per piece that went on, so
 * a shop can hand an operator or an auditor the whole history. The records
 * stay locked in RollReady; this is a copy.
 */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const when = (iso: string | undefined | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: YARD_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit" }) : "";
const HOW: Record<string, string> = { nfc: "NFC tap", qr: "QR scan", hand: "Checked by hand" };

export async function GET() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: rows }, { data: yards }] = await Promise.all([
    db.from("saas_loadout_scans").select("id, unit_name, yard_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned, proof_token")
      .eq("company_id", company.id).order("finished_at", { ascending: false }).limit(5000),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);
  const recs = (rows ?? []) as (Pick<LoadoutRecord, "id" | "unit_name" | "yard_id" | "finished_at" | "scanned_by" | "verdict" | "reasons" | "pieces" | "not_scanned" | "proof_token">)[];
  const { data: ov } = recs.length
    ? await db.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at").in("loadout_id", recs.map((r) => r.id))
    : { data: [] };
  const overrides = new Map(((ov ?? []) as { loadout_id: string; by_name: string; reason: string; created_at: string }[]).map((o) => [o.loadout_id, o]));
  const yardName = new Map(((yards ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));

  const header = ["Load-out", "Truck", "Yard", "Answer", "Why", "Loaded by", "Override by", "Override reason",
    "Piece", "Serial", "How", "Scanned at", "Scanned by", "Bad when scanned", "Tests when scanned", "Proof link"];
  const lines = [header.map(esc).join(",")];
  for (const r of recs) {
    const o = overrides.get(r.id);
    const answer = { ready: "READY", override: "Rolled on override", blocked: "NOT READY" }[outcomeOf(r, o ? { ...o } : null)];
    const base = [when(r.finished_at), r.unit_name, r.yard_id ? yardName.get(r.yard_id) ?? "" : "", answer, reasonsOf(r).join("; "),
      r.scanned_by ?? "", o?.by_name ?? "", o?.reason ?? ""];
    const tail = [`https://www.synnr.io/l/${r.proof_token}`];
    if (!r.pieces.length) lines.push([...base, "", "", "", "", "", "", "", ...tail].map(esc).join(","));
    for (const p of r.pieces) {
      lines.push([...base, p.name, p.serial ?? "", HOW[p.how] ?? p.how, when(p.at), p.by ?? r.scanned_by ?? "", p.red ? "yes" : "",
        (p.tests ?? []).map((t) => `${t.title}: ${t.good_until ?? "no date"}`).join("; "), ...tail].map(esc).join(","));
    }
  }
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rollready-load-outs.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
