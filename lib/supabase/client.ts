import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Browser Supabase client (anon / publishable key). Safe for client components.
 * Returns null if env isn't configured so the static UI never crashes pre-wiring.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key);
}
