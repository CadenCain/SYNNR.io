import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { canTransition, isAssetState, type AssetState } from "@/lib/twin/fsm";

/**
 * PATCH /api/yard/asset/[id] — drive an asset through the FSM.
 * body { to } — validated against VALID_TRANSITIONS; logs an asset_state_event.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "auth not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
  const ws = profile?.workspace_id;
  if (!ws) return NextResponse.json({ ok: false, error: "no workspace" }, { status: 400 });

  let body: { to?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 }); }
  const to = body.to;
  if (!to || !isAssetState(to)) return NextResponse.json({ ok: false, error: "invalid target state" }, { status: 400 });

  const { data: asset } = await supabase.from("assets").select("id, state").eq("id", id).maybeSingle();
  if (!asset) return NextResponse.json({ ok: false, error: "asset not found" }, { status: 404 });
  const from = asset.state as AssetState;
  if (from === to) return NextResponse.json({ ok: true, state: to });
  if (!canTransition(from, to)) {
    return NextResponse.json({ ok: false, error: `Can't go ${from} → ${to}` }, { status: 422 });
  }

  const { error } = await supabase.from("assets").update({ state: to }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await supabase.from("asset_state_events").insert({
    workspace_id: ws, asset_id: id, from_state: from, to_state: to, trigger_source: "manual",
  });
  return NextResponse.json({ ok: true, state: to });
}
