import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Auth callback for emailed sign-in links. Supabase redirects here after the
 * user clicks the link: PKCE flows arrive with ?code=, link-style verifies
 * arrive with ?token_hash=&type=. Exchanges for a cookie session, then sends
 * the user on (default /onboarding). On failure, back to /login with a hint.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/onboarding";

  const fail = (m: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(m)}`, url.origin));

  const supabase = await getServerSupabase();
  if (!supabase) return fail("Sign-in isn't enabled yet.");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(error.message);
  } else {
    return fail("That sign-in link is invalid or expired — request a new one.");
  }

  return NextResponse.redirect(new URL(dest, url.origin));
}
