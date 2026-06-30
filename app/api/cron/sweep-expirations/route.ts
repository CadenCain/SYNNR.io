import { NextResponse } from "next/server";
import { getReadinessDb } from "@/lib/readiness/db";
import { sweepExpirations } from "@/lib/readiness/sweep";

/**
 * Daily cert-expiration sweep. Wire into Vercel Cron via vercel.json with
 * a daily schedule. Vercel sets `Authorization: Bearer <CRON_SECRET>` on the
 * request — we verify it so this endpoint can't be poked from outside.
 *
 * Also callable manually from the operator console (passes the secret too)
 * for "run it now" testing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Fail-closed: in production, CRON_SECRET must be set AND must match.
  // In local dev (NODE_ENV !== 'production'), skip the check so manual hits work.
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
    }
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const db = getReadinessDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "db not configured" }, { status: 500 });
  }

  try {
    const result = await sweepExpirations(db);
    // Log a single sweep entry so we can audit when the cron last ran.
    await db.from("rd_audit_log").insert({
      actor: "cron",
      action: "sweep.expirations",
      payload: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// POST works too (Vercel Cron supports either; some tooling prefers POST).
export const POST = GET;
