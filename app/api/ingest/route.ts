import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { runIngestion, sampleSource, type IngestPart } from "@/lib/ingest/run";
import { DOC_TYPES, type DocType } from "@/lib/ingest/schemas";

export const maxDuration = 120;

/**
 * Module 1 — ingest a document. Accepts:
 *  - JSON { sample: 'CERTIFICATION' | 'RATE_SHEET' }  → cardless demo (no AI Gateway)
 *  - JSON { text, docHint? }                          → real text extraction
 *  - multipart/form-data { file, docHint? }           → real file/image extraction
 * Persists `documents` + per-field `extracted_fields`, returns a review deep-link.
 */
export async function POST(req: Request) {
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ ok: false, error: "auth not configured" }, { status: 503 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("workspace_id").eq("id", auth.user.id).maybeSingle();
  const ws = profile?.workspace_id;
  if (!ws) return NextResponse.json({ ok: false, error: "no workspace" }, { status: 400 });

  let sample: DocType | undefined;
  let docHint: DocType | undefined;
  let parts: IngestPart[] | undefined;
  let sourceFile = "document";
  let mime: string | null = null;
  let storagePath: string | null = null;
  let channel: "web" | "mobile" | "email" | "api" = "web";

  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const hint = form.get("docHint");
      if (hint && DOC_TYPES.includes(String(hint) as DocType)) docHint = String(hint) as DocType;
      if (file && file instanceof File) {
        sourceFile = file.name || "upload";
        mime = file.type || null;
        const bytes = new Uint8Array(await file.arrayBuffer());
        // stash the source so the HITL screen can show it next to the fields
        storagePath = `${ws}/ingest/${Date.now()}-${sourceFile}`.replace(/\s+/g, "_");
        await supabase.storage.from("job-data").upload(storagePath, bytes, { contentType: mime || undefined, upsert: true });
        const isImg = (mime || "").startsWith("image/");
        parts = [isImg ? { type: "image", image: bytes } : { type: "file", data: bytes, mediaType: mime || "application/pdf", filename: sourceFile }];
      }
    } else {
      const body = await req.json();
      if (body?.sample && DOC_TYPES.includes(body.sample)) { sample = body.sample; sourceFile = `sample-${String(body.sample).toLowerCase()}.txt`; }
      else if (typeof body?.text === "string" && body.text.trim()) {
        parts = [{ type: "text", text: body.text }];
        sourceFile = body.sourceFile || "pasted-text.txt"; mime = "text/plain";
        if (body.docHint && DOC_TYPES.includes(body.docHint)) docHint = body.docHint;
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: "bad request body" }, { status: 400 });
  }

  if (!sample && !parts) return NextResponse.json({ ok: false, error: "no document supplied" }, { status: 400 });

  let result;
  try {
    result = await runIngestion({ sample, docHint, parts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extraction failed";
    return NextResponse.json(
      { ok: false, error: /gateway|credit card|api key/i.test(msg) ? "AI Gateway not configured — add a card in Vercel to ingest real documents (samples work without it)." : msg },
      { status: 502 }
    );
  }

  const status = result.documentType === "UNKNOWN" ? "unmapped" : (result.counts.review + result.counts.manual > 0 ? "partial" : "complete");

  const { data: doc, error: dErr } = await supabase
    .from("documents")
    .insert({
      workspace_id: ws,
      source_file: sourceFile,
      mime,
      storage_path: storagePath,
      channel,
      document_type: result.documentType,
      classification_confidence: result.classificationConfidence,
      status,
      fields_auto_accepted: result.counts.auto,
      fields_review: result.counts.review,
      fields_manual: result.counts.manual,
      structured_data: result.usedSample ? { source_text: sampleSource(result.documentType) } : null,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (dErr || !doc) return NextResponse.json({ ok: false, error: dErr?.message || "document insert failed" }, { status: 500 });

  if (result.fields.length) {
    const { error: fErr } = await supabase.from("extracted_fields").insert(
      result.fields.map((f) => ({
        workspace_id: ws,
        document_id: doc.id,
        field_path: f.field_path,
        label: f.label,
        value: f.value,
        confidence: f.confidence,
        flag: f.flag,
        business_rule_override: f.business_rule_override,
      }))
    );
    if (fErr) return NextResponse.json({ ok: false, error: fErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ingestionId: doc.id,
    documentType: result.documentType,
    status,
    counts: result.counts,
    source: result.usedSample ? "sample" : "upload",
    reviewUrl: `/review/${doc.id}`,
  });
}
