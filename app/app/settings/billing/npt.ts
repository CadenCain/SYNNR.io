import type { SupabaseClient } from "@supabase/supabase-js";
import { localToday } from "@/lib/saas/status";
import { readAll } from "@/lib/saas/read-all";

/**
 * The NPT day-rate's one use: the owner's own estimate of downtime avoided.
 * A truck stopped NOT READY at load-out that nobody rolled on an override is
 * a miss caught in the yard. Counted once per truck per day, so scanning the
 * same truck again after a fix isn't a second catch, and a day the truck
 * rolled on an override anyway isn't a catch at all.
 */
export const NPT_WINDOW_DAYS = 30;

export function caughtCount(
  blocked: { id: string; unit_id: string | null; finished_at: string }[],
  overridden: Set<string>,
): number {
  const key = (b: (typeof blocked)[number]) => `${b.unit_id ?? b.id}|${localToday(new Date(b.finished_at))}`;
  const rolledAnyway = new Set(blocked.filter((b) => overridden.has(b.id)).map(key));
  return new Set(blocked.map(key).filter((k) => !rolledAnyway.has(k))).size;
}

/** The count for the last NPT_WINDOW_DAYS days, read from the company's own records. */
export async function caughtLately(db: SupabaseClient, companyId: string): Promise<number> {
  const since = new Date(Date.now() - NPT_WINDOW_DAYS * 86400e3).toISOString();
  const [blocked, ovs] = await Promise.all([
    readAll<{ id: string; unit_id: string | null; finished_at: string }>((a, b) => db.from("saas_loadout_scans")
      .select("id, unit_id, finished_at", { count: "exact" }).eq("company_id", companyId).eq("verdict", "not_ready")
      .gte("finished_at", since).order("id").range(a, b)),
    readAll<{ loadout_id: string }>((a, b) => db.from("saas_loadout_overrides")
      .select("loadout_id", { count: "exact" }).eq("company_id", companyId).gte("created_at", since).order("loadout_id").range(a, b)),
  ]);
  return caughtCount(blocked, new Set(ovs.map((o) => o.loadout_id)));
}
