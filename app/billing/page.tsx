import "../marketing.css";
import "../apps/apps.css";
import { redirect } from "next/navigation";
import { getSignedInOrg, getEntitlementContext } from "@/lib/marketplace/access";
import { getOrgUsage } from "@/lib/marketplace/usage";
import { getProduct } from "@/lib/catalog";
import { SiteNav } from "../site-chrome";
import PortalButton from "./portal-button";

export const metadata = { title: "Billing — SYNNR" };

export default async function BillingPage() {
  const org = await getSignedInOrg();
  if (!org) redirect("/login?next=/billing");
  const ctx = await getEntitlementContext(org);
  const usage = ctx.subscriptions.some((s) => s.productSlug === "tallyshot") && org.workspaceId
    ? await getOrgUsage(org.workspaceId, "tallyshot")
    : null;

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">Billing</span>
          <h1 className="h2">Your plan & seats</h1>
          <p className="lede" style={{ marginInline: 0 }}>Change seats, update payment, download invoices, or cancel — all self-serve through the Stripe Customer Portal.</p>
        </div>

        {ctx.subscriptions.length ? (
          <div className="bandtable" style={{ marginInline: 0, marginBottom: 28 }}>
            {ctx.subscriptions.map((s) => (
              <div key={s.productSlug} className="bandrow">
                <span className="bandlabel">{getProduct(s.productSlug)?.name ?? s.productSlug}</span>
                <span className="bandprice"><b>{s.seats}</b> <span className="per">seat{s.seats === 1 ? "" : "s"} · {s.status}</span></span>
                <span className="bandcta mono" style={{ fontSize: 12, color: "var(--fg-faint)" }}>
                  {s.periodEnd ? `renews ${new Date(s.periodEnd).toLocaleDateString()}` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="apps-note" style={{ textAlign: "left", marginTop: 0, marginBottom: 24 }}>
            No active subscriptions yet. <a href="/apps">Browse apps</a> to start a free trial.
          </p>
        )}

        {usage && usage.pooledQuota > 0 ? (
          <div className="usage-card">
            <div className="usage-head">
              <span><b>TallyShot usage</b> · this month</span>
              <span className="mono">{usage.usedThisPeriod.toLocaleString()} / {usage.pooledQuota.toLocaleString()} sheets</span>
            </div>
            <div className="usage-bar"><span style={{ width: `${usage.pctUsed}%` }} className={usage.overageUnits ? "over" : ""} /></div>
            <div className="usage-foot">
              {usage.overageUnits > 0 ? (
                <span className="over-note">{usage.overageUnits.toLocaleString()} sheets over pool · ${usage.overageCostUsd.toFixed(2)} overage @ ${usage.overagePerUnitUsd.toFixed(2)}/sheet</span>
              ) : (
                <span>{(usage.pooledQuota - usage.usedThisPeriod).toLocaleString()} sheets left in your pool · {usage.seats} seat{usage.seats === 1 ? "" : "s"} × {(usage.pooledQuota / Math.max(1, usage.seats)).toLocaleString()}</span>
              )}
            </div>
          </div>
        ) : null}

        <PortalButton />
      </main>
    </div>
  );
}
