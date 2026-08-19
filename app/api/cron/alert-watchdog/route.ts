import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { sendEmail } from "@/lib/saas/notify";
import { logCronRun } from "@/lib/saas/cron-log";

/**
 * THE DEAD-MAN'S SWITCH.
 *
 * The alert sweep can email the operator about its own errors — but a sweep
 * that never RUNS can't report anything. This watchdog fires two hours after
 * the sweep's slot and checks the heartbeat table for today's run. No run, or
 * a failed run → the owner gets a screaming email. The failure mode it can't
 * cover is Vercel cron being down platform-wide (both jobs share that fate);
 * that residual risk needs an external pinger, which is an account the owner
 * has to create — flagged in the ops docs, not silently assumed.
 *
 * Deliberately dumb: one read, one comparison, one email. The more moving
 * parts a watchdog has, the more ways IT fails.
 */
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

  const OWNER = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";

  // The sweep runs at 11:30 UTC. Look for any heartbeat since 10:00 UTC today —
  // wide enough for retries and clock drift, tight enough that yesterday's
  // run can never satisfy today's check.
  const windowStart = new Date();
  windowStart.setUTCHours(10, 0, 0, 0);

  const { data, error } = await admin
    .from("saas_cron_runs")
    .select("ran_at, ok, alerts_sent, errors, detail")
    .eq("job", "saas-alerts")
    .gte("ran_at", windowStart.toISOString())
    .order("ran_at", { ascending: false })
    .limit(1);

  type Run = { ran_at: string; ok: boolean; alerts_sent: number; errors: number; detail: string | null };
  const run = (data?.[0] ?? null) as Run | null;

  let verdict: "ok" | "no_run" | "failed_run" | "check_error";
  if (error) verdict = "check_error";
  else if (!run) verdict = "no_run";
  else if (!run.ok || run.errors > 0) verdict = "failed_run";
  else verdict = "ok";

  if (verdict !== "ok") {
    const subject =
      verdict === "no_run" ? "[SYNNR ops] DEAD MAN'S SWITCH — the alert sweep DID NOT RUN today"
      : verdict === "failed_run" ? "[SYNNR ops] alert sweep ran WITH FAILURES today"
      : "[SYNNR ops] watchdog could not read the heartbeat table";
    const body =
      verdict === "no_run"
        ? "No heartbeat since 10:00 UTC. No customer received an expiration warning today.\n\nCheck Vercel → Crons and /op/health. Every day this stays down is a day a cert can lapse unannounced."
        : verdict === "failed_run"
        ? `The sweep ran at ${run!.ran_at} but reported ${run!.errors} error(s).\n\n${run!.detail ?? ""}\n\nFailed sends retry tomorrow — unless the cause doesn't fix itself. Check /op/health.`
        : `The watchdog's own read failed: ${error!.message}\n\nThe sweep may be fine — but nothing can currently prove it. Check Supabase.`;
    // If THIS email fails there is genuinely nothing left to do from in here —
    // it still shows red on /op/health and in the watchdog's own heartbeat.
    await sendEmail([OWNER], subject, `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${body}</pre>`).catch(() => {});
  }

  await logCronRun(admin, {
    job: "alert-watchdog",
    ok: verdict === "ok",
    detail: verdict === "ok" ? null : verdict,
  });

  return NextResponse.json({ ok: verdict === "ok", verdict, last_run: run?.ran_at ?? null });
}

export const POST = GET;
