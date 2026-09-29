import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The demo's exit door. Signs the throwaway demo session out, then lands on
 * the free-setup form on /demo (name, company, cell). Card-required signup
 * isn't a front door; Caden closes on the phone and sends that link himself.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  return NextResponse.redirect(new URL("/demo#your-yard", req.url), 303);
}
