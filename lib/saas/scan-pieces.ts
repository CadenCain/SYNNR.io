import type { SupabaseClient } from "@supabase/supabase-js";
import { getEquipment, stateLabel } from "./equipment";
import type { ScanPiece } from "./loadout";
import { daysOut } from "./whereabouts";

/**
 * Every piece a scan screen can recognize (load-out or check-in): its tags,
 * where it's logged, whether it's bad, and how long it's been out on a job.
 */
export async function getScanPieces(db: SupabaseClient, companyId: string): Promise<{ pieces: ScanPiece[]; outDays: Record<string, number> }> {
  const [list, { data: tagRows }, { data: outRows }] = await Promise.all([
    getEquipment(db, companyId),
    db.from("saas_assets").select("id, nfc_uid").eq("company_id", companyId).not("nfc_uid", "is", null),
    db.from("saas_assets").select("id, out_since").eq("company_id", companyId).not("out_since", "is", null),
  ]);
  const extTag = new Map(((tagRows ?? []) as { id: string; nfc_uid: string }[]).map((r) => [r.id, r.nfc_uid]));
  const now = Date.now();
  const outDays: Record<string, number> = {};
  for (const r of (outRows ?? []) as { id: string; out_since: string }[]) outDays[r.id] = daysOut(r.out_since, now);
  const pieces: ScanPiece[] = list.rows.filter((r) => r.state !== "retired").map((r) => ({
    id: r.id, name: r.name, serial: r.identifier, unitId: r.unitId, where: r.where,
    tagToken: r.tagToken, extTag: extTag.get(r.id) ?? null,
    problem: r.state === "overdue" || r.state === "down" ? "red" : r.state === "due" ? "yellow" : null,
    statusText: r.state === "down" ? stateLabel(r) : r.next ? `${r.next.title}: ${r.next.detail}` : "No test on file",
  }));
  return { pieces, outDays };
}
