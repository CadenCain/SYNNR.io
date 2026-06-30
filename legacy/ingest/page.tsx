import "../marketing.css";
import "../apps/apps.css";
import "../app/tallyshot/tallyshot.css";
import type { Metadata } from "next";
import { SiteNav, SiteFooter } from "../site-chrome";
import IngestDemoClient from "./ingest-demo-client";

export const metadata: Metadata = {
  title: "TallyShot live demo — photo → clean Excel",
  description:
    "Try TallyShot free: load a real handwritten casing tally sheet, watch it read the joints, flag the shaky digits, total it, and export clean Excel. No account, no card.",
};

export default function IngestPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">TallyShot · live demo</span>
          <h1 className="h2">Photograph a tally sheet, get clean Excel</h1>
          <p className="lede" style={{ marginInline: 0 }}>
            Load a real handwritten casing/tubing tally below. TallyShot reads every joint, applies the implied
            decimal (3134 → 31.34), totals it with per-10 subtotals, and <b>flags the digits it isn&apos;t sure about</b>
            {" "}for you to confirm. No account, no card.
          </p>
        </div>

        <IngestDemoClient />

        <p className="apps-note" style={{ textAlign: "left", marginTop: 28 }}>
          This is the real TallyShot engine on a sample sheet. <a href="/apps/tallyshot">How it works</a> · <a href="/checkout?product=tallyshot&seats=1">Start a free trial</a> to scan your own.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
