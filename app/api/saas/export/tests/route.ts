import { requireCompany } from "@/lib/saas/auth";
import { readAll } from "@/lib/saas/read-all";
import { saasDb } from "@/lib/saas/db";
import { localToday } from "@/lib/saas/status";
import { csvText, csvResponse } from "../csv";
import { TESTS_HEADER, testHistoryRows, type UploadRec, type ItemRec } from "../rows";

/**
 * Test history as a spreadsheet: every cert photo ever sent in, not just the
 * test on file now. A retest replaces a piece's dates, so this is where last
 * year's BOP test still shows, with who sent it in, who checked it, and a
 * link to the photo. What an operator's auditor asks for.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [uploads, items, pieces, { data: units }] = await Promise.all([
    readAll<UploadRec>((a, b) => db.from("saas_cert_uploads")
      .select("id, item_id, created_at, uploaded_by_name, evidence, claimed_issued, claimed_expiration, pending_until, verdict, status, applied_at, reviewed_by_name, reviewed_at, review_note", { count: "exact" })
      .eq("company_id", company.id).order("created_at", { ascending: false }).order("id").range(a, b)),
    readAll<ItemRec>((a, b) => db.from("saas_compliance_items")
      .select("id, title, parent_type, parent_id, expiration_date, last_upload_id", { count: "exact" })
      .eq("company_id", company.id).order("id").range(a, b)),
    readAll<{ id: string; name: string; identifier: string | null }>((a, b) => db.from("saas_assets")
      .select("id, name, identifier", { count: "exact" }).eq("company_id", company.id).order("id").range(a, b)),
    db.from("saas_units").select("id, name").eq("company_id", company.id),
  ]);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.synnr.io";
  const rows = testHistoryRows({
    uploads, items,
    pieces: new Map(pieces.map((p) => [p.id, { name: p.name, serial: p.identifier }])),
    trucks: new Map(((units ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name])),
    certUrl: (id) => `${origin}/api/saas/export/cert/${id}`,
  });
  return csvResponse(csvText(TESTS_HEADER, rows), `rollready-test-history-${localToday()}.csv`);
}
