import { requireOperator } from "@/lib/op/auth";
import { saasAdmin } from "@/lib/saas/db";
import { localToday, addDaysIso } from "@/lib/saas/status";

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
  const today = localToday();

  // ── Ghost data ───────────────────────────────────────────────────────────
  const [units, assets, crew, items] = await Promise.all([
    admin.from("saas_units").select("id"),
    admin.from("saas_assets").select("id, unit_id"),
    admin.from("saas_crew_members").select("id"),
    admin.from("saas_compliance_items").select("id, parent_type, parent_id, expiration_date, company_id"),
  ]);
  const unitIds = new Set(((units.data ?? []) as { id: string }[]).map((r) => r.id));
  const assetIds = new Set(((assets.data ?? []) as { id: string }[]).map((r) => r.id));
  const crewIds = new Set(((crew.data ?? []) as { id: string }[]).map((r) => r.id));
  type Item = { id: string; parent_type: string; parent_id: string; expiration_date: string | null; company_id: string };
  const allItems = (items.data ?? []) as Item[];

  const orphans = allItems.filter((i) =>
    (i.parent_type === "unit" && !unitIds.has(i.parent_id)) ||
    (i.parent_type === "asset" && !assetIds.has(i.parent_id)) ||
    (i.parent_type === "crew" && !crewIds.has(i.parent_id)));
  add({
    name: "No orphaned compliance items",
    ok: orphans.length === 0,
    detail: orphans.length === 0 ? "clean" : `${orphans.length} item(s) point at a deleted parent`,
    soWhat: "A shop gets alerts forever for a truck it sold, and the ghost item pins readiness at 74% with no page left to fix it.",
    severity: "critical",
  });

  const strandedAssets = ((assets.data ?? []) as { id: string; unit_id: string | null }[])
    .filter((a) => a.unit_id && !unitIds.has(a.unit_id));
  add({
    name: "No assets on a deleted unit",
    ok: strandedAssets.length === 0,
    detail: strandedAssets.length === 0 ? "clean" : `${strandedAssets.length} stranded`,
    soWhat: "Gear invisible in the UI that still counts against the yard.",
    severity: "warn",
  });

  // ── The one that bit us: silently muted alerts ────────────────────────────
  // An item whose date is comfortably in the future should NOT still have an
  // alert-log row. If it does, it was renewed without clearing the log and the
  // sweep will never alert on it again.
  const { data: sentRows } = await admin.from("saas_alerts_sent").select("compliance_item_id");
  const sentIds = new Set(((sentRows ?? []) as { compliance_item_id: string | null }[])
    .map((r) => r.compliance_item_id).filter(Boolean) as string[]);
  const horizon = addDaysIso(today, 45);
  const muted = allItems.filter((i) => sentIds.has(i.id) && i.expiration_date && i.expiration_date > horizon);
  add({
    name: "No silently muted items",
    ok: muted.length === 0,
    detail: muted.length === 0 ? "clean" : `${muted.length} renewed item(s) still flagged as already-alerted`,
    soWhat: "THE core promise failing quietly: those items were renewed but the sweep will never alert on them again.",
    severity: "critical",
  });

  // ── Duplicates ────────────────────────────────────────────────────────────
  const byParentTitle = new Map<string, number>();
  const { data: titled } = await admin.from("saas_compliance_items").select("parent_id, title");
  for (const r of (titled ?? []) as { parent_id: string; title: string }[]) {
    const k = `${r.parent_id}|${r.title.toLowerCase().trim()}`;
    byParentTitle.set(k, (byParentTitle.get(k) ?? 0) + 1);
  }
  const dupes = [...byParentTitle.values()].filter((n) => n > 1).length;
  add({
    name: "No duplicate certs on the same parent",
    ok: dupes === 0,
    detail: dupes === 0 ? "clean" : `${dupes} duplicated title(s)`,
    soWhat: "Each duplicate alerts separately — the customer gets the same warning twice and stops trusting them.",
    severity: "warn",
  });

  // ── Is the watchman awake? ────────────────────────────────────────────────
  // Two separate questions, because conflating them made this cry wolf. Items
  // alert ONCE and re-arm on renewal, so "last alert was 2 weeks ago" is the
  // normal steady state — every due item already got its heads-up. Judging the
  // cron by that timestamp reported "customers are not being warned" on a
  // perfectly healthy system, which is how an ops page earns being ignored.
  const { data: lastRunRows } = await admin.from("saas_cron_runs")
    .select("ran_at, ok, alerts_sent, errors, detail")
    .eq("job", "saas-alerts").order("ran_at", { ascending: false }).limit(1);
  const lastRun = (lastRunRows?.[0] ?? null) as
    { ran_at: string; ok: boolean; alerts_sent: number; errors: number; detail: string | null } | null;
  const ranRecently = lastRun ? (Date.now() - new Date(lastRun.ran_at).getTime()) < 26 * 3600e3 : false;

  add({
    name: "Alert cron fired in the last day",
    ok: ranRecently,
    detail: lastRun
      ? `last run ${new Date(lastRun.ran_at).toLocaleString()} · ${lastRun.alerts_sent} sent · ${lastRun.errors} error(s)${lastRun.detail ? ` · ${lastRun.detail}` : ""}`
      : "no heartbeat recorded yet — the first row lands at the next 6:30am Central run",
    soWhat: lastRun
      ? "If the cron isn't firing, nothing else here matters — no shop gets warned about anything, and the product silently stops doing its one job."
      : "Not a failure yet, just unknown: the heartbeat was added today. If this is still empty after tomorrow's 6:30am run, the cron is genuinely dead.",
    // "Never seen a run" and "ran fine yesterday, silent today" are different
    // facts. Painting the first one red on the day the heartbeat shipped would
    // repeat exactly the false alarm this check replaced.
    severity: lastRun ? "critical" : "warn",
  });

  // The real failure condition: something is inside its lead window and has
  // never been alerted on. This is what a broken sweep actually looks like.
  const { data: leadRows } = await admin.from("saas_notification_settings").select("company_id, lead_days");
  const leadByCompany = new Map(((leadRows ?? []) as { company_id: string; lead_days: number | null }[])
    .map((r) => [r.company_id, r.lead_days ?? 30]));
  const unwarned = allItems.filter((i) => {
    if (!i.expiration_date) return false;
    const lead = leadByCompany.get(i.company_id) ?? 30;
    return i.expiration_date <= addDaysIso(today, lead) && !sentIds.has(i.id);
  });
  add({
    name: "Nothing due is sitting un-alerted",
    ok: unwarned.length === 0 || !ranRecently,
    detail: unwarned.length === 0
      ? "every item inside its lead window has been alerted"
      : `${unwarned.length} item(s) due and never alerted`,
    soWhat: !ranRecently
      ? "Can't judge this until the cron is firing again — fix the check above first."
      : "The sweep ran but these were skipped. A shop is going to get surprised by a cert it was paying us to watch.",
    severity: "critical",
  });

  // ── Billing sanity ────────────────────────────────────────────────────────
  const { data: companies } = await admin.from("saas_companies")
    .select("id, name, subscription_status, stripe_customer_id, stripe_subscription_id, yard_quantity");
  type Co = { id: string; name: string; subscription_status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; yard_quantity: number };
  const cos = (companies ?? []) as Co[];
  const { data: yardRows } = await admin.from("saas_yards").select("company_id");
  const yardCount = new Map<string, number>();
  for (const y of (yardRows ?? []) as { company_id: string }[]) {
    yardCount.set(y.company_id, (yardCount.get(y.company_id) ?? 0) + 1);
  }
  const payingMismatch = cos.filter((c) =>
    c.stripe_subscription_id && c.subscription_status === "active" &&
    c.yard_quantity !== (yardCount.get(c.id) ?? 0));
  add({
    name: "Billed yards match actual yards",
    ok: payingMismatch.length === 0,
    detail: payingMismatch.length === 0
      ? `${cos.filter((c) => c.stripe_subscription_id).length} real subscription(s) in step`
      : payingMismatch.map((c) => `${c.name}: billed ${c.yard_quantity}, has ${yardCount.get(c.id) ?? 0}`).join(" · "),
    soWhat: "You are under- or over-charging a paying shop, and partner payouts are computed off this same number.",
    severity: "critical",
  });

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
          Live invariants, checked right now. Every one of these was a real bug at some point.
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
