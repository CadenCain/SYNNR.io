import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the readiness system.
 *
 * Why a separate client (not lib/supabase/admin.ts): admin.ts is typed against
 * the parked marketplace schema. The readiness tables (rd_*) aren't in that
 * type tree, so we use an untyped client here and cast at the boundary. Cheap
 * and avoids a 60KB type regen every time the schema moves.
 *
 * SERVER ONLY. Bypasses RLS — every rd_* table has RLS on with no policies.
 * Returns null if env isn't set so server components fail soft.
 */
export function getReadinessDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Throws when the readiness DB isn't configured — use inside protected
 *  operator routes where missing config is a real misconfiguration, not a
 *  graceful-degradation case. */
export function requireReadinessDb(): SupabaseClient {
  const db = getReadinessDb();
  if (!db) {
    throw new Error(
      "Readiness DB not configured. Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return db;
}
