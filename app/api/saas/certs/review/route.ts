import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { applyUpload, rejectUpload } from "@/lib/saas/cert-upload";
import { isManagerRole } from "@/lib/saas/yard-rules";
import { certCaller } from "../_auth";

/** A manager says yes or no to an upload that's waiting on them. */
export async function POST(req: Request) {
  const caller = await certCaller();
  if (!caller.ok) return NextResponse.json({ ok: false, message: caller.error }, { status: caller.status });
  const { user, company, name } = caller;
  if (!isManagerRole(company.role)) return NextResponse.json({ ok: false, message: "Only a manager can approve or turn down an upload." }, { status: 403 });
  const admin = saasAdmin();
  if (!admin) return NextResponse.json({ ok: false, message: "Something's down on our end. Try again in a minute." }, { status: 503 });

  let body: { upload_id?: string; action?: string; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 }); }
  const uploadId = String(body.upload_id ?? "");
  const note = String(body.note ?? "").trim().slice(0, 300);
  if (!uploadId) return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });

  if (body.action === "approve") {
    const r = await applyUpload(admin, company.id, uploadId, { userId: user.id, name, note: note || null });
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }
  if (body.action === "reject") {
    if (!note) return NextResponse.json({ ok: false, message: "Say why, so the hand knows what to fix." }, { status: 400 });
    const r = await rejectUpload(admin, company.id, uploadId, { userId: user.id, name, note });
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  }
  return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
}
