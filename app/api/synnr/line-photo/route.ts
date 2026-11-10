import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireWritableCompany } from "@/lib/saas/auth";
import { saasAdmin, saasDb } from "@/lib/saas/db";
import { PHOTO_TYPES, PROOFS, photoPath, removePhotos, signPhotos } from "@/lib/saas/job-photos";

/**
 * Put a piece on the truck with its proof: the photo is saved, then the line
 * is marked on with who and when, in that order. The database only lets the
 * server attach a photo, and won't let a critical piece go on without one,
 * so this route is the only way a critical piece ever reads as loaded.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
  const got = await requireWritableCompany();
  if (!got.ok) return no(got.error, 403);
  const { company, user } = got;

  let form: FormData;
  try { form = await req.formData(); } catch { return no("That didn't send. Try again.", 400); }
  const lineId = String(form.get("line") ?? "");
  const photo = form.get("photo");
  if (!/^[0-9a-f-]{36}$/i.test(lineId)) return no("That line isn't there anymore.", 400);
  if (!(photo instanceof File) || photo.size === 0) return no("Take the photo first.", 400);
  if (!PHOTO_TYPES.includes(photo.type)) return no("That isn't a photo SYNNR can keep. Use the camera.", 415);
  if (photo.size > MAX_BYTES) return no("That photo is too big. Take it again.", 413);

  // Read as the signed-in person: the database decides whether this line is theirs to see.
  const db = await saasDb();
  const { data: found } = await db.from("synnr_job_lines").select("id, job_id, photo_path").eq("id", lineId).eq("company_id", company.id).maybeSingle();
  const line = found as { id: string; job_id: string; photo_path: string | null } | null;
  if (!line) return no("That line isn't there anymore.", 404);

  const admin = saasAdmin();
  if (!admin) return no("Photos aren't set up. Call or text 432-250-0715.", 500);

  const path = photoPath(company.id, line.job_id, line.id, photo.type);
  const { error: upErr } = await admin.storage.from(PROOFS).upload(path, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type, upsert: true });
  if (upErr) {
    console.error("[line-photo] upload:", upErr.message);
    return no("The photo didn't save. Check your signal and try again.", 502);
  }

  const on_by = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "Someone";
  const on_at = new Date().toISOString();
  const { data: saved, error } = await admin.from("synnr_job_lines").update({ on_at, on_by, photo_path: path })
    .eq("id", line.id).eq("company_id", company.id).select("id").maybeSingle();
  if (error || !saved) {
    console.error("[line-photo] line:", error?.message);
    await removePhotos(admin, [path]);
    return no("That didn't save. Try again.", 500);
  }
  // A retake in another format leaves the old file behind: clear it.
  if (line.photo_path && line.photo_path !== path) await removePhotos(admin, [line.photo_path]);

  revalidatePath(`/app/jobs/${line.job_id}`);
  revalidatePath("/app");
  const url = (await signPhotos(admin, [path])).get(path) ?? null;
  return NextResponse.json({ ok: true, on_at, on_by, photo_path: path, photo_url: url });
}
