import "../../ingest/ingest.css";
import { redirect, notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import ReviewClient, { type ReviewField, type ReviewDoc } from "./review-client";

export const metadata = { title: "SYNNR — Review extracted data" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  if (!supabase) redirect("/login");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/review/${id}`);

  const { data: doc } = await supabase
    .from("documents")
    .select("id, document_type, source_file, mime, storage_path, status, classification_confidence, fields_auto_accepted, fields_review, fields_manual, structured_data")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();

  const { data: fields } = await supabase
    .from("extracted_fields")
    .select("id, field_path, label, value, confidence, flag, business_rule_override, corrected_value")
    .eq("document_id", id)
    .order("created_at", { ascending: true });

  // Source preview: sample docs carry source_text; uploads get a short-lived signed URL.
  let sourceUrl: string | null = null;
  const sd = doc.structured_data as { source_text?: string } | null;
  const sourceText = sd?.source_text ?? null;
  if (!sourceText && doc.storage_path) {
    const { data: signed } = await supabase.storage.from("job-data").createSignedUrl(doc.storage_path, 3600);
    sourceUrl = signed?.signedUrl ?? null;
  }

  const rdoc: ReviewDoc = {
    id: doc.id,
    documentType: doc.document_type ?? "UNKNOWN",
    sourceFile: doc.source_file,
    mime: doc.mime,
    status: doc.status,
    sourceText,
    sourceUrl,
    counts: { auto: doc.fields_auto_accepted, review: doc.fields_review, manual: doc.fields_manual },
  };

  return <ReviewClient doc={rdoc} fields={(fields ?? []) as ReviewField[]} />;
}
