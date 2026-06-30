import "../marketing.css";
import "../apps/apps.css";
import { redirect } from "next/navigation";
import { getSignedInOrg, getEntitlementContext } from "@/lib/marketplace/access";
import { PRODUCTS, canUseProduct } from "@/lib/catalog";
import AppShell from "../app/app-shell";

export const metadata = { title: "Dashboard — SYNNR" };

export default async function DashboardPage() {
  const org = await getSignedInOrg();
  if (!org) redirect("/login?next=/dashboard");
  const ctx = await getEntitlementContext(org);

  return (
    <AppShell current="dashboard" title="Your apps" subtitle="Open an app you have access to, or add another from the marketplace.">
        <div className="appgrid">
          {PRODUCTS.map((p) => {
            const access = canUseProduct(ctx, p.slug);
            const sub = ctx.subscriptions.find((s) => s.productSlug === p.slug);
            return (
              <div key={p.slug} className={`appcard ${access.allowed ? "live" : "coming_soon"}`}>
                <div className="appcard-top">
                  <span className="appname">{p.name}</span>
                  <span className={`status ${access.allowed ? "live" : "coming_soon"}`}>
                    {access.allowed ? "Active" : sub ? "No seat" : p.status === "live" ? "Available" : "Coming soon"}
                  </span>
                </div>
                <p className="apptag">{p.tagline}</p>
                <div className="appcard-foot">
                  {access.allowed ? (
                    <a className="btn btn-primary btn-sm" href={`/app/${p.slug}`}>Open</a>
                  ) : p.status === "live" ? (
                    <a className="btn btn-ghost btn-sm" href={`/apps/${p.slug}#pricing`}>Start free trial</a>
                  ) : (
                    <a className="btn btn-ghost btn-sm" href="/apps">Join waitlist</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="appcard-foot" style={{ marginTop: 28 }}>
          <a className="btn btn-ghost btn-sm" href="/team">Team & seats</a>
          <a className="btn btn-ghost btn-sm" href="/billing">Billing</a>
          <a className="btn btn-ghost btn-sm" href="/account">Account</a>
        </div>
    </AppShell>
  );
}
