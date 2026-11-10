import { NextResponse } from "next/server";
import { requireWritableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { aiReady, readDispatch } from "@/lib/saas/read-dispatch";

/**
 * Read a dispatch: a photo or PDF of the dispatch screen, or the job in the hand's
 * own words. Returns job facts and what the dispatch itself says to bring.
 * The file is read and thrown away; it is never stored.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;
type FileType = (typeof TYPES)[number];
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const no = (error: string, status: number, code?: string) => NextResponse.json({ ok: false, error, code }, { status });
  const got = await requireWritableCompany();
  if (!got.ok) return no(got.error, 403);
  // The demo is open to anyone, and every read costs money.
  if (got.company.is_demo) return no("Reading a dispatch is off in the demo company. Type the job in.", 403, "demo");
  if (!aiReady()) return no("Reading a dispatch isn't turned on yet. Type the job in for now.", 503, "ai_off");

  let form: FormData;
  try { form = await req.formData(); } catch { return no("That didn't send. Try again.", 400); }
  const text = String(form.get("text") ?? "").trim().slice(0, 4000);
  const photo = form.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;
  if (!file && !text) return no("Add a photo or PDF of the dispatch, or say what the job is.", 400);
  if (file && !TYPES.includes(file.type as FileType)) return no("That file isn't one SYNNR can read. Use a photo (JPG or PNG) or a PDF.", 415);
  if (file && file.size > MAX_BYTES) return no("That file is too big. For a photo, take it a little farther back; for a PDF, send just the dispatch page.", 413);

  const db = await saasDb();
  const [{ data: lists }, { data: units }] = await Promise.all([
    db.from("saas_packages").select("name").eq("company_id", got.company.id).is("unit_id", null).order("name").limit(100),
    db.from("saas_units").select("name").eq("company_id", got.company.id).order("name").limit(200),
  ]);

  try {
    const read = await readDispatch({
      file: file ? { data: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: file.type as FileType } : undefined,
      text: text || undefined,
      jobLists: ((lists ?? []) as { name: string }[]).map((l) => l.name),
      trucks: ((units ?? []) as { name: string }[]).map((u) => u.name),
    });
    if (!read.is_job) return no("That doesn't look like a job. Send the dispatch screen, or say what you're running.", 422, "not_job");
    return NextResponse.json({ ok: true, read });
  } catch (e) {
    console.error("[read-dispatch]", e instanceof Error ? e.message : e);
    // Our own plain-words errors pass through; anything else is a quiet failure.
    const mine = e instanceof Error && /^(SYNNR couldn't|That dispatch)/.test(e.message);
    return no(mine ? (e as Error).message : "SYNNR couldn't read that right now. Type the job in instead.", 502);
  }
}
