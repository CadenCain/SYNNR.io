import "../../marketing.css";
import "../apps.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import { SiteNav, SiteFooter } from "../../site-chrome";

export const metadata: Metadata = {
  title: "TallyShot — photograph a tally sheet, get clean Excel",
  description:
    "TallyShot turns a photo of a handwritten casing/tubing tally sheet into clean Excel — every shaky digit flagged for review. Per-seat, 14-day free trial.",
};

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>
);

export default function TallyShotPage() {
  const p = getProduct("tallyshot");
  if (!p) notFound();
  const bands = p.pricing.bands ?? [];

  return (
    <div className="mkt">
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="section container product-hero">
          <span className="pill-badge"><span className="d" />TallyShot · live now</span>
          <h1 className="display">Stop keying tally sheets<br />by <span className="grad">hand</span>.</h1>
          <p className="lede">
            Photograph a handwritten casing/tubing tally sheet and get clean Excel
            back — subtotals, grand total, and every shaky digit flagged for a quick
            human check. Built for the hands and office staff who key counts all day.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="/checkout?product=tallyshot&seats=1">Start free trial
              <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
            <a className="btn btn-ghost" href="/demo">Try the live demo</a>
          </div>
          <p className="mono micro">14-day free trial · per seat · cancel anytime</p>
        </section>

        {/* The flagged-digit catch — the whole value prop */}
        <section className="section container">
          <div className="head">
            <span className="eyebrow">Why it's trustworthy</span>
            <h2 className="h2">It reads the clean digits — and flags the shaky ones.</h2>
            <p className="lede">Perfect OCR on truck-paper is a fantasy. TallyShot never silently guesses: anything it isn't sure about is flagged for you to confirm, so the total you export is one you can stand behind.</p>
          </div>
          <div className="demo-card">
            <div className="demo-row demo-head"><span>Joint</span><span>Read</span><span>Length</span><span>Status</span></div>
            <div className="demo-row ok"><span>45</span><span className="mono">3234</span><span className="mono">32.34 ft</span><span className="tag ok">Trusted</span></div>
            <div className="demo-row ok"><span>46</span><span className="mono">3230</span><span className="mono">32.30 ft</span><span className="tag ok">Trusted</span></div>
            <div className="demo-row flag"><span>47</span><span className="mono">3072</span><span className="mono">30.72 ft</span><span className="tag flag">Range — confirm</span></div>
            <div className="demo-row warn"><span>73</span><span className="mono">3233?</span><span className="mono">32.33 ft</span><span className="tag warn">Low confidence</span></div>
            <div className="demo-row ok"><span>74</span><span className="mono">3236</span><span className="mono">32.36 ft</span><span className="tag ok">Trusted</span></div>
            <div className="demo-foot">
              <span>96 of 100 trusted · 4 flagged for review</span>
              <span className="mono">Grand total pending review</span>
            </div>
          </div>
        </section>

        {/* How */}
        <section className="section container">
          <div className="head">
            <span className="eyebrow">How it works</span>
            <h2 className="h2">Photo in. Clean Excel out.</h2>
          </div>
          <div className="steps3">
            <div className="step3"><div className="sn">1</div><h3 className="h3">Snap the sheet</h3><p className="muted">Photograph the tally sheet from your phone — MKS form, printed grid, or a field notebook.</p></div>
            <div className="step3"><div className="sn">2</div><h3 className="h3">Confirm the flags</h3><p className="muted">TallyShot parses the implied decimal and flags any digit it isn't sure about. Tap to confirm.</p></div>
            <div className="step3"><div className="sn">3</div><h3 className="h3">Export to Excel</h3><p className="muted">Get a clean workbook — per-10 subtotals, grand total, flagged rows marked — in your template.</p></div>
          </div>
        </section>

        {/* Pricing — primary, from the catalog */}
        <section className="section container" id="pricing">
          <div className="head">
            <span className="eyebrow">TallyShot pricing</span>
            <h2 className="h2">Per seat. Buy one, or fifty.</h2>
            <p className="lede">A one-man shop buys a single seat; a fleet buys fifty — same flow, volume discounts apply automatically. Each seat includes {p.pricing.includedQuotaPerSeat} sheets/mo, pooled across your org.</p>
          </div>

          <div className="bandtable">
            {bands.map((b) => {
              const selfServe = b.minSeats <= (p.pricing.selfServeMaxSeats ?? Infinity);
              return (
                <div key={b.minSeats} className={`bandrow ${selfServe ? "" : "enterprise"}`}>
                  <span className="bandlabel">{b.label}</span>
                  <span className="bandprice">
                    {b.pricePerSeatUsd != null ? <><b>${b.pricePerSeatUsd}</b> <span className="per">/ user / mo</span></> : <b>Talk to us</b>}
                  </span>
                  <span className="bandcta">
                    {selfServe && b.pricePerSeatUsd != null ? (
                      <a className="btn btn-ghost btn-sm" href={`/checkout?product=tallyshot&seats=${b.minSeats}`}>Start free trial</a>
                    ) : (
                      <a className="btn btn-ghost btn-sm" href="mailto:cadencain@darkstarops.com?subject=SYNNR%20TallyShot%20(50%2B%20seats)">Contact sales</a>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <ul className="pricing-incl">
            <li>{CHECK}{p.pricing.includedQuotaPerSeat} sheets / seat / month, pooled across your org</li>
            <li>{CHECK}${p.pricing.overagePerUnitUsd?.toFixed(2)} per extra sheet beyond the pooled quota</li>
            <li>{CHECK}{p.pricing.trialDays}-day free trial · cancel anytime from your billing portal</li>
            <li>{CHECK}Invite your hands and assign seats from one account</li>
          </ul>
        </section>

        <section className="section final" id="cta">
          <div className="container">
            <div className="final-card">
              <div className="glow" />
              <span className="eyebrow" style={{ justifyContent: "center", marginBottom: 18 }}>TallyShot</span>
              <h2 className="display">See it on your own sheet.</h2>
              <p className="lede">Try the live reader free — no account — or start your 14-day trial and put it to work this week.</p>
              <div className="final-cta">
                <a className="btn btn-primary" href="/demo">Try the live demo
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </a>
                <a className="btn btn-ghost" href="/checkout?product=tallyshot&seats=1">Start free trial</a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
