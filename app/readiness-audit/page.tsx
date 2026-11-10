import "../marketing.css";
import "./readiness-audit.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import ReadinessAuditForm from "./readiness-audit-form";

export const metadata = {
  title: "Send your truck lists | RollReady",
  description:
    "Send what each truck is supposed to leave with, in any format. I'll turn it into a short list for each truck in RollReady, and setup is free for the first 10 yards I set up.",
  alternates: { canonical: "/readiness-audit" },
};

export default function ReadinessAuditPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="audit">
        <div className="container ra-wrap">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <h1 className="h2">Send your truck lists</h1>
            <p className="lede" style={{ marginInline: 0 }}>
              What each truck is supposed to leave with. A load-out sheet, a photo of the whiteboard, a screenshot of the group text, whatever you&apos;ve got.
              I&apos;ll turn it into a short list for each truck, so your hands can check a truck in under a minute. Setup is free for the first 10 yards I set up.
              Or email the lists to cadencain@synnr.io (<a href="mailto:cadencain@synnr.io">open email</a>).
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
