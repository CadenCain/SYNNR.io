import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Service-role client for trusted server contexts with no user session
 * (the alerts cron). Bypasses RLS — only use where there is no caller to scope
 * to. Returns null if env isn't set.
 */
export function saasAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

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
