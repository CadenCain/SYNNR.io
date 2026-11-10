import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { ownsStoragePath } from "@/lib/saas/own";
import { DEMO_PAPER } from "@/lib/saas/paper";
import { isCrewCardPhoto } from "../../rows";

/**
 * The cert photo behind one line of the test history spreadsheet. The link
 * in the file stays the same; it opens the photo for someone signed in to
 * the company that owns it (a short-lived link to the file each time), and
 * nobody else. Iron and truck paper only, like the spreadsheet: a crew
 * card's photo doesn't open here.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const { company } = await requireCompany();
  const nope = () => new Response("That cert photo isn't in your account.", { status: 404 });
  if (!UUID.test(uploadId)) return nope();
  const db = await saasDb();
  const { data } = await db.from("saas_cert_uploads").select("id, item_id, storage_path")
    .eq("id", uploadId).eq("company_id", company.id).maybeSingle();
  const up = data as { id: string; item_id: string | null; storage_path: string } | null;
  if (!up) return nope();
  if (isCrewCardPhoto(up.storage_path)) return nope();
  if (up.item_id) {
    const { data: it } = await db.from("saas_compliance_items").select("parent_type")
      .eq("id", up.item_id).eq("company_id", company.id).maybeSingle();
    if (!it || (it as { parent_type: string }).parent_type === "crew") return nope();
  }
  // A demo yard's sample paper is drawn, not stored.
  if (up.storage_path.startsWith(DEMO_PAPER)) return up.item_id ? NextResponse.redirect(new URL(`/demo-cert/${up.item_id}`, req.url)) : nope();
  if (!ownsStoragePath(up.storage_path, company.id)) return nope();
  const { data: signed } = await db.storage.from("proofs").createSignedUrl(up.storage_path, 300);
  if (!signed?.signedUrl) return new Response("Couldn't open the photo. Try again.", { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
