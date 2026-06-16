import { NextResponse } from "next/server";
import { runTallySample } from "@/lib/tally";

/**
 * PUBLIC TallyShot demo — runs the cardless sample tally pipeline. No auth, no
 * card (the gated /api/tally is for real seat-holders). Sample only.
 */
export async function POST() {
  const result = await runTallySample();
  return NextResponse.json({ ok: true, result });
}
