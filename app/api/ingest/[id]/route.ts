import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * PATCH /api/ingest/[id]  — confirm or correct one extracted field (HITL).
 *   body { fieldId, value }  → writes corrected_value (+ who/when). Confirming an
 *   amber field sends value === current value; fixing a red field sends the typed value.
 * POST  /api/ingest/[id]   — commit the reviewed document into the domain tables
 *   (certifications or pricebook_rules). Requires every field resolved.
 */

async function ctx() {
  const supabase = await getServerSupabase();
  if (!supabase) return { error: NextResponse.json({ ok: false, error: "auth not configured" }, { status: 503 }) };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { supabase, userId: auth.user.id };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx();
  if (c.error) return c.error;
  const { supabase, userId } = c;

  let body: { fieldId?: string; value?: string | number | null };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 }); }
  if (!body.fieldId) return NextResponse.json({ ok: false, error: "fieldId required" }, { status: 400 });

  const { error } = await supabase
    .from("extracted_fields")
    .update({ corrected_value: body.value ?? null, corrected_by: userId, corrected_at: new Date().toISOString() })
    .eq("id", body.fieldId)
    .eq("document_id", id); // RLS also scopes to workspace
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const eff = (f: { value: unknown; corrected_value: unknown }) => (f.corrected_value ?? f.value);
const str = (v: unknown) => (v == null ? null : String(v));
const dateOrNull = (v: unknown) => { const s = str(v); return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const num = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "")); return Number.isFinite(n) ? n : null; };

function certStatus(exp: string | null): "active" | "expiring" | "expired" | "pending_review" {
  if (!exp) return "pending_review";
  const days = Math.floor((new Date(exp).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "active";
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx();
  if (c.error) return c.error;
  const { supabase } = c;

  const { data: doc } = await supabase.from("documents").select("id, workspace_id, document_type, source_file").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ ok: false, error: "document not found" }, { status: 404 });

  const { data: fields } = await supabase
    .from("extracted_fields")
    .select("field_path, label, value, corrected_value, flag")
    .eq("document_id", id);
  if (!fields) return NextResponse.json({ ok: false, error: "no fields" }, { status: 400 });

  // Gate: every non-auto field must be resolved (a corrected_value written).
  const unresolved = fields.filter((f) => f.flag !== "AUTO_ACCEPTED" && f.corrected_value === null);
  if (unresolved.length) {
    return NextResponse.json({ ok: false, error: `${unresolved.length} field(s) still need review`, unresolved: unresolved.map((u) => u.field_path) }, { status: 422 });
  }

  const ws = doc.workspace_id;
  const byPath = (p: string) => fields.find((f) => f.field_path === p);

  if (doc.document_type === "CERTIFICATION") {
    const exp = dateOrNull(eff(byPath("expiration_date") ?? { value: null, corrected_value: null }));
    const { error } = await supabase.from("certifications").insert({
      workspace_id: ws,
      employee_name: str(eff(byPath("employee_name") ?? { value: "", corrected_value: null })) || "Unknown",
      cert_type: str(eff(byPath("certification_type") ?? { value: "", corrected_value: null })) || "Unknown",
      issuing_body: str(eff(byPath("issuing_body") ?? { value: null, corrected_value: null })),
      issued_date: dateOrNull(eff(byPath("issued_date") ?? { value: null, corrected_value: null })),
      expiration_date: exp,
      source_document_id: doc.id,
      status: certStatus(exp),
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  } else if (doc.document_type === "RATE_SHEET") {
    const idxs = [...new Set(fields.map((f) => f.field_path.match(/^line_items\[(\d+)\]/)?.[1]).filter(Boolean))] as string[];
    const effDate = dateOrNull(eff(byPath("effective_date") ?? { value: null, corrected_value: null }));
    const rows = idxs.map((i) => {
      const g = (k: string) => eff(byPath(`line_items[${i}].${k}`) ?? { value: null, corrected_value: null });
      const rate = num(g("rate"));
      return {
        workspace_id: ws,
        label: str(g("description")) || str(g("service_code")) || "Rate line",
        service_code: str(g("service_code")),
        unit: str(g("unit")),
        billed_cents: null as number | null,
        contract_cents: rate != null ? Math.round(rate * 100) : null,
        discount_pct: num(g("negotiated_discount_pct")),
        effective_date: effDate,
        source_document_id: doc.id,
      };
    });
    if (rows.length) {
      const { error } = await supabase.from("pricebook_rules").insert(rows);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  } else {
    return NextResponse.json({ ok: false, error: `commit not supported for ${doc.document_type}` }, { status: 400 });
  }

  await supabase.from("documents").update({ status: "complete" }).eq("id", id);
  return NextResponse.json({ ok: true, committed: doc.document_type });
}
