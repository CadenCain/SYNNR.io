import { NextResponse } from "next/server";
import { runTally, runTallySample, SampleReader, VisionReader } from "@/lib/tally";
import { requireProductApi } from "@/lib/marketplace/access";

/**
 * Run the TallyShot pipeline on an uploaded sheet (or the cardless sample).
 * Gated server-side: only seat-holders of an org subscribed to TallyShot.
 *
 * Body:
 *  - JSON { sample: true }            → cardless deterministic demo (no card)
 *  - multipart form-data "image"      → real vision read (needs AI Gateway card)
 */
export async function POST(req: Request) {
  const gate = await requireProductApi("tallyshot");
  if (!gate.ok) return NextResponse.json({ ok: false, error: gate.reason }, { status: gate.status });

  const ctype = req.headers.get("content-type") || "";

  // cardless sample path
  if (ctype.includes("application/json")) {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* */ }
    if (body.sample) {
      const result = await runTallySample();
      return NextResponse.json({ ok: true, result });
    }
    return NextResponse.json({ ok: false, error: "send { sample: true } or upload an image" }, { status: 400 });
  }

  // real photo path
  if (ctype.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "no image" }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      const result = await runTally(new VisionReader({ image: bytes, mediaType: file.type }));
      return NextResponse.json({ ok: true, result });
    } catch (e) {
      // Vision not wired yet → tell the client to use the sample, don't 500.
      return NextResponse.json(
        { ok: false, needsCard: true, error: e instanceof Error ? e.message : "vision unavailable" },
        { status: 503 }
      );
    }
  }

  // default: cardless sample so the screen is never dead
  const result = await runTally(new SampleReader());
  return NextResponse.json({ ok: true, result });
}
