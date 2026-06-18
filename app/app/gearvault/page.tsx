import "../../marketing.css";
import "../../apps/apps.css";
import "./gearvault.css";
import { requireProduct } from "@/lib/marketplace/access";
import { SiteNav } from "../../site-chrome";
import AppSwitcher from "../app-switcher";
import GearVaultClient from "./gearvault-client";

export const metadata = { title: "GearVault — SYNNR" };

/**
 * GearVault — Layer 1 asset register. Free early access: any signed-in user can
 * use it (the catalog marks it free, so requireProduct allows it). Redirects to
 * /login when signed out.
 */
export default async function GearVaultApp() {
  const { org, check } = await requireProduct("gearvault");

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        {check.allowed ? (
          <>
            <AppSwitcher current="gearvault" />
            <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
              <span className="eyebrow">GearVault · free early access</span>
              <h1 className="h2">Your gear</h1>
              <p className="lede" style={{ marginInline: 0 }}>
                Log every tool and asset, set where it is, and find anything fast. Certs &amp; tool check-out are coming next.
              </p>
            </div>
            <GearVaultClient workspaceId={org.workspaceId} userId={org.userId} />
          </>
        ) : (
          <div className="appcard" style={{ maxWidth: 520 }}>
            <div className="appcard-top"><span className="appname">GearVault</span><span className="status coming_soon">Sign in</span></div>
            <p className="apptag">{check.reason}</p>
            <div className="appcard-foot"><a className="btn btn-primary btn-sm" href="/login?next=/app/gearvault">Sign in</a></div>
          </div>
        )}
      </main>
    </div>
  );
}
