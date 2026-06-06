import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Server-side Supabase client. Uses the publishable/anon key (RLS enforced).
 * When auth lands, swap to @supabase/ssr with cookie-based sessions so
 * current_workspace_id() resolves per request. Returns null if unconfigured.
 */
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
