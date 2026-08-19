import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ownership checks for client-supplied ids and storage paths.
 *
 * RLS stamps our company_id on every row we write, but it does NOT stop us
 * writing a row that POINTS at another tenant's object (a cert hung on their
 * unit id, an attachment path under their storage prefix). These helpers
 * close that class: every id or path a browser hands us gets proven ours
 * before it's persisted.
 */

const PARENT_TABLE: Record<string, string> = {
  unit: "saas_units",
  asset: "saas_assets",
  crew: "saas_crew_members",
};

/** True iff `id` exists in this company under the given parent type. */
export async function ownsParent(
  db: SupabaseClient, companyId: string, parentType: string, id: string,
): Promise<boolean> {
  const table = PARENT_TABLE[parentType];
  if (!table || !id) return false;
  const { data } = await db.from(table).select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return Boolean(data);
}

/** A storage path a client hands us must live under OUR company prefix. */
export function ownsStoragePath(path: string | null | undefined, companyId: string): boolean {
  return Boolean(path && path.startsWith(companyId + "/"));
}
