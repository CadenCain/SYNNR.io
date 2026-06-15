import "../marketing.css";
import "../apps/apps.css";
import { redirect } from "next/navigation";
import { getSignedInOrg } from "@/lib/marketplace/access";
import { SiteNav } from "../site-chrome";

export const metadata = { title: "Account — SYNNR" };

export default async function AccountPage() {
  const org = await getSignedInOrg();
  if (!org) redirect("/login?next=/account");

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">Account</span>
          <h1 className="h2">Your profile</h1>
        </div>
        <div className="appcard" style={{ maxWidth: 520 }}>
          <div className="appcard-top"><span className="appname">Signed in</span></div>
          <p className="apptag">{org.email ?? "—"}</p>
          <div className="appcard-foot">
            <a className="btn btn-ghost btn-sm" href="/billing">Billing & seats</a>
            <a className="btn btn-ghost btn-sm" href="/dashboard">Dashboard</a>
          </div>
        </div>
      </main>
    </div>
  );
}
