import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";

/**
 * Public health endpoint — the surface the EXTERNAL dead-man pinger watches
 * (.github/workflows/heartbeat.yml). Everything inside Vercel shares Vercel's
 * fate: if their cron scheduler dies, the sweep AND the watchdog die together
 * and neither can say so. This endpoint lets something outside the blast
 * radius ask "did the sweep run?" — it returns 200 only when the last
 * saas-alerts heartbeat is fresh (< 26h) and clean.
 *
 * Deliberately public and deliberately vague: status + age only. No company
 * data, no counts, no error details — those live behind /op/health.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = saasAdmin();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "db_unconfigured" }, { status: 503 });
  }
  const { data, error } = await admin
    .from("saas_cron_runs")
    .select("ran_at, ok")
    .eq("job", "saas-alerts")
    .order("ran_at", { ascending: false })
    .limit(1);
  if (error) {
    return NextResponse.json({ ok: false, reason: "heartbeat_unreadable" }, { status: 503 });
  }
  const run = (data?.[0] ?? null) as { ran_at: string; ok: boolean } | null;
  if (!run) {
    return NextResponse.json({ ok: false, reason: "no_heartbeat_ever" }, { status: 503 });
  }
  const ageHours = (Date.now() - new Date(run.ran_at).getTime()) / 3600e3;
  if (ageHours > 26) {
    return NextResponse.json({ ok: false, reason: "heartbeat_stale", age_hours: Math.round(ageHours) }, { status: 503 });
  }
  if (!run.ok) {
    return NextResponse.json({ ok: false, reason: "last_sweep_failed" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, age_hours: Math.round(ageHours * 10) / 10 });
}
