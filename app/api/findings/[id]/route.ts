import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

const STATES = ["open", "approved", "recovered", "dismissed", "resolved"] as const;
type State = (typeof STATES)[number];

/** Persist a finding state transition (RLS scopes it to the caller's workspace). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { state?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }
  const state = body.state;
  if (!state || !STATES.includes(state as State)) {
    return NextResponse.json({ ok: false, error: "invalid state" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "auth not configured" }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { error } = await supabase.from("findings").update({ state: state as State }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, state });
}
