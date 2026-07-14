import "../marketing.css";
import "../partners/partners.css";
import "./build.css";
import { SiteNav, SiteFooter } from "../site-chrome";
import BuildForm from "./build-form";

export const metadata = {
  title: "Custom software builds | SYNNR",
  description:
    "SYNNR builds custom software for oilfield and blue-collar operations — field tickets, invoicing, rental tracking, dispatch, digital forms. Built by a hand who's run the yard.",
};

const WORK = [
  { t: "Field tickets → invoices", d: "Kill the paper tickets and the weekend invoicing. Capture the job on a phone, bill it same day." },
  { t: "Rental / equipment tracking", d: "Know what iron is out, who's got it, and what it's earning — with billing days that add themselves up." },
  { t: "Dispatch & crew boards", d: "Stop scheduling by group text. One board, who's where, what rolls tomorrow." },
  { t: "Digital forms & inspections", d: "JSAs, DVIRs, inspection sheets — photos, signatures, searchable, out of the filing cabinet." },
  { t: "Job costing", d: "Know if a job made money the day it's done, not three months later." },
  { t: "Customer portals", d: "Give your operators a link instead of a phone call — status, docs, proof, self-serve." },
];

export default function BuildPage() {
  return (
    <div className="mkt">
      <SiteNav />
      <main className="section" id="build-page">
        <div className="container pt-wrap">

          {/* Head */}
          <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
            <span className="eyebrow">SYNNR · Custom builds</span>
            <h1 className="h2" style={{ marginTop: 8 }}>Software built by someone who&apos;s run the yard.</h1>
            <p className="lede" style={{ marginInline: 0, maxWidth: "70ch" }}>
              SYNNR builds custom software for oilfield and blue-collar operations. Not an agency guessing at your
              business from a laptop in a city — a hand who spent 5 years on Permian wireline and ships fast.
              You&apos;ve already seen the quality: <b>RollReady is ours.</b>
            </p>
          </div>

          {/* What we build */}
          <div>
            <h2 className="h3" style={{ marginBottom: 16 }}>What we build</h2>
            <div className="build-grid">
              {WORK.map((w) => (
                <div key={w.t} className="build-card">
                  <h3>{w.t}</h3>
                  <p>{w.d}</p>
                </div>
              ))}
            </div>
            <p className="muted" style={{ marginTop: 14, fontSize: 14 }}>
              Don&apos;t see yours? If it&apos;s a paper problem or a nightly grind in a service shop, it&apos;s probably
              buildable. Ask.
            </p>
          </div>

          {/* How it works */}
          <div className="pt-steps">
            <h2 className="h3">How it works</h2>
            <ol>
              <li><b>Tell us the headache.</b> One call. We figure out what&apos;s actually costing you time or money.</li>
              <li><b>You get a scope and a fixed price.</b> One page, in writing. No hourly meter, no surprise invoice.</li>
              <li><b>We build it — then we keep it running.</b> A build fee to ship it, a monthly retainer to host, fix, and improve it. You own the software; we keep it alive.</li>
            </ol>
            <p className="muted pt-note">
              Straight on pricing: small tools start around a few thousand to build; bigger systems (ticketing,
              invoicing, portals) run higher. Every project is a fixed number you approve before any code gets written,
              plus a monthly retainer. No project starts without a deposit — that&apos;s how you know we&apos;re both serious.
            </p>
          </div>

          {/* CTA + contact */}
          <div className="pt-cta-row">
            <div className="pt-card">
              <h2 className="h3">Tell us what to build</h2>
              <BuildForm />
            </div>
            <div className="pt-contact">
              <h3>Rather just talk?</h3>
              <p>Call or text Caden — he answers.</p>
              <a className="pt-phone" href="tel:4322500715">432-250-0715</a>
              <a className="pt-mail" href="mailto:cadencain@darkstarops.com">cadencain@darkstarops.com</a>
            </div>
          </div>

        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
