import "../marketing.css";
import "../apps/apps.css";
import { redirect } from "next/navigation";
import { getSignedInOrg, getNavContext } from "@/lib/marketplace/access";
import { SiteNav } from "../site-chrome";
import AccountClient from "./account-client";

export const metadata = { title: "Account — SYNNR" };

export default async function AccountPage() {
  const org = await getSignedInOrg();
  if (!org) redirect("/login?next=/account");
  const nav = await getNavContext();

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">Account</span>
          <h1 className="h2">Settings</h1>
        </div>
        <div className="appcard" style={{ maxWidth: 540 }}>
          <div className="appcard-top"><span className="appname">Profile</span><span className="status coming_soon">{nav?.role ?? "member"}</span></div>
          <p className="apptag">{org.email ?? "—"}</p>
          <AccountClient isOwner={nav?.role === "owner"} />
          <div className="appcard-foot" style={{ marginTop: 18 }}>
            <a className="btn btn-ghost btn-sm" href="/billing">Billing &amp; seats</a>
            {nav?.canManageTeam ? <a className="btn btn-ghost btn-sm" href="/team">Team</a> : null}
            <a className="btn btn-ghost btn-sm" href="/dashboard">Your apps</a>
          </div>
        </div>
      </main>
    </div>
  );
}
