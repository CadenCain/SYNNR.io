import "../marketing.css";
import "./readiness-audit.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import ReadinessAuditForm from "./readiness-audit-form";

export const metadata = {
  title: "Send your iron list | RollReady",
  description:
    "Send one cert list or load-out sheet, any format. You get back what's expired, coming due, and missing, and the first 10 yards I set up on RollReady are free.",
  alternates: { canonical: "/readiness-audit" },
};

export default function ReadinessAuditPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="audit">
        <div className="container ra-wrap">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <h1 className="h2">Send your iron list</h1>
            <p className="lede" style={{ marginInline: 0 }}>
              One cert list or load-out sheet. A spreadsheet, a photo of the whiteboard, whatever you&apos;ve got.
              I&apos;ll send back what&apos;s expired, coming due, and missing. If you want RollReady, I load the iron with you: free for the first 10 yards I set up.
              Or email the list to cadencain@synnr.io (<a href="mailto:cadencain@synnr.io">open email</a>).
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
