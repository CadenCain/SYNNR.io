import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Emailed links with a token the server checks itself (password reset, from
 * lib/saas/password-reset.ts). Unlike /auth/callback, nothing has to be saved
 * in the browser beforehand, so the link works on any phone or browser.
 * A used or expired link lands on /forgot to ask for a new one.
 */
export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["recovery", "magiclink", "email", "signup", "invite", "email_change"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const nextParam = url.searchParams.get("next") || "/app";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/app";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/forgot?expired=1", url.origin));
}
