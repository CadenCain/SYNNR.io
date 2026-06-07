import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { runEngine } from "@/lib/engine/run";

export const maxDuration = 120;

// Text-like files we can read today. PDFs/images/xlsx need OCR/vision (next).
function readable(name: string, mime: string | null): boolean {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();
  if (m.startsWith("text/")) return true;
  if (["application/json", "application/csv"].includes(m)) return true;
  return /\.(txt|csv|tsv|md|json|log|text)$/.test(n);
}

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

  let parts: { ticket?: string; invoice?: string; pricebook?: string; raw?: string } = {};
  try {
    parts = await req.json();
  } catch {
    parts = {};
  }

  let usedSample = false;
  let filesRead = 0;
  let filesSkipped = 0;

  // No explicit text in the body -> reconcile the workspace's real uploads.
  if (!parts.ticket && !parts.invoice && !parts.pricebook && !parts.raw) {
    const { data: arts } = await supabase
      .from("artifacts")
      .select("name, kind, mime, storage_path")
      .order("created_at", { ascending: false })
      .limit(20);
    let raw = "";
    for (const a of arts ?? []) {
      if (!a.storage_path) continue;
      if (!readable(a.name, a.mime)) { filesSkipped++; continue; }
      const { data: blob } = await supabase.storage.from("job-data").download(a.storage_path);
      if (!blob) { filesSkipped++; continue; }
      try {
        const txt = await blob.text();
        raw += `\n--- ${a.kind.toUpperCase()}: ${a.name} ---\n${txt}\n`;
        filesRead++;
      } catch {
        filesSkipped++;
      }
      if (raw.length > 24000) break;
    }
    if (filesRead > 0) parts = { raw };
    else usedSample = true; // nothing readable yet -> sample so it still produces a result
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
    source: usedSample ? "sample" : "uploads",
    filesRead,
    filesSkipped,
  });
}
