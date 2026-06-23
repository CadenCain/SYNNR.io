import "../marketing.css";
import "../apps/apps.css";
import "../services/services.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import ReadinessForm from "./readiness-form";

export const metadata = {
  title: "Free Readiness Map | SYNNR",
  description:
    "Send SYNNR one real job packet or loadout list. We map exactly where your operation is leaking money — missing tools, cert misses, kicked-back invoices — free, this week.",
};

export default function ReadinessMapPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section svc-audit" id="map">
        <div className="container">
          <div className="svc-audit-card">
            <div className="svc-audit-copy">
              <span className="eyebrow">Free Readiness Map</span>
              <h1 className="h2" style={{ marginTop: 8 }}>Send us one job packet.</h1>
              <p className="lede" style={{ marginInline: 0 }}>
                We&apos;ll map exactly where it&apos;s costing you — missing tools, cert misses, kicked-back invoices — and
                put a dollar figure on it. Free, this week. No account, no pitch.
              </p>
              <ul className="pricing-incl" style={{ marginTop: 18 }}>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>One real job packet is all we need</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>We map the leaks and what they cost</li>
                <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>No blind quotes — pricing only after the Map</li>
              </ul>
            </div>
            <ReadinessForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
