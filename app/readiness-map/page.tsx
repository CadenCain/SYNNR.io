import "../marketing.css";
import "../apps/apps.css";
import "../services/services.css";
import "./readiness.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import ReadinessForm from "./readiness-form";
import CalendlyEmbed from "./calendly-embed";

export const metadata = {
  title: "Book your free Readiness Call | SYNNR",
  description:
    "A free 15-minute call. Tell SYNNR how your shop runs and we'll pinpoint your biggest money leak — missing tools, cert misses, kicked-back invoices. No packet to dig up, no pitch.",
};

export default function ReadinessMapPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section svc-audit" id="map">
        <div className="container">
          <div className="svc-audit-card">
            <div className="svc-audit-copy">
              <span className="eyebrow">Free Readiness Call</span>
              <h1 className="h2" style={{ marginTop: 8 }}>Tell us about your operation.</h1>
              <p className="lede" style={{ marginInline: 0 }}>
                A free 15-minute call. Tell us how your shop runs and where it hurts, and we&apos;ll pinpoint your
                biggest money leak — that&apos;s your Readiness Map. No packet to dig up, no pitch.
              </p>
              <ul className="pricing-incl" style={{ marginTop: 18 }}>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>15 minutes, on your schedule</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>We pinpoint your biggest money leak</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>No blind quotes — and nothing to prep</li>
              </ul>
            </div>
            <ReadinessForm />
          </div>

          <div className="rm-cal">
            <div className="head" style={{ textAlign: "left", marginInline: 0, marginBottom: 18 }}>
              <span className="eyebrow">Pick a time</span>
              <h2 className="h2">Grab a 15-minute slot</h2>
            </div>
            <CalendlyEmbed />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
