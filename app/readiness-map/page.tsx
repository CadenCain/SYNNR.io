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
  // Copy must match what actually happens: instant booking only when Calendly is wired.
  const calWired = !!process.env.NEXT_PUBLIC_CALENDLY_URL;

  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="map">
        <div className="container rm-wrap">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">Free Readiness Call</span>
            <h1 className="h2" style={{ marginTop: 8 }}>Book your free Readiness Call</h1>
            <p className="lede" style={{ marginInline: 0 }}>
              {calWired
                ? "A free 15-minute call. Two quick steps and you're booked — tell us about your shop, then grab a time. We'll come ready to pinpoint your biggest money leak. No packet to dig up, no pitch."
                : "A free 15-minute call. Tell us about your shop and we'll email you a time this week. We'll come ready to pinpoint your biggest money leak. No packet to dig up, no pitch."}
            </p>
          </div>

          <div className="rm-card">
            <div className="rm-step">
              <div className="rm-step-h">
                <span className="rm-num">1</span>
                <div><b>Tell us about your operation</b><span>30 seconds — so we walk in already knowing your shop</span></div>
              </div>
              <ReadinessForm />
            </div>
            <div className="rm-step" id="pick-time">
              <div className="rm-step-h">
                <span className="rm-num">2</span>
                <div>
                  <b>{calWired ? "Pick a time" : "We'll email you a time"}</b>
                  <span>{calWired ? "Grab a 15-minute slot that works for you" : "Send your details above and we'll reach out this week to schedule"}</span>
                </div>
              </div>
              <CalendlyEmbed />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
