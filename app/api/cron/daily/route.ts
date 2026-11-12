import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { sendEmail } from "@/lib/saas/notify";
import { escHtml } from "@/lib/saas/html";
import { logCronRun } from "@/lib/saas/cron-log";
import { reconcileYardBilling } from "@/lib/saas/billing";

/**
 * Once a day, housekeeping. Billing: what Stripe bills against what the
 * company has, an email to the operator on any drift. Demo: throwaway demo
 * companies (and their users) are deleted after 24 hours, and the showcase
 * is re-seeded so it doesn't age. Any failure emails the operator; none of
 * it touches a paying company's data.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pre = (s: string) => `<pre style="font:13px/1.6 monospace;white-space:pre-wrap">${escHtml(s)}</pre>`;

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

  // Billing: the per-change Stripe sync is best effort, so drift is possible.
  let billing = { drift: 0, checked: 0, errors: 0 };
  try {
    const rec = await reconcileYardBilling();
    billing = { drift: rec.issues.length, checked: rec.checked, errors: rec.errors.length };
    if (rec.issues.length || rec.errors.length) {
      await sendEmail([OWNER], `[SYNNR ops] BILLING DRIFT: ${rec.issues.length} issue(s)`, pre(
        `Nightly billed-vs-actual check (${rec.checked} subscription(s)):\n\n${rec.issues.map((d) => `• ${d}`).join("\n") || "(no drift, but errors below)"}\n\n` +
        (rec.errors.length ? `Couldn't check:\n${rec.errors.map((e) => `• ${e}`).join("\n")}\n\n` : "") +
        "Fix: open the company in Stripe and set the quantity.")).catch(() => {});
    }
  } catch (e) {
    await sendEmail([OWNER], "[SYNNR ops] billing check CRASHED", pre(e instanceof Error ? e.message : String(e))).catch(() => {});
  }

  // Demo companies live 24 hours. Stale demo data is untidy, not an outage.
  let demo = { deleted: 0, errors: [] as string[] };
  try {
    const { cleanupDemoCompanies, refreshShowcase } = await import("@/lib/saas/demo-seed");
    demo = await cleanupDemoCompanies(admin);
    if (demo.errors.length) await sendEmail([OWNER], "[SYNNR ops] demo cleanup hit errors", pre(demo.errors.join("\n"))).catch(() => {});
    const r = await refreshShowcase(admin);
    if (!r.ok) await sendEmail([OWNER], "[SYNNR ops] showcase refresh failed", pre(r.error ?? "unknown")).catch(() => {});
  } catch (e) {
    await sendEmail([OWNER], "[SYNNR ops] demo cleanup CRASHED", pre(e instanceof Error ? e.message : String(e))).catch(() => {});
  }

  await logCronRun(admin, {
    job: "daily",
    ok: billing.drift === 0 && billing.errors === 0,
    detail: [billing.drift ? `billing drift x${billing.drift}` : null, billing.errors ? `billing check errors x${billing.errors}` : null,
      demo.deleted ? `demo deleted x${demo.deleted}` : null].filter(Boolean).join(", ") || null,
  });
  return NextResponse.json({ ok: true, billing, demo: demo.deleted });
}

export const POST = GET;
