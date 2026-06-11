import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { runEngine } from "@/lib/engine/run";

export const maxDuration = 120;

function mediaTypeOf(name: string, mime: string | null): string {
  const m = (mime || "").toLowerCase();
  if (m && m !== "application/octet-stream") return m;
  const n = (name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (/\.(jpg|jpeg)$/.test(n)) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  if (/\.(txt|csv|tsv|md|json|log|text)$/.test(n)) return "text/plain";
  return m || "application/octet-stream";
}
function isText(mt: string, name: string): boolean {
  return mt.startsWith("text/") || mt === "application/json" || /\.(txt|csv|tsv|md|json|log|text)$/.test((name || "").toLowerCase());
}
// PDFs + images go to the vision model. xlsx/docx/zip still need conversion.
function isVision(mt: string): boolean {
  return mt === "application/pdf" || ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mt);
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

  // Per-workspace quota — the engine calls a paid model, so cap runs/hour.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count: recentRuns } = await supabase
    .from("audit_runs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ws)
    .gte("created_at", hourAgo);
  if ((recentRuns ?? 0) >= 20) {
    return NextResponse.json({ ok: false, error: "rate limit — too many audits this hour" }, { status: 429 });
  }

  type EngineFile = { bytes: Uint8Array; mediaType: string; name: string };
  let parts: { ticket?: string; invoice?: string; pricebook?: string; raw?: string; files?: EngineFile[] } = {};
  try {
    parts = await req.json();
  } catch {
    parts = {};
  }

  let usedSample = false;
  let filesRead = 0;
  let filesSkipped = 0;

  // No explicit input -> reconcile the workspace's real uploads (text + PDFs/images).
  if (!parts.ticket && !parts.invoice && !parts.pricebook && !parts.raw && !parts.files) {
    const { data: arts } = await supabase
      .from("artifacts")
      .select("name, kind, mime, storage_path")
      .order("created_at", { ascending: false })
      .limit(24);
    let raw = "";
    const files: EngineFile[] = [];
    let bytesBudget = 16 * 1024 * 1024; // cap multimodal payload

    for (const a of arts ?? []) {
      if (!a.storage_path) continue;
      const mt = mediaTypeOf(a.name, a.mime);

      if (isText(mt, a.name)) {
        const { data: blob } = await supabase.storage.from("job-data").download(a.storage_path);
        if (!blob) { filesSkipped++; continue; }
        try {
          raw += `\n--- ${a.kind.toUpperCase()}: ${a.name} ---\n${await blob.text()}\n`;
          filesRead++;
        } catch {
          filesSkipped++;
        }
      } else if (isVision(mt) && files.length < 8) {
        const { data: blob } = await supabase.storage.from("job-data").download(a.storage_path);
        if (!blob) { filesSkipped++; continue; }
        const ab = await blob.arrayBuffer();
        if (ab.byteLength > bytesBudget) { filesSkipped++; continue; }
        bytesBudget -= ab.byteLength;
        files.push({ bytes: new Uint8Array(ab), mediaType: mt, name: a.name });
        filesRead++;
      } else {
        filesSkipped++; // xlsx/docx/zip/heic — conversion not wired yet
      }
      if (raw.length > 24000) break;
    }

    if (raw.trim() || files.length) parts = { raw: raw || undefined, files: files.length ? files : undefined };
    else usedSample = true; // nothing usable yet -> sample so it still produces a result
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
      title: usedSample ? `Sample job — ${result.jobNumber}` : `Reconciled job — ${result.jobNumber}`,
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
    label: usedSample ? `Sample run — ${result.jobNumber}` : `Engine run — ${result.jobNumber}`,
    jobs_count: 1,
    recovered_cents: 0,
    status: "complete",
  });

  const counts = { missed: 0, rate: 0, doc: 0 };
  for (const f of result.findings) counts[f.type] += 1;

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    jobNumber: result.jobNumber,
    recoverableCents: result.recoverableCents,
    findings: result.findings.length,
    counts,
    source: usedSample ? "sample" : "uploads",
    filesRead,
    filesSkipped,
  });
}
