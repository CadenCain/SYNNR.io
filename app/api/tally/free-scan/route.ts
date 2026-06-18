import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { runTally, VisionReader } from "@/lib/tally";
import { getAdminSupabase } from "@/lib/supabase/admin";

/**
 * Public "scan ONE real sheet, no signup" endpoint — the free taste of real
 * vision (lead funnel). NO auth, so it's guarded hard against cost/abuse:
 *   - per-IP daily cap (a few retries, then "start a trial")
 *   - global daily cap (a hard $ ceiling regardless of IP rotation)
 *   - the AI Gateway spend cap is the ultimate backstop on top of this.
 * A slot is reserved BEFORE the vision call, so failed reads still count and a
 * single IP can't loop the AI. Counts live in the free_scans table (admin only).
 */
const PER_IP_TOTAL = 1; // ONE free scan per visitor (by IP), ever — then it's the paid trial
const GLOBAL_PER_DAY = 250; // daily $ ceiling regardless of IP rotation (~$15/day at ~$0.06/scan)
const MAX_BYTES = 25 * 1024 * 1024;

function dayStartISO(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())).toISOString();
}

export async function POST(req: Request) {
  const admin = getAdminSupabase();
  if (!admin) return NextResponse.json({ ok: false, error: "Free scanning is temporarily unavailable." }, { status: 503 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ ok: false, error: "no image" }, { status: 400 }); }
  const file = form.get("image");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "no image" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ ok: false, error: "Use a photo of the sheet (JPG, PNG, or HEIC)." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "That photo is over 25 MB — retake it smaller." }, { status: 400 });

  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const since = dayStartISO();

  // Cap checks BEFORE spending any AI.
  const [{ count: globalCount }, { count: ipCount }] = await Promise.all([
    admin.from("free_scans").select("id", { count: "exact", head: true }).gte("created_at", since), // global = today only
    admin.from("free_scans").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash),    // per-IP = all-time (one free scan, ever)
  ]);
  if ((globalCount ?? 0) >= GLOBAL_PER_DAY) {
    return NextResponse.json({ ok: false, capped: true, error: "Free scanning is at capacity today — start a free trial to keep going." }, { status: 429 });
  }
  if ((ipCount ?? 0) >= PER_IP_TOTAL) {
    return NextResponse.json({ ok: false, capped: true, error: "That's your one free scan. Start a 14-day free trial to scan all you want." }, { status: 429 });
  }

  // Reserve the slot (counts the attempt, so a bad-photo loop can't burn the AI).
  await admin.from("free_scans").insert({ ip_hash: ipHash } as never);

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const result = await runTally(new VisionReader({ image: bytes, mediaType: file.type }));
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, needsCard: true, error: e instanceof Error ? e.message : "vision unavailable" },
      { status: 503 }
    );
  }
}
