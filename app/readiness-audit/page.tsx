import "../marketing.css";
import "./readiness-audit.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import ReadinessAuditForm from "./readiness-audit-form";

export const metadata = {
  title: "Free readiness map | SYNNR",
  description:
    "Send us one cert list or loadout sheet. We'll map what's expired, expiring, and missing in your yard and send it back. Free, no card, no pitch.",
};

export default function ReadinessAuditPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="audit">
        <div className="container ra-wrap">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">Free readiness map</span>
            <h1 className="h2" style={{ marginTop: 8 }}>Send one list. Get a readiness map back.</h1>
            <p className="lede" style={{ marginInline: 0 }}>
              Send us one cert list or loadout sheet — a spreadsheet, a photo of the whiteboard, whatever you&apos;ve got.
              We&apos;ll map what&apos;s expired, expiring, and missing in your yard and send it back. Free, no card, no pitch.
              Or just email <a href="mailto:cadencain@darkstarops.com">cadencain@darkstarops.com</a> with the list attached.
            </p>
          </div>

          <div className="ra-card">
            <ReadinessAuditForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
