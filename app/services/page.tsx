import "../marketing.css";
import "../apps/apps.css";
import "./services.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import AuditForm from "./audit-form";

export const metadata = {
  title: "Custom Oilfield Operating Systems | SYNNR",
  description:
    "We audit one real workflow, then build a custom operating system into your oilfield service company — dispatch, loadouts, tickets, certs — and support it monthly. Free Operations Audit first.",
};

const ARROW = (
  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

const BUILD = [
  {
    name: "AI Ingestion Pipelines",
    body: "Turn messy real-world docs — PDFs, photos, Excel rate sheets, handwritten tallies — into clean, structured data. No manual entry.",
    note: "TallyShot is this engine, live now — try it free.",
  },
  {
    name: "Roll-Ready™ Readiness System",
    body: "Verify crew, truck, tools, certs, paperwork, and customer rules before the truck leaves the yard. Includes Vision AI loadout verification: the crew photographs the truck bed and the system confirms nothing's missing before dispatch.",
    note: null,
  },
  {
    name: "Intelligent Ticketing",
    body: "Digital pipelines that auto-price from your own rate sheets and capture e-signatures in the field, so the packet is billable the day the work's done.",
    note: null,
  },
];

const STEPS = [
  { n: "1", t: "Free Operations Audit", b: "Send us one real job packet or loadout list. We map the readiness gaps and put a dollar figure on them — free, this week." },
  { n: "2", t: "Pilot Build", b: "If the number's real, we build the system into your operation on one crew or yard. Live in ~3 weeks. Runs remote — works no matter where your shop is." },
  { n: "3", t: "Run & scale", b: "Monthly hosting, support, and a readiness report showing wrong trucks stopped and dollars saved. Add crews as you grow." },
];

const TIERS = [
  { name: "Pilot", price: "$6,000", per: "setup + $1,500/mo", scope: "One crew or yard." },
  { name: "Operation", price: "$10,000", per: "setup + $2,500/mo", scope: "Whole yard, multiple crews, day + night shift.", featured: true },
  { name: "Multi-yard", price: "Custom", per: "let's scope it", scope: "Multiple yards, regions, integrations." },
];

export default function ServicesPage() {
  return (
    <div className="mkt">
      <SiteNav />

      {/* Hero */}
      <section className="section svc-hero">
        <div className="container">
          <span className="eyebrow">Custom Builds</span>
          <h1 className="display">Custom operating systems for oilfield service companies.</h1>
          <p className="lede">
            Your dispatch, loadouts, tickets, and certs are duct-taped across a dozen apps that don&apos;t talk.
            We audit one real workflow, then build a system that fits how your shop actually runs.
          </p>
          <div className="svc-hero-cta">
            <a href="#audit" className="btn btn-primary">Get your free Operations Audit {ARROW}</a>
            <a href="/ingest" className="btn btn-ghost">See TallyShot live {ARROW}</a>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="section svc-problem">
        <div className="container">
          <span className="eyebrow">The problem</span>
          <p className="svc-problem-body">
            A crew can lose a whole day before the job starts: wrong gear loaded, a cert lapsed, a customer form missed,
            an invoice kicked back. Four people &quot;checked&quot; and everyone figured somebody else really looked.
            Nobody writes the day down, so it happens again next week — day rate running the whole time.
            Most shops are paying for 15 monthly apps and still flying blind on the one thing that costs them: <b>job readiness</b>.
          </p>
        </div>
      </section>

      {/* What we build */}
      <section className="section">
        <div className="container">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">What we build</span>
            <h2 className="h2">Three systems, built into how you already work.</h2>
          </div>
          <div className="svc-cards">
            {BUILD.map((c) => (
              <div key={c.name} className="svc-card">
                <h3>{c.name}</h3>
                <p>{c.body}</p>
                {c.note ? <p className="svc-card-note">{c.note} <a href="/ingest">Try it →</a></p> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="section">
        <div className="container">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">How it works</span>
            <h2 className="h2">Audit first. Build second. Prove it monthly.</h2>
          </div>
          <div className="svc-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="svc-step">
                <span className="svc-step-n">{s.n}</span>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="section">
        <div className="container">
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">Pricing</span>
            <h2 className="h2">Simple and honest.</h2>
          </div>
          <div className="svc-pricing">
            {TIERS.map((t) => (
              <div key={t.name} className={`svc-tier${t.featured ? " featured" : ""}`}>
                <span className="svc-tier-name">{t.name}</span>
                <div className="svc-tier-price">{t.price}<span> {t.per}</span></div>
                <p className="svc-tier-scope">{t.scope}</p>
              </div>
            ))}
          </div>
          <p className="svc-pricing-note">
            50% to start, month-to-month after. No lock-in. Free audit first — if it doesn&apos;t show real money, you don&apos;t buy.
          </p>
        </div>
      </section>

      {/* Lead capture */}
      <section className="section svc-audit" id="audit">
        <div className="container">
          <div className="svc-audit-card">
            <div className="svc-audit-copy">
              <span className="eyebrow">Free Operations Audit</span>
              <h2 className="h2">Get your free Operations Audit</h2>
              <p className="lede" style={{ marginInline: 0 }}>
                Send one real loadout list or field ticket. We map the readiness gaps and put a dollar figure on them — free, this week.
              </p>
            </div>
            <AuditForm />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
