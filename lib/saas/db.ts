import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Loosely-typed cookie-aware Supabase client for saas_* tables. RLS is
 * enforced (anon key + user session), so every query is automatically scoped
 * to the caller's company — the tenant boundary is the database, not app code.
 */
export async function saasDb(): Promise<SupabaseClient> {
  const sb = await getServerSupabase();
  if (!sb) throw new Error("Supabase not configured.");
  return sb as unknown as SupabaseClient;
}

export type ComplianceStatus = "valid" | "expiring" | "expired" | "none";
