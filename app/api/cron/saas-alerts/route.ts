import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { sweepAlerts } from "@/lib/saas/alerts";
import { sendEmail } from "@/lib/saas/notify";
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
  // Operator alarm: at 1 company Caden reads the cron logs; at 30 nobody
  // does. Any sweep errors — or a total crash — get emailed to the operator
  // so a batch failure is loud, not a silent morning where no shop got its
  // heads-up. (A cron that never RUNS can't self-report: that's covered by
  // Vercel's cron-failure notifications, not this.)
  const OPERATOR = process.env.NOTIFY_EMAIL || "cadencain@synnr.io";
  try {
    const result = await sweepAlerts(admin);
    const snapshot = await snapshotAllCompanies(admin); // daily KPI history (real sparklines)
    if (result.errors.length > 0) {
      await sendEmail([OPERATOR], `[SYNNR ops] alert sweep: ${result.errors.length} delivery failure(s)`,
        `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">Sweep ran but some sends failed:\n\n${result.errors.map((x) => `• ${x}`).join("\n")}\n\nScanned ${result.companies_scanned} companies · ${result.emails_sent} emails · ${result.sms_sent} SMS sent.\nFailed items retry on tomorrow's sweep.</pre>`);
    }
    return NextResponse.json({ ok: true, ...result, snapshot });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // The whole sweep died — every company's alerts skipped today. Scream.
    await sendEmail([OPERATOR], "[SYNNR ops] ALERT SWEEP CRASHED — no alerts went out",
      `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">The daily sweep threw before completing:\n\n${msg}\n\nNo company received expiration alerts today. Investigate before tomorrow's run.</pre>`).catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const POST = GET;
