import "../../marketing.css";
import "../../apps/apps.css";
import { requireProduct } from "@/lib/marketplace/access";
import { SiteNav } from "../../site-chrome";

export const metadata = { title: "TallyShot — SYNNR" };

/**
 * The gated TallyShot product surface. Server-side entitlement guard runs first
 * (redirects to /login when signed out). When the org subscribes but the user
 * has no seat, we render a seat prompt instead of the app — never the app.
 *
 * The actual scan→flag→correct→export UI is the existing engine at /ingest;
 * the full in-app build is the next slice.
 */
export default async function TallyShotApp() {
  const { check } = await requireProduct("tallyshot");

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        {check.allowed ? (
          <>
            <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
              <span className="eyebrow">TallyShot</span>
              <h1 className="h2">Scan a tally sheet</h1>
              <p className="lede" style={{ marginInline: 0 }}>
                Access confirmed{check.via === "flat" ? " (org license)" : " (your seat)"}. Open the reader to photograph a
                sheet, confirm the flagged digits, and export clean Excel.
              </p>
            </div>
            <div className="appcard-foot">
              <a className="btn btn-primary" href="/ingest">Open the reader</a>
              <a className="btn btn-ghost" href="/billing">Billing &amp; seats</a>
            </div>
          </>
        ) : (
          <div className="appcard" style={{ maxWidth: 520 }}>
            <div className="appcard-top"><span className="appname">TallyShot</span><span className="status coming_soon">No access</span></div>
            <p className="apptag">{check.reason}</p>
            <div className="appcard-foot">
              <a className="btn btn-primary btn-sm" href="/apps/tallyshot#pricing">Start free trial</a>
              <a className="btn btn-ghost btn-sm" href="/dashboard">Back to dashboard</a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
