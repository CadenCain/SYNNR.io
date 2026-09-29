import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { ownsParent } from "@/lib/saas/own";
import { processUpload } from "@/lib/saas/cert-upload";
import { isManagerRole, type Role } from "@/lib/saas/yard-rules";
import { normalizeDateField } from "@/lib/saas/import-parse";
import { certCaller } from "../_auth";

// Reading a photo takes a few seconds; give it room.
export const maxDuration = 60;

/**
 * Upload a photo of a cert. Three ways in:
 *   item_id + photo                  renew an existing item
 *   parent_type + parent_id + title  add a new item from its cert photo
 *   item_id + doc_request_id         a manager uses the photo a hand sent
 *                                    through their update link
 * The server reads the photo and decides; see lib/saas/cert-upload.ts.
 */
export async function POST(req: Request) {
  const caller = await certCaller();
  if (!caller.ok) return NextResponse.json({ ok: false, outcome: "rejected", message: caller.error }, { status: caller.status });
  const { user, company, name } = caller;
  const admin = saasAdmin();
  if (!admin) return NextResponse.json({ ok: false, outcome: "rejected", message: "Something's down on our end. Try again in a minute." }, { status: 503 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, outcome: "rejected", message: "The photo didn't come through. Try again." }, { status: 400 }); }
  const str = (k: string) => String(form.get(k) ?? "").trim();

  const evidence = str("evidence") === "temporary" ? "temporary" : "cert";
  let claimedExpiration: string | null = null, claimedIssued: string | null = null;
  try {
    claimedExpiration = normalizeDateField(str("expiration"), "Expiration");
    claimedIssued = normalizeDateField(str("issued"), "Test date");
  } catch (e) {
    return NextResponse.json({ ok: false, outcome: "rejected", message: e instanceof Error ? e.message : "Check the date." }, { status: 400 });
  }

  // The photo: fresh from the phone, or one a hand already sent in.
  let photo: { bytes: Buffer; contentType: string } | { storagePath: string };
  let docRequestId: string | null = null;
  if (str("doc_request_id")) {
    if (!isManagerRole(company.role)) return NextResponse.json({ ok: false, outcome: "rejected", message: "Only a manager can use a photo a hand sent in." }, { status: 403 });
    docRequestId = str("doc_request_id");
    const { data: dr } = await admin.from("saas_doc_requests").select("id, status, file_path")
      .eq("id", docRequestId).eq("company_id", company.id).maybeSingle();
    const req = dr as { id: string; status: string; file_path: string | null } | null;
    if (!req || req.status !== "submitted" || !req.file_path) {
      return NextResponse.json({ ok: false, outcome: "rejected", message: "That photo was already handled." }, { status: 409 });
    }
    photo = { storagePath: req.file_path };
  } else {
    const file = form.get("photo");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, outcome: "rejected", message: "Take a photo of the cert first." }, { status: 400 });
    photo = { bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type || "image/jpeg" };
  }

  // Which item. A new one is created with no dates; the photo supplies them.
  let itemId = str("item_id");
  let createdItemId: string | null = null;
  if (!itemId) {
    const parentType = str("parent_type"), parentId = str("parent_id"), title = str("title").slice(0, 120);
    const kind = str("kind") || "cert";
    if (!title) return NextResponse.json({ ok: false, outcome: "rejected", message: "Name the cert first (for example, H2S Clear)." }, { status: 400 });
    if (!["unit", "asset", "crew"].includes(parentType) || !(await ownsParent(admin, company.id, parentType, parentId))) {
      return NextResponse.json({ ok: false, outcome: "rejected", message: "That truck, gear, or hand isn't in your yard." }, { status: 404 });
    }
    const { data: created, error } = await admin.from("saas_compliance_items")
      .insert({ company_id: company.id, parent_type: parentType, parent_id: parentId, title, kind })
      .select("id").single();
    if (error || !created) return NextResponse.json({ ok: false, outcome: "rejected", message: "Couldn't add that. Try again." }, { status: 500 });
    itemId = createdItemId = (created as { id: string }).id;
  }

  const result = await processUpload({
    admin, company, itemId, evidence, claimedExpiration, claimedIssued,
    force: str("force") === "1",
    actor: { userId: user.id, name, role: company.role as Role },
    photo,
  });

  // A brand-new item whose photo was refused never existed.
  if (!result.ok && createdItemId) {
    await admin.from("saas_compliance_items").delete().eq("id", createdItemId).eq("company_id", company.id);
  }
  if (result.ok && docRequestId) {
    await admin.from("saas_doc_requests").update({ status: "done" }).eq("id", docRequestId).eq("company_id", company.id);
  }
  return NextResponse.json({ ...result, itemId: result.ok ? itemId : null });
}
