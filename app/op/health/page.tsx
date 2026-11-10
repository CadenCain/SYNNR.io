import { requireOperator } from "@/lib/op/auth";
import { saasAdmin } from "@/lib/saas/db";
import { isBillableYard } from "@/lib/saas/billing-rules";
import { getStripe } from "@/lib/stripe";
import { YARD_PRICE_LOOKUP_KEY, isYardPrice } from "@/lib/saas/plan";

/** The clock, read once per request (kept out of render for the React compiler). */
const clock = () => Date.now();

export const dynamic = "force-dynamic";

/**
 * THE AUDIT LOOP.
 *
 * Every invariant a past audit had to discover by hand, asserted here against
 * LIVE data, on demand, forever. The point is that "is it still correct?"
 * stops being a thing somebody has to remember to go check.
 *
 * Each check states what it means when it fails, in plain words, because the
 * person reading this at 6am is the one who has to decide whether it matters.
 */

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  /** What breaks for a customer if this is red. */
  soWhat: string;
  severity: "critical" | "warn";
};

export default async function OpHealth() {
  await requireOperator();
  const admin = saasAdmin();
  if (!admin) return <p>Admin client not configured.</p>;

  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ── Is the daily job running? ─────────────────────────────────────────────
  // It checks what Stripe bills against what each company has, and deletes
  // day-old demo companies. Every run leaves a heartbeat row, pass or fail.
  const { data: lastRunRows } = await admin.from("saas_cron_runs")
    .select("ran_at, ok, detail")
    .eq("job", "daily").order("ran_at", { ascending: false }).limit(1);
  const lastRun = (lastRunRows?.[0] ?? null) as { ran_at: string; ok: boolean; detail: string | null } | null;
  const ranRecently = lastRun ? (clock() - new Date(lastRun.ran_at).getTime()) < 26 * 3600e3 : false;
  add({
    name: "The daily job ran in the last day",
    ok: ranRecently && Boolean(lastRun?.ok),
    detail: lastRun
      ? `last run ${new Date(lastRun.ran_at).toLocaleString()}${lastRun.ok ? "" : " · reported a problem"}${lastRun.detail ? ` · ${lastRun.detail}` : ""}`
      : "no run recorded yet; the first one lands at the next 13:30 UTC run",
    soWhat: lastRun
      ? "Billing drift goes unnoticed and old demo companies pile up. Check Vercel, Crons."
      : "Not a failure yet, just unknown: this job is new. If it's still empty after tomorrow's run, the cron isn't firing.",
    // "Never seen a run" and "ran yesterday, silent today" are different facts.
    severity: lastRun ? "critical" : "warn",
  });

  // ── Billing sanity ────────────────────────────────────────────────────────
  const { data: companies } = await admin.from("saas_companies")
    .select("id, name, subscription_status, stripe_customer_id, stripe_subscription_id, yard_quantity");
  type Co = { id: string; name: string; subscription_status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; yard_quantity: number };
  const cos = (companies ?? []) as Co[];
  const { data: yardRows } = await admin.from("saas_yards").select("company_id, name");
  const yardCount = new Map<string, number>();
  for (const y of (yardRows ?? []) as { company_id: string; name: string }[]) {
    if (!isBillableYard(y.name)) continue; // the demo yard is free — never drift
    yardCount.set(y.company_id, (yardCount.get(y.company_id) ?? 0) + 1);
  }
  // The plan is a limit: paying for more yards than are set up is fine; more
  // yards set up than paid for is free SYNNR.
  const overCap = cos.filter((c) =>
    c.stripe_subscription_id && (c.subscription_status === "active" || c.subscription_status === "past_due") &&
    (yardCount.get(c.id) ?? 0) > c.yard_quantity);
  add({
    name: "No shop runs more yards than it pays for",
    ok: overCap.length === 0,
    detail: overCap.length === 0
      ? `${cos.filter((c) => c.stripe_subscription_id).length} real subscription(s), all within their plan`
      : overCap.map((c) => `${c.name}: pays for ${c.yard_quantity}, has ${yardCount.get(c.id) ?? 0}`).join(" · "),
    soWhat: "A shop is getting yards it isn't paying for, and partner payouts are computed off this same number.",
    severity: "critical",
  });

  // ── Stripe is wired up ──────────────────────────────────────────────────
  const stripe = getStripe();
  const sk = process.env.STRIPE_SECRET_KEY ?? "";
  add({
    name: "Stripe key is set",
    ok: Boolean(stripe),
    detail: stripe ? `${sk.startsWith("sk_live") || sk.startsWith("rk_live") ? "LIVE" : "TEST"} mode` : "STRIPE_SECRET_KEY missing",
    soWhat: "Nobody can pay. Checkout and Manage billing both fail.",
    severity: "critical",
  });
  add({
    name: "Stripe webhook secret is set",
    ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    detail: process.env.STRIPE_WEBHOOK_SECRET ? "set (endpoint: https://www.synnr.io/api/saas/stripe-webhook)" : "STRIPE_WEBHOOK_SECRET missing",
    soWhat: "Cancellations, failed renewals, and yard changes made in Stripe never reach the app. A canceled shop keeps using SYNNR.",
    severity: "critical",
  });
  if (stripe) {
    let priceDetail = "";
    let priceOk = false;
    try {
      const p = (await stripe.prices.list({ lookup_keys: [YARD_PRICE_LOOKUP_KEY], active: true, limit: 1 })).data[0]
        ?? (process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ? await stripe.prices.retrieve(process.env.NEXT_PUBLIC_STRIPE_PRICE_ID).catch(() => undefined) : undefined);
      priceOk = !p || isYardPrice(p);
      priceDetail = !p ? "not made yet; the first checkout makes it ($500/yard/month)" : `${p.id}: $${(p.unit_amount ?? 0) / 100} ${p.currency.toUpperCase()} per ${p.recurring?.interval}`;
    } catch (e) {
      priceDetail = `Stripe call failed: ${e instanceof Error ? e.message : String(e)}`;
    }
    add({
      name: "The yard price is $500 a month",
      ok: priceOk,
      detail: priceDetail,
      soWhat: "Checkout refuses to sell at the wrong price, so nobody can subscribe until this is fixed in Stripe.",
      severity: "critical",
    });
  }

  const ghostPaying = cos.filter((c) => c.subscription_status === "active" && !c.stripe_customer_id);
  add({
    name: "Active companies have a Stripe customer",
    ok: ghostPaying.length === 0,
    detail: ghostPaying.length === 0 ? "clean" : `${ghostPaying.map((c) => c.name).join(", ")} (expected for comped demo accounts)`,
    soWhat: "If it isn't a comped account, someone has access without a payment record.",
    severity: "warn",
  });

  const criticals = checks.filter((c) => !c.ok && c.severity === "critical").length;
  const warns = checks.filter((c) => !c.ok && c.severity === "warn").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>Health</h1>
        <p style={{ color: "var(--op-dim, #8a8071)", fontSize: 14, marginTop: 4 }}>
          Checked against live data right now.
        </p>
      </div>

      <div style={{
        border: "1px solid", borderColor: criticals ? "#d55f53" : warns ? "#d9b34f" : "#86a877",
        background: criticals ? "rgba(213,95,83,0.08)" : warns ? "rgba(217,179,79,0.07)" : "rgba(134,168,119,0.07)",
        borderRadius: 4, padding: "14px 16px", fontWeight: 600,
      }}>
        {criticals > 0
          ? `${criticals} critical problem${criticals === 1 ? "" : "s"} — fix before selling another seat.`
          : warns > 0
            ? `Everything critical is green. ${warns} thing${warns === 1 ? "" : "s"} worth a look.`
            : "All clear. Nothing is quietly broken."}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {checks.map((c) => (
          <div key={c.name} style={{
            border: "1px solid #37312a", borderRadius: 4, padding: "12px 14px",
            opacity: c.ok ? 0.75 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.1em", padding: "2px 8px", borderRadius: 2,
                color: c.ok ? "#9dbb8e" : c.severity === "critical" ? "#e0756a" : "#e6c46a",
                border: `1px solid ${c.ok ? "rgba(157,187,142,.4)" : c.severity === "critical" ? "rgba(224,117,106,.5)" : "rgba(230,196,106,.45)"}`,
              }}>
                {c.ok ? "OK" : c.severity === "critical" ? "FAIL" : "WARN"}
              </span>
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: "#a59d8c" }}>{c.detail}</span>
            </div>
            {!c.ok && (
              <p style={{ marginTop: 8, fontSize: 13, color: "#a59d8c", lineHeight: 1.5 }}>{c.soWhat}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
