import "../marketing.css";
import "./readiness-audit.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import ReadinessAuditForm from "./readiness-audit-form";

export const metadata = {
  title: "Free readiness audit | SYNNR",
  description:
    "Tell us about your yard or we'll come log it on-site. We'll show you what's expired, expiring, and missing. Free.",
};

export default function ReadinessAuditPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="audit">
        <div className="container ra-wrap">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">Free readiness audit</span>
            <h1 className="h2" style={{ marginTop: 8 }}>Get your free readiness audit</h1>
            <p className="lede" style={{ marginInline: 0 }}>
              Tell us about your yard — or we'll come log it on-site. We'll show you what's expired, expiring, and missing. No charge, no pitch.
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
