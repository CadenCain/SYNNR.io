import type { SupabaseClient } from "@supabase/supabase-js";

/** item_id → customer names, one round trip. Empty map when nothing's tagged. */
export async function getItemCustomers(
  db: SupabaseClient,
  companyId: string,
  itemIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (itemIds.length === 0) return out;
  const { data } = await db
    .from("saas_item_customers")
    .select("item_id, saas_customers(name)")
    .eq("company_id", companyId)
    .in("item_id", itemIds);
  type Row = { item_id: string; saas_customers: { name: string } | { name: string }[] | null };
  for (const r of (data ?? []) as Row[]) {
    const name = Array.isArray(r.saas_customers) ? r.saas_customers[0]?.name : r.saas_customers?.name;
    if (!name) continue;
    out.set(r.item_id, [...(out.get(r.item_id) ?? []), name].sort());
  }
  return out;
}
