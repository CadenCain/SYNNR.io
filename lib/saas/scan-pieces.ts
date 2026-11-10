import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "./read-all";
import { getEquipment, stateLabel } from "./equipment";
import { RUN_MS, type ScanPiece } from "./loadout";
import { daysOut } from "./whereabouts";
import { TESTED_CATEGORIES } from "./taxonomy";
import { tagKey } from "./tag-key";
import { fmtWhen } from "./format";

/**
 * A piece as a scan screen gets it. ScanPiece carries what a load-out needs
 * to know before it points a hand at a piece on another truck: it's out (on
 * a job that hasn't been checked back in, or signed out to someone), it's on
 * another truck's open trip, or it's flagged missing. None of those is in
 * the yard to grab.
 */
export type YardScanPiece = ScanPiece;

/**
 * Every piece a scan screen can recognize (load-out or check-in): its tags,
 * where it's logged, whether it's bad, and how long it's been out on a job.
 */
export async function getScanPieces(db: SupabaseClient, companyId: string): Promise<{ pieces: YardScanPiece[]; outDays: Record<string, number> }> {
  type Out = { id: string; out_since: string; out_loadout_id: string | null; out_with_name: string | null; unit_id: string | null };
  const [list, tagRows, outRows, { data: latestRows }, { data: backRows }] = await Promise.all([
    getEquipment(db, companyId),
    readAll<{ id: string; tag_token: string | null; nfc_uid: string | null }>((a, b) => db.from("saas_assets").select("id, tag_token, nfc_uid", { count: "exact" }).eq("company_id", companyId).neq("status", "retired").order("id").range(a, b)),
    readAll<Out>((a, b) => db.from("saas_assets").select("id, out_since, out_loadout_id, out_with_name, unit_id", { count: "exact" }).eq("company_id", companyId).not("out_since", "is", null).order("id").range(a, b)),
    // Each truck's newest load-out and check-in (migration 0028): is the trip a piece went out on still going?
    db.from("saas_loadout_latest").select("id, unit_id, finished_at, scanned_by").eq("company_id", companyId),
    db.from("saas_return_latest").select("unit_id, finished_at").eq("company_id", companyId),
  ]);
  // Fingerprints only: the tag codes themselves never go to the phone.
  const keys = new Map(await Promise.all(((tagRows ?? []) as { id: string; tag_token: string | null; nfc_uid: string | null }[])
    .map(async (r) => [r.id, { tag: r.tag_token ? await tagKey(r.tag_token) : "", ext: r.nfc_uid ? await tagKey(r.nfc_uid) : null }] as const)));
  const now = Date.now();
  const outDays: Record<string, number> = {};
  for (const r of (outRows ?? []) as Out[]) outDays[r.id] = daysOut(r.out_since, now);
  const outOf = new Map(((outRows ?? []) as Out[]).map((r) => [r.id, r]));
  const latest = new Map(((latestRows ?? []) as { id: string; unit_id: string; finished_at: string; scanned_by: string | null }[]).map((l) => [l.unit_id, l]));
  const backAt = new Map(((backRows ?? []) as { unit_id: string; finished_at: string }[]).map((b) => [b.unit_id, b.finished_at]));
  /** The finishLoadout rule: it went out on its truck's newest load-out, and the truck hasn't been checked in since. */
  const tripOf = (o: Out | undefined) => {
    if (!o?.unit_id || !o.out_loadout_id) return null;
    const l = latest.get(o.unit_id);
    if (!l || l.id !== o.out_loadout_id) return null;
    const back = backAt.get(o.unit_id);
    return back && Date.parse(back) >= Date.parse(l.finished_at) ? null : l;
  };
  const pieces: YardScanPiece[] = list.rows.filter((r) => r.state !== "retired").map((r) => {
    // Marked missing, now in someone's hand: scanning it marks it found, and
    // the server judges it on its tests like any other piece. So does the phone.
    const found = r.status === "missing" && !r.needsRedress;
    const st = !found ? r.state : !r.next ? "no_paper"
      : r.next.result === "expired" || r.next.result === "missing" ? "overdue"
      : r.next.result === "due_soon" || r.next.result === "pending" ? "due" : "ok";
    const tests = r.next ? `${r.next.title}: ${r.next.detail}` : "No test on file";
    const o = outOf.get(r.id);
    const trip = tripOf(o);
    return {
      id: r.id, name: r.name, serial: r.identifier, unitId: r.unitId, where: r.where, spot: r.note, category: r.category,
      tagKey: keys.get(r.id)?.tag ?? "", extKey: keys.get(r.id)?.ext ?? null,
      // Pressure iron with no test on file can't go out, so it reads red on the phone too.
      problem: st === "overdue" || st === "down" || (st === "no_paper" && TESTED_CATEGORIES.has(r.category)) ? "red" : st === "due" ? "yellow" : null,
      statusText: found ? `Marked missing. Scanning it marks it found. ${tests}` : st === "down" ? stateLabel(r) : tests,
      out: outDays[r.id] !== undefined,
      missing: r.status === "missing",
      trip: trip && r.unitName && o ? { truck: r.unitName, sinceText: fmtWhen(o.out_since), by: trip.scanned_by } : null,
      outWith: o?.out_with_name ? { name: o.out_with_name, sinceText: fmtWhen(o.out_since), long: now - Date.parse(o.out_since) > RUN_MS } : null,
    };
  });
  return { pieces, outDays };
}
