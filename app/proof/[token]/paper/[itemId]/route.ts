import { saasAdmin } from "@/lib/saas/db";
import { DEMO_PAPER } from "@/lib/saas/paper";
import { loadProof, itemInProofScope } from "../../load-proof";

/**
 * "See the cert" on a truck, yard, or company proof link. Opens a test's
 * current paper only while the link is on and only for a test the link
 * shows. Signs a fresh short link every tap, so a tab left open all morning
 * still opens the cert.
 */
export const dynamic = "force-dynamic";

const nope = (status = 404) => new Response(status === 410 ? "The shop shut this link off." : "Not found", { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const admin = saasAdmin();
  if (!admin || !/^[a-f0-9]{16,64}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(itemId)) return nope();
  const proof = await loadProof(admin, token);
  if (typeof proof === "string") return nope(proof === "not valid" ? 404 : 410);
  const { data: itemRow } = await admin.from("saas_compliance_items").select("id, parent_type, parent_id, last_upload_id")
    .eq("id", itemId).eq("company_id", proof.company_id).maybeSingle();
  const item = itemRow as { id: string; parent_type: string; parent_id: string; last_upload_id: string | null } | null;
  if (!item?.last_upload_id || !(await itemInProofScope(admin, proof, item))) return nope();
  const { data: up } = await admin.from("saas_cert_uploads").select("storage_path")
    .eq("id", item.last_upload_id).eq("item_id", item.id).maybeSingle();
  const path = (up as { storage_path: string } | null)?.storage_path;
  if (!path) return nope();
  const to = path.startsWith(DEMO_PAPER) ? new URL(`/demo-cert/${item.id}`, req.url).toString()
    : (await admin.storage.from("proofs").createSignedUrl(path, 300)).data?.signedUrl;
  if (!to) return nope();
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
}
