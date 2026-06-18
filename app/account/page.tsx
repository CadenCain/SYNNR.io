import "../marketing.css";
import "../apps/apps.css";
import { redirect } from "next/navigation";
import { getSignedInOrg, getNavContext } from "@/lib/marketplace/access";
import AppShell from "../app/app-shell";
import AccountClient from "./account-client";

export const metadata = { title: "Account — SYNNR" };

export default async function AccountPage() {
  const org = await getSignedInOrg();
  if (!org) redirect("/login?next=/account");
  const nav = await getNavContext();

  return (
    <AppShell current="account" title="Settings" subtitle={org.email ?? undefined}>
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
    </AppShell>
  );
}
