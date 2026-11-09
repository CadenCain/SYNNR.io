import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "./read-all";
import { getEquipment, stateLabel } from "./equipment";
import type { ScanPiece } from "./loadout";
import { daysOut } from "./whereabouts";
import { TESTED_CATEGORIES } from "./taxonomy";
import { tagKey } from "./tag-key";

/**
 * Every piece a scan screen can recognize (load-out or check-in): its tags,
 * where it's logged, whether it's bad, and how long it's been out on a job.
 */
export async function getScanPieces(db: SupabaseClient, companyId: string): Promise<{ pieces: ScanPiece[]; outDays: Record<string, number> }> {
  const [list, tagRows, outRows] = await Promise.all([
    getEquipment(db, companyId),
    readAll<{ id: string; tag_token: string | null; nfc_uid: string | null }>((a, b) => db.from("saas_assets").select("id, tag_token, nfc_uid", { count: "exact" }).eq("company_id", companyId).neq("status", "retired").order("id").range(a, b)),
    readAll<{ id: string; out_since: string }>((a, b) => db.from("saas_assets").select("id, out_since", { count: "exact" }).eq("company_id", companyId).not("out_since", "is", null).order("id").range(a, b)),
  ]);
  // Fingerprints only: the tag codes themselves never go to the phone.
  const keys = new Map(await Promise.all(((tagRows ?? []) as { id: string; tag_token: string | null; nfc_uid: string | null }[])
    .map(async (r) => [r.id, { tag: r.tag_token ? await tagKey(r.tag_token) : "", ext: r.nfc_uid ? await tagKey(r.nfc_uid) : null }] as const)));
  const now = Date.now();
  const outDays: Record<string, number> = {};
  for (const r of (outRows ?? []) as { id: string; out_since: string }[]) outDays[r.id] = daysOut(r.out_since, now);
  const pieces: ScanPiece[] = list.rows.filter((r) => r.state !== "retired").map((r) => ({
    id: r.id, name: r.name, serial: r.identifier, unitId: r.unitId, where: r.where, spot: r.note, category: r.category,
    tagKey: keys.get(r.id)?.tag ?? "", extKey: keys.get(r.id)?.ext ?? null,
    // Pressure iron with no test on file can't go out, so it reads red on the phone too.
    problem: r.state === "overdue" || r.state === "down" || (r.state === "no_paper" && TESTED_CATEGORIES.has(r.category)) ? "red" : r.state === "due" ? "yellow" : null,
    statusText: r.state === "down" ? stateLabel(r) : r.next ? `${r.next.title}: ${r.next.detail}` : "No test on file",
  }));
  return { pieces, outDays };
}
