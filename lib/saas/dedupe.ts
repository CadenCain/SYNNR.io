import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Double-tap guard for create forms. Server actions re-run on a second tap
 * before the first response lands (slow yard connections make this common),
 * which wrote duplicate crew members, certs, and assets seconds apart. Before
 * inserting, check whether an identical row was created in the last few
 * seconds — if so, the second tap is an echo, not intent.
 *
 * This is a heuristic, not a constraint: two genuinely identical adds more
 * than `windowMs` apart still work (a shop CAN own two assets with the same
 * name).
 */
export async function isRecentDuplicate(
  db: SupabaseClient,
  table: string,
  match: Record<string, string | null>,
  windowMs = 15_000,
): Promise<boolean> {
  let q = db.from(table).select("id", { count: "exact", head: true })
    .gte("created_at", new Date(Date.now() - windowMs).toISOString());
  for (const [k, v] of Object.entries(match)) {
    q = v === null ? q.is(k, null) : q.eq(k, v);
  }
  const { count, error } = await q;
  // On error, err toward allowing the insert — losing a dedupe beats losing data.
  return !error && (count ?? 0) > 0;
}
