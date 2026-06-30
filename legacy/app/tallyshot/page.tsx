import "../../marketing.css";
import "../../apps/apps.css";
import "./tallyshot.css";
import { requireProduct } from "@/lib/marketplace/access";
import AppShell from "../app-shell";
import TallyShotClient from "./tallyshot-client";

export const metadata = { title: "TallyShot — SYNNR" };

/** Gated TallyShot surface inside the app shell. Server entitlement guard first. */
export default async function TallyShotApp() {
  const { check } = await requireProduct("tallyshot");

  if (!check.allowed) {
    return (
      <AppShell current="tallyshot" title="TallyShot">
        <div className="appcard" style={{ maxWidth: 520 }}>
          <div className="appcard-top"><span className="appname">TallyShot</span><span className="status coming_soon">No access</span></div>
          <p className="apptag">{check.reason}</p>
          <div className="appcard-foot">
            <a className="btn btn-primary btn-sm" href="/apps/tallyshot#pricing">Start free trial</a>
            <a className="btn btn-ghost btn-sm" href="/dashboard">Back to dashboard</a>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell current="tallyshot" title="Scan a tally sheet" subtitle="Photograph a handwritten tally sheet, confirm the digits it flags, and export clean Excel + PDF.">
      <TallyShotClient />
    </AppShell>
  );
}
