import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Captures an early-access / onboarding lead into Supabase (leads table).
 * Anon-insert is allowed by RLS. No-ops gracefully if env isn't configured.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  if (!supabase) {
    // Not yet wired (no env) — accept silently so the funnel never breaks.
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabase.from("leads").insert({
    email,
    company: typeof body.company === "string" ? body.company : null,
    name: typeof body.name === "string" ? body.name : null,
    industry: typeof body.industry === "string" ? body.industry : null,
    source: typeof body.source === "string" ? body.source : "onboarding",
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stored: true });
}
