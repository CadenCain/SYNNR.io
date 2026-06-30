import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Self-serve signup. Creates the auth user pre-confirmed via the admin API so
 * the flow works TODAY without email delivery (the Supabase→Resend SMTP wiring
 * is still pending). The client then signs in with the same password.
 *
 * When SMTP is live we can switch to standard email-confirmation signup; this
 * endpoint stays as the no-friction path.
 */
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function POST(req: Request) {
  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });

  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false, error: "Signup is temporarily unavailable." }, { status: 500 });

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  if (error) {
    const already = /already.*registered|exists/i.test(error.message);
    return NextResponse.json(
      { ok: false, error: already ? "That email already has an account — try logging in." : error.message },
      { status: already ? 409 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
