import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/**
 * Everything the brain has read, in one file a manager can keep: each
 * document's name, kind, and its words as SYNNR read them. The files
 * themselves come back one at a time from each document's own page. It
 * works on a paused account too: a shop's own words are never held back.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { company } = await requireCompany();
  if (company.role === "member") return new NextResponse("Only a manager can download the shop's documents.", { status: 403 });
  const db = await saasDb();
  const [{ data: docs }, { data: chunks }] = await Promise.all([
    db.from("synnr_docs").select("id, title, kind, origin, file_name, pages, status, managers_only, added_by_name, created_at").eq("company_id", company.id).order("title").limit(1000),
    db.from("synnr_doc_chunks").select("doc_id, idx, section, page, body").eq("company_id", company.id).order("doc_id").order("idx").limit(100000),
  ]);
  type Chunk = { doc_id: string; idx: number; section: string | null; page: number | null; body: string };
  const byDoc = new Map<string, Chunk[]>();
  for (const c of (chunks ?? []) as Chunk[]) byDoc.set(c.doc_id, [...(byDoc.get(c.doc_id) ?? []), c]);
  const out = {
    company: company.name,
    downloaded_at: new Date().toISOString(),
    documents: ((docs ?? []) as { id: string; title: string }[]).map((d) => ({
      ...d,
      passages: (byDoc.get(d.id) ?? []).map(({ section, page, body }) => ({ section, page, text: body })),
    })),
  };
  const name = `${company.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "synnr"}-brain.json`;
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" },
  });
}
