import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Seeds a deterministic sample yard (trucks + tools, wireline-flavored, varied
 * states) so the Digital Yard Twin is demoable with no manual entry. Idempotent:
 * only seeds when the workspace has no assets yet.
 */
export async function POST() {
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "auth not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
  const ws = profile?.workspace_id;
  if (!ws) return NextResponse.json({ ok: false, error: "no workspace" }, { status: 400 });

  const { count } = await supabase.from("assets").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true, seeded: false, message: "Yard already has assets." });

  const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const crewId = (await supabase.from("crews").select("id").limit(1).maybeSingle()).data?.id ?? null;
  const jobId = (await supabase.from("jobs").select("id").limit(1).maybeSingle()).data?.id ?? null;

  // Trucks (nodes)
  const { data: trucks, error: tErr } = await supabase.from("assets").insert([
    { workspace_id: ws, name: "TRK-04 · Wireline", category: "truck", asset_kind: "node", identifier: "TRK-04", state: "loaded_verified", inspection_date: iso(120), crew_id: crewId, current_job_id: jobId },
    { workspace_id: ws, name: "TRK-02 · Wireline", category: "truck", asset_kind: "node", identifier: "TRK-02", state: "yard_available", inspection_date: iso(9) },
    { workspace_id: ws, name: "TRK-09 · Wireline", category: "truck", asset_kind: "node", identifier: "TRK-09", state: "staged_for_loadout", inspection_date: iso(60) },
    { workspace_id: ws, name: "TRK-07 · Pump", category: "truck", asset_kind: "node", identifier: "TRK-07", state: "maintenance_required", inspection_date: iso(-3) },
  ]).select("id, identifier");
  if (tErr || !trucks) return NextResponse.json({ ok: false, error: tErr?.message || "truck insert failed" }, { status: 500 });

  const byId = (ident: string) => trucks.find((t) => t.identifier === ident)?.id ?? null;
  const item = (parent: string | null, name: string, category: string, state: string, cal: number | null) => ({
    workspace_id: ws, parent_asset_id: parent, name, category, asset_kind: "item", state, calibration_date: cal == null ? null : iso(cal),
  });

  const items = [
    // TRK-04 — fully loaded & verified (green)
    item(byId("TRK-04"), "Perforating gun ×3", "perforating_gun", "loaded_verified", 200),
    item(byId("TRK-04"), "CCL", "ccl", "loaded_verified", 180),
    item(byId("TRK-04"), "Wireline cable", "cable", "loaded_verified", 300),
    // TRK-02 — available, but a tool's calibration is due soon (at risk)
    item(byId("TRK-02"), "Perforating gun ×2", "perforating_gun", "yard_available", 9),
    item(byId("TRK-02"), "Pressure gauge", "gauge", "yard_available", 45),
    // TRK-09 — staged but missing a required tool (blocked)
    item(byId("TRK-09"), "CCL", "ccl", "staged_for_loadout", 150),
    item(byId("TRK-09"), "Perforating gun", "perforating_gun", "maintenance_required", null),
    // TRK-07 — in maintenance (red)
    item(byId("TRK-07"), "Triplex pump", "pump", "maintenance_required", -10),
  ];
  const { error: iErr } = await supabase.from("assets").insert(items);
  if (iErr) return NextResponse.json({ ok: false, error: iErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, seeded: true, trucks: trucks.length, items: items.length });
}
