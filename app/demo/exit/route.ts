import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * The demo's exit door. Signs the throwaway demo session out, then:
 *   ?to=signup  straight to creating a real account (Get started)
 *   ?to=login   to log in to a real account
 *   ?next=/invite/<token>  back to a crew invite
 *   otherwise   back to /demo
 * Signup and login send a visitor still in the demo through here, so the
 * demo never traps anyone.
 */
export const dynamic = "force-dynamic";

const DEST: Record<string, string> = { signup: "/signup", login: "/login" };

export async function GET(req: Request) {
  const sb = await getServerSupabase();
  if (sb) await sb.auth.signOut().catch(() => {});
  const sp = new URL(req.url).searchParams;
  // ?next=/invite/<token>: someone opened a crew invite while still in the demo.
  const next = sp.get("next") ?? "";
  const safeNext = /^\/invite\/[A-Za-z0-9_-]{8,200}$/.test(next) ? next : null;
  return NextResponse.redirect(new URL(safeNext ?? DEST[sp.get("to") ?? ""] ?? "/demo", req.url), 303);
}
