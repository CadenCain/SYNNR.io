import "../marketing.css";
import "./apps.css";
import type { Metadata } from "next";
import { PRODUCTS } from "@/lib/catalog";
import { SiteNav, SiteFooter } from "../site-chrome";
import WaitlistForm from "./waitlist-form";

export const metadata: Metadata = {
  title: "SYNNR Apps — purpose-built software for oilfield service",
  description:
    "The SYNNR app marketplace. TallyShot is live — photograph a tally sheet, get clean Excel. LoadCheck, TicketFlow, and CertWatch are coming soon.",
};

export default function AppsPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head">
          <span className="eyebrow">The SYNNR app store</span>
          <h1 className="h2">Purpose-built oilfield apps, ready to use.</h1>
          <p className="lede">
            One platform, one login, one bill. Each app solves a boring, expensive
            problem in a service shop — pick one and start in minutes.
          </p>
        </div>

        <div className="appgrid">
          {PRODUCTS.map((p) => (
            <div key={p.slug} className={`appcard ${p.status}`}>
              <div className="appcard-top">
                <span className="appname">{p.name}</span>
                <span className={`status ${p.status}`}>{p.status === "live" ? "Live" : "Coming soon"}</span>
              </div>
              <p className="apptag">{p.tagline}</p>

              {p.status === "live" ? (
                <div className="appcard-foot">
                  <a className="btn btn-primary btn-sm" href={`/apps/${p.slug}`}>View app</a>
                  <a className="btn btn-ghost btn-sm" href="/ingest">Live demo</a>
                </div>
              ) : (
                <WaitlistForm slug={p.slug} name={p.name} />
              )}
            </div>
          ))}
        </div>

        <p className="apps-note mono">
          Building something specific for your operation? <a href="mailto:cadencain@darkstarops.com?subject=SYNNR%20app%20idea">Tell us</a> — the suite grows from real field problems.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
