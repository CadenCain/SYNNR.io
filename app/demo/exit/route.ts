import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The demo's exit door. Signs the throwaway demo session out, then:
 *   ?to=signup  straight to creating a real account (Get started)
 *   ?to=login   to log in to a real account
 *   otherwise   back to /demo
 * Signup and login send a visitor still in the demo through here, so the
 * demo never traps anyone.
 */
export const dynamic = "force-dynamic";

const DEST: Record<string, string> = { signup: "/signup", login: "/login" };

export async function GET(req: Request) {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  const to = new URL(req.url).searchParams.get("to") ?? "";
  return NextResponse.redirect(new URL(DEST[to] ?? "/demo", req.url), 303);
}
