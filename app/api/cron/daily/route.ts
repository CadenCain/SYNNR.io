import { NextResponse } from "next/server";
import { saasAdmin } from "@/lib/saas/db";
import { sendEmail } from "@/lib/saas/notify";
import { escHtml } from "@/lib/saas/html";
import { logCronRun } from "@/lib/saas/cron-log";
import { reconcileYardBilling } from "@/lib/saas/billing";

/**
 * Once a day. First, after the job: each company's managers get the trucks
 * that went out and have no photo of the gear put away. Then housekeeping.
 * Missed leads: access requests that were saved but never emailed go to the
 * operator. Billing: what Stripe bills against what the company has, an
 * email to the operator on any drift. Demo: throwaway demo companies (and
 * their users) are deleted after 24 hours. Any failure emails the operator;
 * none of it changes a paying company's data.
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

  // A second delivery of the same morning's run mustn't email anyone twice.
  const { data: earlier } = await admin.from("saas_cron_runs").select("id").eq("job", "daily").gte("ran_at", new Date(Date.now() - 12 * 3600e3).toISOString()).limit(1);
  const again = Boolean(earlier?.length);

  // After the job: a company's managers hear each morning which trucks went
  // out and have no photo of the gear put away. This is the one thing in
  // here a customer is waiting on, so it goes first: nothing below can run
  // long enough to cost them their email.
  let owed = { companies: 0, sent: 0, errors: [] as string[] };
  if (!again) {
    try {
      const { sendAfterOwed } = await import("@/lib/saas/after-email");
      owed = await sendAfterOwed(admin, Date.now());
      if (owed.errors.length) await sendEmail([OWNER], "[SYNNR ops] after-the-job email hit errors", pre(owed.errors.join("\n"))).catch(() => {});
    } catch (e) {
      owed.errors.push(e instanceof Error ? e.message : String(e));
      await sendEmail([OWNER], "[SYNNR ops] after-the-job email CRASHED", pre(e instanceof Error ? e.message : String(e))).catch(() => {});
    }
  }

  // Requests for access that were saved but never reached the inbox (the
  // email failed, the hourly cap was hit, or the spam trap caught it). A
  // lead is never lost quietly: the operator gets them here.
  let leads = 0;
  if (!again) {
    try {
      const { data: missed } = await admin.from("audit_requests").select("id, name, company, phone, service_type, source, created_at")
        .eq("emailed", false).gte("created_at", new Date(Date.now() - 14 * 86400e3).toISOString()).order("created_at").limit(50);
      const rows = (missed ?? []) as { id: string; name: string | null; company: string | null; phone: string | null; service_type: string | null; source: string | null; created_at: string }[];
      if (rows.length) {
        const line = (r: (typeof rows)[number]) => `• ${r.name ?? "?"}, ${r.company ?? "?"}, ${r.phone ?? "no number"}${r.service_type ? ` (${r.service_type})` : ""}${r.source === "access_trap" ? "  [caught by the spam trap: probably a bot]" : ""}`;
        const ok = await sendEmail([OWNER], `[SYNNR] ${rows.length} access request${rows.length === 1 ? "" : "s"} that never reached your inbox`, pre(
          `These were saved from the homepage form but no email went out at the time:\n\n${rows.map(line).join("\n")}`));
        if (ok) {
          await admin.from("audit_requests").update({ emailed: true } as never).in("id", rows.map((r) => r.id));
          leads = rows.length;
        }
      }
    } catch (e) {
      await sendEmail([OWNER], "[SYNNR ops] missed-leads check CRASHED", pre(e instanceof Error ? e.message : String(e))).catch(() => {});
    }
  }

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
    const { cleanupDemoCompanies } = await import("@/lib/saas/demo-seed");
    demo = await cleanupDemoCompanies(admin);
    if (demo.errors.length) await sendEmail([OWNER], "[SYNNR ops] demo cleanup hit errors", pre(demo.errors.join("\n"))).catch(() => {});
  } catch (e) {
    await sendEmail([OWNER], "[SYNNR ops] demo cleanup CRASHED", pre(e instanceof Error ? e.message : String(e))).catch(() => {});
  }

  await logCronRun(admin, {
    job: "daily",
    ok: billing.drift === 0 && billing.errors === 0 && owed.errors.length === 0,
    alerts_sent: owed.sent,
    detail: [again ? "second run this morning: no emails" : null,
      billing.drift ? `billing drift x${billing.drift}` : null, billing.errors ? `billing check errors x${billing.errors}` : null,
      demo.deleted ? `demo deleted x${demo.deleted}` : null, owed.sent ? `after-the-job email x${owed.sent}` : null,
      owed.errors.length ? `after-the-job email errors x${owed.errors.length}` : null,
      leads ? `missed leads forwarded x${leads}` : null].filter(Boolean).join(", ") || null,
  });
  return NextResponse.json({ ok: true, billing, demo: demo.deleted, owed: owed.sent, leads });
}

export const POST = GET;
