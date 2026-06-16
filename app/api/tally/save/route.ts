import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSignedInOrg, requireProductApi } from "@/lib/marketplace/access";
import { deviceLabel } from "@/lib/marketplace/usage";
import { reportSheetOverage } from "@/lib/marketplace/billing";
import type { TallyResult } from "@/lib/tally";

/**
 * Save a completed tally to the org's records (system of record). Gated to
 * TallyShot seat-holders; the row is org-scoped via RLS so the whole team can
 * see it on the dashboard.
 */
export async function POST(req: Request) {
  const gate = await requireProductApi("tallyshot");
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.reason }, { status: gate.status });

  const org = await getSignedInOrg();
  const supabase = await getServerSupabase();
  if (!org?.workspaceId || !supabase) return NextResponse.json({ ok: false, error: "no workspace" }, { status: 400 });

  let body: { result?: TallyResult; meta?: Record<string, string> } = {};
  try { body = await req.json(); } catch { /* */ }
  const result = body.result;
  if (!result || !Array.isArray(result.joints)) return NextResponse.json({ ok: false, error: "no tally result" }, { status: 400 });

  const m = body.meta ?? {};
  const { data, error } = await supabase
    .from("tallies")
    .insert({
      workspace_id: org.workspaceId,
      created_by: org.userId,
      well_name: m.wellName?.trim() || null,
      lease: m.lease?.trim() || null,
      rig: m.rig?.trim() || null,
      company: m.company?.trim() || result.meta?.company || null,
      sheet_no: m.sheetNo?.trim() || result.meta?.sheetNo || null,
      size: m.size?.trim() || result.meta?.size || null,
      connection: m.connection?.trim() || null,
      tally_date: m.date?.trim() || null,
      joint_count: result.jointCount,
      grand_total_ft: result.grandTotalFt,
      flagged_count: result.flaggedCount,
      confirmed: result.confirmedFinal,
      cross_check_pass: result.crossCheck?.ran ? result.crossCheck.pass : null,
      source: result.usedSample ? "sample" : "photo",
      result: result as never,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Record one metered usage unit per saved sheet (drives overage + device visibility).
  await supabase.from("usage_events").insert({
    workspace_id: org.workspaceId,
    product_slug: "tallyshot",
    user_id: org.userId,
    qty: 1,
    device: deviceLabel(req.headers.get("user-agent")),
  });

  // Bill the marginal overage if this save pushed the org past its pooled quota.
  await reportSheetOverage(supabase as never, org.workspaceId, "tallyshot");

  return NextResponse.json({ ok: true, id: data.id });
}
