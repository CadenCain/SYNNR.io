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
 * is re-seeded so it doesn't age. Rented gear: each company's managers get
 * the list of what's still out. Any failure emails the operator; none of it
 * changes a paying company's data.
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

  // Rented gear still out: a company's managers hear about it every morning until there's a photo of it back.
  let rented = { companies: 0, sent: 0, errors: [] as string[] };
  try {
    const { sendRentedOut } = await import("@/lib/saas/rented-email");
    rented = await sendRentedOut(admin, Date.now());
    if (rented.errors.length) await sendEmail([OWNER], "[SYNNR ops] rented gear email hit errors", pre(rented.errors.join("\n"))).catch(() => {});
  } catch (e) {
    rented.errors.push(e instanceof Error ? e.message : String(e));
    await sendEmail([OWNER], "[SYNNR ops] rented gear email CRASHED", pre(e instanceof Error ? e.message : String(e))).catch(() => {});
  }

  await logCronRun(admin, {
    job: "daily",
    ok: billing.drift === 0 && billing.errors === 0 && rented.errors.length === 0,
    alerts_sent: rented.sent,
    detail: [billing.drift ? `billing drift x${billing.drift}` : null, billing.errors ? `billing check errors x${billing.errors}` : null,
      demo.deleted ? `demo deleted x${demo.deleted}` : null, rented.sent ? `rented gear email x${rented.sent}` : null,
      rented.errors.length ? `rented gear email errors x${rented.errors.length}` : null].filter(Boolean).join(", ") || null,
  });
  return NextResponse.json({ ok: true, billing, demo: demo.deleted, rented: rented.sent });
}

export const POST = GET;
