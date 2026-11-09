import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { sweepAlerts } from "@/lib/saas/alerts";
import { sendEmail } from "@/lib/saas/notify";
import { escHtml } from "@/lib/saas/html";
import { snapshotAllCompanies } from "@/lib/saas/readiness";
import { logCronRun } from "@/lib/saas/cron-log";
import { sendMorningSummaries } from "@/lib/saas/morning-summary";
import { isMorningRunHour } from "@/lib/saas/alert-window";

// Daily SaaS expiration-alert sweep. Vercel Cron sends Bearer CRON_SECRET.
// vercel.json fires it at 09:00 and 10:00 UTC; only the one that is 4 AM in
// the yard runs (alert-window.ts isMorningRunHour), once a day. ?force=1 (with
// the secret in production) runs it now, for a re-run after a crash.
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
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force) {
    // The other UTC hour: not 4 AM in the yard. No heartbeat, so it can't
    // cover for the real run.
    if (!isMorningRunHour()) return NextResponse.json({ ok: true, skipped: "not the morning run hour in the yard" });
    // Already ran today (a repeat delivery of the same cron): never send the
    // morning email twice.
    const { data: ran } = await admin.from("saas_cron_runs").select("ran_at").eq("job", "saas-alerts")
      .gte("ran_at", new Date(Date.now() - 20 * 3600e3).toISOString()).limit(1);
    if ((ran ?? []).length) return NextResponse.json({ ok: true, skipped: "already ran today" });
  }
  // Operator alarm: at 1 company Caden reads the cron logs; at 30 nobody
  // does. Any sweep errors — or a total crash — get emailed to the operator
  // so a batch failure is loud, not a silent morning where no shop got its
  // heads-up. Separately, every run leaves a heartbeat row so a cron that
  // stopped firing is distinguishable from a quiet day with nothing due.
  const OPERATOR = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
  try {
    const result = await sweepAlerts(admin);
    const snapshot = await snapshotAllCompanies(admin); // daily KPI history (real sparklines)
    await logCronRun(admin, {
      job: "saas-alerts",
      ok: result.errors.length === 0,
      companies_scanned: result.companies_scanned,
      alerts_sent: result.emails_sent + result.sms_sent,
      errors: result.errors.length,
      detail: result.errors.length > 0 ? result.errors.join(" | ") : null,
    });
    if (result.errors.length > 0) {
      await sendEmail([OPERATOR], `[SYNNR ops] alert sweep: ${result.errors.length} delivery failure(s)`,
        `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${escHtml(`Sweep ran but some sends failed:\n\n${result.errors.map((x) => `• ${x}`).join("\n")}\n\nScanned ${result.companies_scanned} companies · ${result.emails_sent} emails · ${result.sms_sent} SMS sent.\nFailed items retry on tomorrow's sweep.`)}</pre>`);
    }
    // The managers' morning email: what happened, and where the app wasn't used.
    let morning: Awaited<ReturnType<typeof sendMorningSummaries>> | { error: string };
    try {
      morning = await sendMorningSummaries(admin);
      if (morning.errors.length) {
        await sendEmail([OPERATOR], `[SYNNR ops] morning summary: ${morning.errors.length} problem(s)`,
          `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${escHtml(morning.errors.map((x) => `• ${x}`).join("\n"))}</pre>`);
      }
    } catch (e) {
      morning = { error: e instanceof Error ? e.message : String(e) };
      await sendEmail([OPERATOR], "[SYNNR ops] morning summary CRASHED", `<pre style="font:13px/1.6 monospace">${escHtml(morning.error)}</pre>`).catch(() => {});
    }
    return NextResponse.json({ ok: true, ...result, snapshot, morning });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logCronRun(admin, { job: "saas-alerts", ok: false, detail: msg });
    // The whole sweep died — every company's alerts skipped today. Scream.
    await sendEmail([OPERATOR], "[SYNNR ops] ALERT SWEEP CRASHED — no alerts went out",
      `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${escHtml(`The daily sweep threw before completing:\n\n${msg}\n\nNo company received expiration alerts today. Investigate before tomorrow's run.`)}</pre>`).catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const POST = GET;
