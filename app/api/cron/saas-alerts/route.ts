import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { sweepAlerts } from "@/lib/saas/alerts";
import { snapshotAllCompanies } from "@/lib/saas/readiness";

// Daily SaaS expiration-alert sweep. Vercel Cron sends Bearer CRON_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 });
    if ((req.headers.get("authorization") || "") !== `Bearer ${secret}`)
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const admin = saasAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "db not configured" }, { status: 500 });
  try {
    const result = await sweepAlerts(admin);
    const snapshot = await snapshotAllCompanies(admin); // daily KPI history (real sparklines)
    return NextResponse.json({ ok: true, ...result, snapshot });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const POST = GET;
