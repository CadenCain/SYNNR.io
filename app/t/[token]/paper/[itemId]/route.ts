import { saasAdmin } from "@/lib/saas/db";
import { DEMO_PAPER } from "@/lib/saas/paper";
import { judgeItem } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";

/**
 * "See the cert" on a QR tag page. Opens the paper of one test on the piece
 * that tag is on, nothing else. Signs a fresh short link every tap, so a tab
 * the company man left open all morning still opens the cert.
 *
 *   /t/<token>/paper/<itemId>          the test's current cert
 *   /t/<token>/paper/<itemId>?retest=1 the retest paper a manager approved,
 *                                      while the test reads "cert on the way"
 */
export const dynamic = "force-dynamic";

const nope = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const admin = saasAdmin();
  if (!admin || !/^[a-f0-9]{16,64}$/.test(token) || !/^[0-9a-f-]{36}$/i.test(itemId)) return nope();

  const { data: assetRow } = await admin.from("saas_assets").select("id, company_id").eq("tag_token", token).maybeSingle();
  const a = assetRow as { id: string; company_id: string } | null;
  if (!a) return nope();

  // The test has to be on this piece, in this piece's company.
  const { data: itemRow } = await admin.from("saas_compliance_items")
    .select("id, title, issued_date, expiration_date, reminder_days, pending_until, last_upload_id")
    .eq("id", itemId).eq("company_id", a.company_id).eq("parent_type", "asset").eq("parent_id", a.id).maybeSingle();
  const item = itemRow as { id: string; title: string; issued_date: string | null; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null } | null;
  if (!item) return nope();

  let path: string | undefined;
  if (new URL(req.url).searchParams.get("retest")) {
    // Only while the tag page shows it: retested, cert on the way.
    const today = localToday();
    if (judgeItem(item, today, today).result !== "pending") return nope();
    const { data: rows } = await admin.from("saas_cert_uploads").select("storage_path, applied_at")
      .eq("company_id", a.company_id).eq("item_id", item.id).eq("evidence", "temporary").eq("status", "applied")
      .order("applied_at", { ascending: false }).limit(20);
    path = ((rows ?? []) as { storage_path: string }[]).find((r) => !r.storage_path.startsWith(DEMO_PAPER))?.storage_path;
    if (!path) return nope();
  } else {
    if (!item.last_upload_id) return nope();
    const { data: up } = await admin.from("saas_cert_uploads").select("storage_path")
      .eq("id", item.last_upload_id).eq("item_id", item.id).eq("company_id", a.company_id).maybeSingle();
    path = (up as { storage_path: string } | null)?.storage_path;
    if (!path) return nope();
  }

  const to = path.startsWith(DEMO_PAPER) ? new URL(`/demo-cert/${item.id}`, req.url).toString()
    : (await admin.storage.from("proofs").createSignedUrl(path, 300)).data?.signedUrl;
  if (!to) return nope();
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
}
