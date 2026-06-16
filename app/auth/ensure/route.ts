import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { ensurePersonalOrg } from "@/lib/marketplace/provision";

/**
 * Post-login landing for password sign-in (which doesn't go through the emailed
 * /auth/callback). Ensures the user has a personal org + owner membership, then
 * forwards them on. Safe to hit when already signed in.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  const supabase = await getServerSupabase();
  if (supabase) {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) await ensurePersonalOrg(auth.user.id, auth.user.email ?? null);
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
