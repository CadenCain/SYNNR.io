import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Signed links to the photo behind each item's current date, for "See the
 * cert". Runs on the caller's own session: RLS and the storage policy keep
 * it inside their company.
 */
export async function paperLinks(db: SupabaseClient, items: { id: string; last_upload_id?: string | null }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = items.map((i) => i.last_upload_id).filter((x): x is string => Boolean(x));
  if (ids.length === 0) return out;
  const { data } = await db.from("saas_cert_uploads").select("id, item_id, storage_path").in("id", ids);
  const ups = (data ?? []) as { id: string; item_id: string; storage_path: string }[];
  if (ups.length === 0) return out;
  const { data: signed } = await db.storage.from("proofs").createSignedUrls(ups.map((u) => u.storage_path), 3600);
  ups.forEach((u, i) => { const url = signed?.[i]?.signedUrl; if (url) out.set(u.item_id, url); });
  return out;
}
