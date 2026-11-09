import { saasAdmin } from "@/lib/saas/db";
import { DEMO_PAPER, recordPaperUploads } from "@/lib/saas/paper";
import { loadPublicRecord } from "../../load-record";

/**
 * "See the cert" on a load-out link. Opens the paper only while the link is
 * on, and only paper that record stands on. Signs a fresh short link every
 * tap, so a tab left open all morning still opens the cert.
 */
export const dynamic = "force-dynamic";

const nope = (status = 404) => new Response(status === 410 ? "The shop shut this link off." : "Not found", { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ token: string; uploadId: string }> }) {
  const { token, uploadId } = await params;
  const admin = saasAdmin();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(uploadId)) return nope();
  const got = await loadPublicRecord(admin, token);
  if (got === "off") return nope(410);
  if (!got) return nope();
  const { rec } = got;
  const allowed = await recordPaperUploads(admin, rec.company_id, rec.pieces);
  if (!allowed.some((w) => w.upload.toLowerCase() === uploadId.toLowerCase())) return nope();
  const { data: up } = await admin.from("saas_cert_uploads").select("item_id, storage_path")
    .eq("id", uploadId).eq("company_id", rec.company_id).maybeSingle();
  const u = up as { item_id: string; storage_path: string } | null;
  if (!u) return nope();
  const to = u.storage_path.startsWith(DEMO_PAPER) ? new URL(`/demo-cert/${u.item_id}`, req.url).toString()
    : (await admin.storage.from("proofs").createSignedUrl(u.storage_path, 300)).data?.signedUrl;
  if (!to) return nope();
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
}
