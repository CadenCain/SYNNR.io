import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The demo's exit door. /signup bounces signed-in users back to /app (correct
 * for real customers) — which made every "get your own yard" CTA inside a
 * demo session a silent boomerang. This signs the throwaway session out
 * FIRST, then lands on signup. Safe for logged-out visitors too (signOut is
 * a no-op), so every demo CTA can point here unconditionally.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  return NextResponse.redirect(new URL("/signup", req.url), 303);
}
