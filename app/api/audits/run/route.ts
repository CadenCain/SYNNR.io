import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { runEngine } from "@/lib/engine/run";

export const maxDuration = 120;

/**
 * Runs the reconciliation engine for the caller's workspace: extract -> detect,
 * then persist a job + its findings + an audit run. Accepts optional raw
 * { ticket, invoice, pricebook } text; falls back to the sample job.
 */
export async function POST(req: Request) {
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "auth not configured" }, { status: 503 });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
  const ws = profile?.workspace_id;
  if (!ws) return NextResponse.json({ ok: false, error: "no workspace" }, { status: 400 });

  let parts: { ticket?: string; invoice?: string; pricebook?: string } = {};
  try {
    parts = await req.json();
  } catch {
    parts = {};
  }

  let result;
  try {
    result = await runEngine(parts);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "engine failed — is the AI Gateway configured? " + (e instanceof Error ? e.message : "") },
      { status: 502 }
    );
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .insert({
      workspace_id: ws,
      number: result.jobNumber,
      title: `Reconciled job — ${result.jobNumber}`,
      status: "in_review",
      priority: "high",
      recoverable_cents: result.recoverableCents,
    })
    .select("id")
    .single();
  if (jobErr || !job) return NextResponse.json({ ok: false, error: jobErr?.message || "job insert failed" }, { status: 500 });

  if (result.findings.length) {
    const { error: fErr } = await supabase.from("findings").insert(
      result.findings.map((f) => ({
        workspace_id: ws,
        job_id: job.id,
        type: f.type,
        title: f.title,
        subtitle: f.subtitle,
        amount_cents: f.amount_cents,
        state: "open" as const,
        blocker: f.blocker,
        evidence: f.evidence,
      }))
    );
    if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 });
  }

  await supabase.from("audit_runs").insert({
    workspace_id: ws,
    label: `Engine run — ${result.jobNumber}`,
    jobs_count: 1,
    recovered_cents: 0,
    status: "complete",
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    jobNumber: result.jobNumber,
    recoverableCents: result.recoverableCents,
    findings: result.findings.length,
  });
}
