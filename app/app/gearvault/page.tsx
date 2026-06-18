import "../../marketing.css";
import "../../apps/apps.css";
import "./gearvault.css";
import { requireProduct } from "@/lib/marketplace/access";
import AppShell from "../app-shell";
import GearVaultClient from "./gearvault-client";

export const metadata = { title: "GearVault — SYNNR" };

/**
 * GearVault — Layer 1/2 asset register + certs. Free early access: any signed-in
 * user can use it (catalog marks it free). Redirects to /login when signed out.
 */
export default async function GearVaultApp() {
  const { org, check } = await requireProduct("gearvault");

  if (!check.allowed) {
    return (
      <AppShell current="gearvault" title="GearVault">
        <div className="appcard" style={{ maxWidth: 520 }}>
          <div className="appcard-top"><span className="appname">GearVault</span><span className="status coming_soon">Sign in</span></div>
          <p className="apptag">{check.reason}</p>
          <div className="appcard-foot"><a className="btn btn-primary btn-sm" href="/login?next=/app/gearvault">Sign in</a></div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell current="gearvault" title="Your gear" subtitle="Log every tool and asset, set where it is, and find anything fast. Certs & tool check-out coming next.">
      <GearVaultClient workspaceId={org.workspaceId} userId={org.userId} />
    </AppShell>
  );
}
