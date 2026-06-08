// SYNNR marketing page markup (ported verbatim from the design prototype,
// with funnel links rewritten to app routes). Rendered via dangerouslySetInnerHTML
// and driven by MarketingScripts.
export const MARKETING_HTML = `
<div class="page-atmosphere" aria-hidden="true">
  <div class="bg-grid"></div>
  <div class="amb amb-1"></div>
  <div class="amb amb-2"></div>
</div>

<header class="nav" id="nav">
  <div class="nav-pill">
    <a class="brand" href="#top" aria-label="SYNNR">
      <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="url(#bm)"/>
        <circle cx="16" cy="16" r="2.4" fill="#060608"/>
        <defs><linearGradient id="bm" x1="2" y1="2" x2="30" y2="30"><stop stop-color="#f3ecdb"/><stop offset="1" stop-color="#ccbe9d"/></linearGradient></defs>
      </svg>
      <span class="wordmark">SYNNR</span>
    </a>
    <nav class="nav-links">
      <a href="#features">Features</a>
      <a href="#how">How it works</a>
      <a href="#testimonials">Testimonials</a>
      <a href="#roi">ROI</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </nav>
    <div class="nav-cta">
      <a href="#features" class="btn btn-ghost btn-sm">Explore SYNNR</a>
      <a href="/onboarding" class="btn btn-primary btn-sm">Request Early Access</a>
    </div>
  </div>
</header>

<main id="top">

<section class="hero section">
  <div class="container">
    <span class="pill-badge reveal"><span class="d"></span>Now in early access</span>
    <h1 class="display reveal" data-d="1">Revenue intelligence<br/>for <span class="grad">field operations</span></h1>
    <p class="lede reveal" data-d="2">SYNNR is the self-serve intelligence system that finds lost revenue, cleans job packets, validates pricing, and helps service companies get paid faster.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="/onboarding" class="btn btn-primary">Request Early Access
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="#features" class="btn btn-ghost">Explore SYNNR</a>
    </div>
    <div class="rating reveal" data-d="4">
      <span class="stars" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
      </span>
      <b>4.9</b><span>from field service operators</span>
    </div>

    <div class="hero-stage reveal" data-d="3">
      <div class="floor"></div>
      <div class="appwin">
        <aside class="app-side">
          <div class="app-brand">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="url(#am)"/><circle cx="16" cy="16" r="2.4" fill="#050506"/><defs><linearGradient id="am" x1="2" y1="2" x2="30" y2="30"><stop stop-color="#f3ecdb"/><stop offset="1" stop-color="#e7ddc7"/></linearGradient></defs></svg>
            <b>SYNNR</b>
          </div>
          <nav class="app-nav">
            <a class="on" data-view="dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Dashboard</a>
            <a data-view="audits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>Audits</a>
            <a data-view="pricebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Pricebook</a>
            <a data-view="risk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/></svg>Risk flags</a>
            <a data-view="packets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg>Packets</a>
          </nav>
          <div class="app-foot">
            <div class="t"><span class="dot"></span>SYNNR</div>
            <p>Operational brain connected</p>
          </div>
        </aside>
        <div class="app-main">
          <div class="app-top">
            <h3 id="appViewTitle">Dashboard</h3>
            <div class="app-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>Search jobs</div>
          </div>

          <div class="app-view on" data-view="dashboard">
          <div class="app-grid">
            <div class="balance-card">
              <div class="bc-head">
                <div>
                  <div class="bc-label">Recovered revenue · YTD</div>
                  <div class="bc-amount"><span data-count="284750" data-prefix="$">$284,750</span><span class="bc-delta">+47.3%</span></div>
                </div>
                <div class="period-toggle"><span>1D</span><span>7D</span><span>1M</span><span class="on">1Y</span></div>
              </div>
              <div class="linechart">
                <svg viewBox="0 0 760 200" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="lcfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28"/>
                      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
                    </linearGradient>
                  </defs>
                  <path d="M30,150 L90,135 L150,150 L210,110 L270,128 L330,88 L390,108 L450,72 L510,92 L570,58 L630,76 L690,44 L730,52 L730,190 L30,190 Z" fill="url(#lcfill)"/>
                  <path d="M30,150 L90,135 L150,150 L210,110 L270,128 L330,88 L390,108 L450,72 L510,92 L570,58 L630,76 L690,44 L730,52" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                  <circle cx="730" cy="52" r="4" fill="var(--accent)"/>
                </svg>
              </div>
              <div class="bc-months"><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span></div>
            </div>
            <div class="qpanel">
              <div class="qp-title">Recovery breakdown</div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="qn">Missed billables<small>142 across 1,204 jobs</small></div><div class="qv pos">+$148,200</div></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h7"/></svg></div><div class="qn">Rate corrections<small>37 pricebook conflicts</small></div><div class="qv pos">+$94,300</div></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/></svg></div><div class="qn">Backup recovered<small>61 packets repaired</small></div><div class="qv pos">+$42,250</div></div>
              <a href="/onboarding" class="btn btn-primary btn-sm">Run a new audit
                <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
            </div>
          </div>
          </div>

          <div class="app-view" data-view="audits">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Audit runs</span><span class="meta">Last 90 days</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>August cycle — Permian field ops</b><small>1,204 jobs reconciled</small></div><div class="vtrail"><span class="vval">+$284,750</span><span class="vpill ok"><span class="sd"></span>Complete</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>July cycle — Permian field ops</b><small>1,118 jobs reconciled</small></div><div class="vtrail"><span class="vval">+$241,300</span><span class="vpill ok"><span class="sd"></span>Complete</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Crane &amp; rigging re-audit</b><small>312 jobs · rate dispute sweep</small></div><div class="vtrail"><span class="vval">+$58,900</span><span class="vpill ok"><span class="sd"></span>Complete</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><div class="vmain"><b>Q3 standby sweep</b><small>890 jobs · awaiting your review</small></div><div class="vtrail"><span class="vval">+$132,400</span><span class="vpill warn"><span class="sd"></span>In review</span></div></div>
            </div>
            <div class="view-cta"><p><b>Each audit</b> reconciles every job against your invoices &amp; contracts.</p><a href="/onboarding" class="btn btn-primary btn-sm">Run a new audit<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          </div>

          <div class="app-view" data-view="pricebook">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Rate conflicts vs. contract</span><span class="meta">37 found</span></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>Crane service — 8 hr</b><small>Billed $180/hr → MSA $220/hr</small></div><div class="vtrail"><span class="vval">+$40/hr · 18 jobs</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>Standby labor</b><small>Billed $0 → MSA $95/hr</small></div><div class="vtrail"><span class="vval">+$95/hr · 12 jobs</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>Mobilization fee</b><small>Missing on 7 invoices</small></div><div class="vtrail"><span class="vval">$850 each</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></div><div class="vmain"><b>Environmental surcharge</b><small>Matches contract on all jobs</small></div><div class="vtrail"><span class="vpill ok"><span class="sd"></span>In line</span></div></div>
            </div>
            <div class="view-cta"><p><b>SYNNR maps</b> every line item to your price book &amp; MSA rate automatically.</p></div>
          </div>

          <div class="app-view" data-view="risk">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Jobs at risk</span><span class="meta">Needs attention</span></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg></div><div class="vmain"><b>#4821 · Unsigned ticket</b><small>Holds billing on completed job</small></div><div class="vtrail"><span class="vval">$4,570</span><span class="vpill dang"><span class="sd"></span>High</span></div></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="vmain"><b>#4790 · SLA breach risk</b><small>Invoice due in 6 hours</small></div><div class="vtrail"><span class="vval neutral">—</span><span class="vpill dang"><span class="sd"></span>High</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></svg></div><div class="vmain"><b>#4805 · Missing field photos</b><small>Packet incomplete · 4 of 7 docs</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>Medium</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>#4772 · Rate below MSA</b><small>Billed under contract rate</small></div><div class="vtrail"><span class="vval">$1,430</span><span class="vpill warn"><span class="sd"></span>Medium</span></div></div>
            </div>
            <div class="view-cta"><p><b>Risk flags</b> catch revenue-blocking issues before billing closes.</p></div>
          </div>

          <div class="app-view" data-view="packets">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Job packets</span><span class="meta">Completeness</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4833 · Hydro test — Pad 7</b><small>7 of 7 documents</small></div><div class="vtrail"><span class="vbar full"><i style="width:100%"></i></span><span class="vpill ok"><span class="sd"></span>Ready</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4821 · Crane lift — Site B</b><small>6 of 7 documents · missing signature</small></div><div class="vtrail"><span class="vbar"><i style="width:86%"></i></span><span class="vval neutral">86%</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4805 · Tank cleanout</b><small>4 of 7 documents · missing photos</small></div><div class="vtrail"><span class="vbar"><i style="width:57%"></i></span><span class="vval neutral">57%</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4799 · Pipeline inspection</b><small>5 of 7 documents</small></div><div class="vtrail"><span class="vbar"><i style="width:71%"></i></span><span class="vval neutral">71%</span></div></div>
            </div>
            <div class="view-cta"><p><b>Every packet</b> is rebuilt to be defensible and invoice-ready.</p></div>
          </div>

        </div>
      </div>
    </div>
  </div>
</section>

<section class="section tight container reveal">
  <div class="divider-label">Built for companies that make money with trucks, crews, tools &amp; field execution</div>
  <div style="display:flex;flex-wrap:wrap;gap:18px 40px;justify-content:space-between;align-items:center;margin-top:28px;opacity:.6;font-family:var(--font-mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-dim)">
    <span>Oilfield Service</span><span>Industrial</span><span>Construction</span><span>Equipment Rental</span><span>Field Maintenance</span><span>Logistics</span>
  </div>
</section>

<section class="section statement">
  <div class="container reveal">
    <p>The field does the work. <b>SYNNR</b> makes sure the revenue <span class="hl">survives the handoff</span> — turning scattered tickets, photos, pricing, and field notes into <b>invoice-ready proof.</b></p>
  </div>
</section>

<section class="section" id="features">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Revenue found before it disappears</span>
      <h2 class="h2">Find missed charges, wrong rates, missing proof, and dispute risk</h2>
      <p class="lede">A self-serve AI billing and job-packet intelligence system. Upload the mess; get back every charge, backed by proof.</p>
    </div>

    <div class="bento">
      <div class="cell span4 reveal" data-d="1">
        <div class="corner"></div>
        <div class="visual">
          <div class="console" style="box-shadow:none">
            <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>Revenue Leakage Detection</div></div>
            <div class="console-body" style="padding:16px">
              <div class="viz" style="margin:0;border:0;padding:0;background:none">
                <div class="bars" style="height:88px">
                  <div class="bar" style="height:40%"></div><div class="bar" style="height:55%"></div><div class="bar leak" style="height:90%"></div><div class="bar" style="height:48%"></div><div class="bar" style="height:64%"></div><div class="bar leak" style="height:82%"></div><div class="bar" style="height:44%"></div><div class="bar" style="height:60%"></div><div class="bar" style="height:70%"></div><div class="bar leak" style="height:96%"></div><div class="bar" style="height:52%"></div><div class="bar" style="height:68%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h3>Revenue Leakage Detection</h3>
        <p class="ct">Find missed billables, unbilled standby, and forgotten consumables across every job — before the invoice goes out.</p>
      </div>

      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="assetlist">
          <div class="asset"><div class="tk">RC</div><div class="nm">Standby hours<small>Ticket vs invoice</small></div><div class="vv"><span class="pos">+$1,430</span></div></div>
          <div class="asset"><div class="tk">RC</div><div class="nm">Rate below MSA<small>Contract #882</small></div><div class="vv"><span class="pos">+$2,180</span></div></div>
          <div class="asset"><div class="tk">RC</div><div class="nm">Consumables<small>42 line items</small></div><div class="vv"><span class="pos">+$960</span></div></div>
        </div>
        <h3>Invoice Risk Flags</h3>
        <p class="ct">Every job scored for missing signatures, weak backup, and disputes before you bill.</p>
      </div>

      <div class="cell span2 reveal" data-d="1">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6M8 14h8M8 17h5"/></svg></div>
        <h3>Job Packet Autopilot</h3>
        <p class="ct">Assemble a clean, defensible packet for every job — tickets, photos, rates, and sign-offs in one place.</p>
      </div>
      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></div>
        <h3>Pricebook Brain</h3>
        <p class="ct">Validate every line against your live pricebook, rate sheets, and customer agreements automatically.</p>
      </div>
      <div class="cell span2 reveal" data-d="3">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m6 17 3-2 2 1.5L16 13l4 4"/></svg></div>
        <h3>Photo &amp; Ticket Matching</h3>
        <p class="ct">Match field photos and tickets to the right job and line item — and surface the backup that's missing.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="split">
      <div class="split-copy reveal">
        <span class="eyebrow">Total control</span>
        <h2 class="h2">Your job data. One place.</h2>
        <p class="lede">Drag in tickets, invoices, photos, field notes, price books, rate sheets, agreements, and full job packets. SYNNR reads every artifact and reconciles it against your pricing and contracts.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Ingests messy, mixed-format job data</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Missing Backup Detection on every packet</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Customer-specific rate validation</li>
        </ul>
        <a href="/onboarding" class="btn btn-ghost">See it on your data
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="console">
          <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>Audit · Job #RC-4821</div><div class="console-tabs"><span class="on">Findings</span><span>Backup</span></div></div>
          <div class="console-body">
            <div class="rows">
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M12 2v6m0 8v6M4.9 7l4.2 2.4M14.9 14.6l4.2 2.4M19.1 7l-4.2 2.4M9.1 14.6 4.9 17"/></svg><div><div class="label">Unbilled standby hours</div><div class="sub">6.5 hrs · ticket vs invoice</div></div><div class="amt">+$1,430</div><div class="pill danger">Missed</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h5"/></svg><div><div class="label">Rate below MSA</div><div class="sub">Contract #882 · rigging</div></div><div class="amt">+$2,180</div><div class="pill warn">Underpriced</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M21 15l-5-5L5 21M3 3l18 18"/></svg><div><div class="label">Missing field photos</div><div class="sub">3 of 5 images absent</div></div><div class="amt">at risk</div><div class="pill danger">No backup</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><div><div class="label">Consumables reconciled</div><div class="sub">42 line items</div></div><div class="amt">+$960</div><div class="pill good">Recovered</div></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
              <div><div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">Recoverable on this job</div><div class="h3" style="color:var(--accent-ink);margin-top:5px">+$4,570</div></div>
              <span class="btn btn-primary btn-sm">Export packet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="split flip">
      <div class="split-copy reveal">
        <span class="eyebrow">Built for speed</span>
        <h2 class="h2">Audit every job. Instantly.</h2>
        <p class="lede">Self-serve. No integration project. Point SYNNR at the mess and it audits thousands of jobs in minutes — surfacing missed charges, wrong rates, and weak documentation.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Audits at the scale of your whole operation</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Reconciles against contracts &amp; pricebook</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Live recoverable-revenue totals</li>
        </ul>
        <a href="#how" class="btn btn-ghost">How it works
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="terminal">
          <div class="terminal-head"><div class="console-dots"><i></i><i></i><i></i></div><span class="mono" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-dim)">revenue-command — audit</span></div>
          <div class="terminal-body">
            <div class="ln"><span class="dim">$</span> <span class="cmd">synnr audit ./job-packets/april</span></div>
            <div class="ln"><span class="acc">›</span> ingesting 1,204 jobs … <span class="ok">done</span></div>
            <div class="ln"><span class="acc">›</span> matching photos + tickets … <span class="ok">done</span></div>
            <div class="ln"><span class="acc">›</span> validating rates vs pricebook … <span class="ok">done</span></div>
            <div class="ln"><span class="flag">!</span> 142 missed billables found</div>
            <div class="ln"><span class="flag">!</span> 37 rate mismatches flagged</div>
            <div class="ln"><span class="flag">!</span> 61 packets missing backup</div>
            <div class="ln" style="margin-top:8px"><span class="acc">▣</span> recoverable revenue: <span class="acc">$284,750</span></div>
            <div class="ln"><span class="dim">$</span> <span class="cmd">synnr export --invoice-ready</span><span style="display:inline-block;width:8px;height:15px;background:var(--accent);margin-left:4px;vertical-align:-2px;animation:mkt-pulse 1.1s steps(1) infinite"></span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="how">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">How it works</span>
      <h2 class="h2">Three steps to recovered revenue</h2>
      <p class="lede">From scattered job data to an invoice-ready packet — self-serve, in an afternoon.</p>
    </div>
    <div class="steps3">
      <div class="step3 reveal" data-d="1">
        <span class="bn">1</span>
        <div class="visual">
          <div style="display:flex;flex-direction:column;gap:8px;width:100%;align-self:center">
            <div class="asset"><div class="tk">↑</div><div class="nm">field_ticket.pdf<small>uploading</small></div><div class="vv"><span style="color:var(--good)">100%</span></div></div>
            <div class="asset"><div class="tk">↑</div><div class="nm">IMG_3391.heic<small>uploading</small></div><div class="vv"><span style="color:var(--good)">100%</span></div></div>
            <div class="asset"><div class="tk">↑</div><div class="nm">rate_sheet.xlsx<small>uploading</small></div><div class="vv"><span class="acc" style="color:var(--accent-ink)">62%</span></div></div>
          </div>
        </div>
        <h4>Upload messy job data</h4>
        <p>Drag in tickets, invoices, photos, field notes, price books, rate sheets, and full job packets.</p>
      </div>
      <div class="step3 reveal" data-d="2">
        <span class="bn">2</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--fg-dim);line-height:2">
            <div><span style="color:var(--accent-ink)">›</span> reading 1,204 jobs</div>
            <div><span style="color:var(--accent-ink)">›</span> reconciling pricing</div>
            <div><span style="color:var(--good)">✓</span> 142 issues found</div>
          </div>
        </div>
        <h4>AI audits the job</h4>
        <p>Every artifact is read and reconciled against your pricing and contracts to flag what's wrong.</p>
      </div>
      <div class="step3 reveal" data-d="3">
        <span class="bn">3</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center">
            <div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">Recoverable</div>
            <div style="font-family:var(--font-display);font-size:38px;font-weight:600;color:var(--accent-ink);letter-spacing:-.03em;margin-top:6px">+$284,750</div>
            <div style="margin-top:10px"><span class="pill good">Invoice-ready</span></div>
          </div>
        </div>
        <h4>Export invoice-ready packet</h4>
        <p>Get a clean, defensible packet — every charge backed by proof — ready to bill and get paid.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Benefits</span>
      <h2 class="h2">Why field teams run on SYNNR</h2>
      <p class="lede">Serious, self-serve intelligence for the messy reality of field service operations.</p>
    </div>
    <div class="benefits">
      <div class="benefit reveal" data-d="1"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><h4>Find missed revenue</h4><p>Recover charges that slip through between the field and the invoice.</p></div>
      <div class="benefit reveal" data-d="2"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h10M4 18h7"/><path d="m15 15 2.5 2.5L22 13"/></svg></div><h4>Validate pricing</h4><p>Enforce MSA and customer-specific rates on every single line item.</p></div>
      <div class="benefit reveal" data-d="3"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg></div><h4>Catch invoice risk</h4><p>Flag missing signatures and weak backup before disputes happen.</p></div>
      <div class="benefit reveal" data-d="4"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h4>Get paid faster</h4><p>Bill clean, defensible packets and shorten the cash cycle.</p></div>
    </div>
  </div>
</section>

<section class="section" id="testimonials">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Testimonials</span>
      <h2 class="h2">Trusted by operators who run on the field</h2>
    </div>
    <div class="tcard reveal" data-d="1" id="tcard">
      <div class="tslide on">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“SYNNR found six figures of missed standby and consumables in our first audit. The backup was always there — we just couldn't see it before billing.”</blockquote>
        <div class="who"><div class="av">RM</div><div class="nm"><b>Ray Mendez</b><span>VP Operations · oilfield services</span></div></div>
      </div>
      <div class="tslide">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“Our techs move fast and paperwork lags. SYNNR closes the gap — rate mismatches against the MSA get flagged before the invoice ever goes out.”</blockquote>
        <div class="who"><div class="av">DK</div><div class="nm"><b>Dana Kohl</b><span>Controller · industrial contractor</span></div></div>
      </div>
      <div class="tslide">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“Self-serve was the selling point. We connected our job packets and had recoverable revenue on screen the same afternoon — no integration project.”</blockquote>
        <div class="who"><div class="av">TW</div><div class="nm"><b>Tara Whitlock</b><span>Owner · equipment rental &amp; service</span></div></div>
      </div>
      <div class="tnav">
        <button id="tprev" aria-label="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M15 18l-6-6 6-6"/></svg></button>
        <div class="dots"><i class="on"></i><i></i><i></i></div>
        <button id="tnext" aria-label="Next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16"><path d="M9 6l6 6-6 6"/></svg></button>
      </div>
    </div>
  </div>
</section>

<section class="section" id="roi">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">ROI calculator</span>
      <h2 class="h2">See what you're leaving on the table.</h2>
      <p class="lede">Estimate the revenue slipping between your field and your invoices — and what SYNNR puts back.</p>
    </div>
    <div class="roi-card reveal" data-d="1">
      <div class="roi-inputs">
        <div class="roi-control">
          <label>Jobs per month <b id="roiJobsV">750</b></label>
          <input type="range" id="roiJobs" min="50" max="5000" step="25" value="750" />
          <div class="hint">Tickets, work orders &amp; service calls</div>
        </div>
        <div class="roi-control">
          <label>Average invoice value <b id="roiAvgV">$2,800</b></label>
          <input type="range" id="roiAvg" min="250" max="25000" step="50" value="2800" />
          <div class="hint">Typical billed amount per job</div>
        </div>
        <div class="roi-control">
          <label>Estimated revenue leakage <b id="roiLeakV">2.5%</b></label>
          <input type="range" id="roiLeak" min="1" max="6" step="0.5" value="2.5" />
          <div class="hint">Industry average runs 2&ndash;5% of billings</div>
        </div>
      </div>
      <div class="roi-output">
        <div class="roi-out-label">SYNNR recovers ≈</div>
        <div class="roi-big" id="roiRecovered">$378,000</div>
        <div class="roi-sub">per year, from revenue you're currently losing</div>
        <div class="roi-rows">
          <div class="roi-row"><span class="k">Annual leakage detected</span><span class="v" id="roiLeakAnnual">$630,000</span></div>
          <div class="roi-row"><span class="k">Recommended plan</span><span class="v" id="roiPlan">Command · $90,000/yr</span></div>
          <div class="roi-row hl"><span class="k">Net annual gain</span><span class="v" id="roiNet">$288,000</span></div>
          <div class="roi-row"><span class="k">Return on subscription</span><span class="v"><span id="roiMultiple">4.2×</span> · pays back in <span id="roiPayback">~12 weeks</span></span></div>
        </div>
        <div class="roi-cta">
          <a href="/checkout?plan=command" id="roiCta" class="btn btn-primary">Start recovering — choose your plan
            <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          <p class="mono" style="margin-top:14px;font-size:11.5px;color:var(--fg-faint);text-align:center">Estimate only · backed by SYNNR's 30-day ROI guarantee</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="pricing">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Pricing</span>
      <h2 class="h2">Pricing that scales with what you recover.</h2>
      <p class="lede">Most operations recover 20–40× their plan in the first quarter. If SYNNR doesn't find more than it costs, you don't pay — guaranteed.</p>
      <div class="model-toggle" role="tablist" style="margin-top:26px">
        <button class="on" data-model="selfserve">Self-serve</button>
        <button data-model="performance">Performance</button>
      </div>
      <div class="toggle" id="cycleToggle" role="tablist">
        <button class="on" data-cycle="monthly">Monthly</button>
        <button data-cycle="yearly">Yearly <span class="save">20% OFF</span></button>
      </div>
    </div>
    <div id="planSelfserve">
    <div class="prices">
      <div class="price reveal" data-d="1">
        <div class="tier">Recover</div>
        <div class="amt"><span class="n" data-m="$2,500" data-y="$2,000">$2,500</span><span class="per">/ month</span></div>
        <p class="desc">For single-crew operations putting a stop to leakage.</p>
        <a href="/checkout?plan=recover" class="btn btn-ghost">Request access</a>
        <div class="feats">
          <div class="fh">Included</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Up to 500 jobs / month</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Revenue Leakage Detection</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Invoice-ready packet export</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Email support</li>
        </div>
      </div>
      <div class="price popular reveal" data-d="2">
        <div class="pop-tag">Popular</div>
        <div class="tier">Command</div>
        <div class="amt"><span class="n" data-m="$7,500" data-y="$6,000">$7,500</span><span class="per">/ month</span></div>
        <p class="desc">For multi-crew operations recovering at full scale.</p>
        <a href="/checkout?plan=command" class="btn btn-primary">Request access</a>
        <div class="feats">
          <div class="fh">Everything in Recover, plus</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Unlimited jobs &amp; packets</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Pricebook Brain &amp; rate validation</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Photo &amp; ticket matching</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Invoice risk scoring</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Priority support</li>
        </div>
      </div>
      <div class="price reveal" data-d="3">
        <div class="tier">Enterprise</div>
        <div class="amt"><span class="n">Custom</span></div>
        <p class="desc">For multi-site fleets and high-volume recovery.</p>
        <a href="/onboarding" class="btn btn-ghost">Talk to us</a>
        <div class="feats">
          <div class="fh">Everything in Command, plus</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>SYNNR data unification</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Dedicated success manager</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Custom integrations &amp; SSO</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Performance-based pricing option</li>
        </div>
      </div>
    </div>
    </div>

    <div id="planPerformance" hidden>
      <div class="perf-panel">
        <div class="perf-left">
          <span class="pp-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>Performance pricing</span>
          <h3>You keep 85%. We earn 15% &mdash; only on what&rsquo;s collected.</h3>
          <p class="pp-lede">For mid-market and multi-site operators. A small platform fee for the system and your recovery analyst, plus a share of the revenue SYNNR recovers and you actually bank.</p>
          <div class="pp-terms">
            <div class="pp-term"><div class="k">Platform fee</div><div class="v">$1,500<small>/mo</small></div><div class="x">System, analyst &amp; support</div></div>
            <div class="pp-term"><div class="k">Performance fee</div><div class="v">15%<small> collected</small></div><div class="x">Only on dollars you recover</div></div>
          </div>
          <ul class="pp-list">
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg><span><b>Pay only on collected dollars</b> &mdash; not flagged, not billed. Banked.</span></li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg><span><b>Aligned by design</b> &mdash; we earn when you do, nothing when we don&rsquo;t.</span></li>
            <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg><span><b>Scales with you</b> &mdash; no per-seat math, no job caps.</span></li>
          </ul>
        </div>
        <div class="perf-right">
          <div class="pr-label">Your annual recovered revenue</div>
          <div class="perf-slider">
            <div class="pv" id="perfRecovered">$378,000</div>
            <input type="range" id="perfRange" min="100000" max="3000000" step="1000" value="378000" />
            <div class="pr-hint">Drag to model your split</div>
          </div>
          <div class="split-bar">
            <div class="seg you"><span class="pct">You keep 85%</span><span class="amt2" id="perfYou">$321,300</span></div>
            <div class="seg syn"><span class="pct">15%</span><span class="amt2" id="perfSyn">$56,700</span></div>
          </div>
          <div class="split-legend">
            <div class="sl-row"><span class="k"><span class="sw" style="background:var(--accent)"></span>You keep</span><span class="v" id="perfYou2">$321,300</span></div>
            <div class="sl-row"><span class="k"><span class="sw" style="background:var(--ochre)"></span>SYNNR fee (15%)</span><span class="v" id="perfSyn2">$56,700</span></div>
            <div class="sl-row"><span class="k"><span class="sw" style="background:var(--fg-faint)"></span>Platform ($1,500/mo)</span><span class="v">$18,000</span></div>
            <div class="sl-row net"><span class="k">Net gain to you</span><span class="v" id="perfNet">$303,300</span></div>
          </div>
          <div class="perf-cta">
            <a href="#roi" class="btn btn-ghost btn-sm">Open ROI calculator</a>
            <a href="/onboarding" class="btn btn-primary btn-sm">Start with a pilot<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="faq">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Common questions</span>
      <h2 class="h2">All you need to know</h2>
    </div>
    <div class="faq reveal" data-d="1">
      <div class="qa"><button>What is SYNNR?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>SYNNR is a self-serve AI billing and job-packet intelligence system. You upload messy job data and it finds missed billables, wrong rates, missing backup, and invoice-risk issues before you bill.</p></div></div>
      <div class="qa"><button>What kind of data can I upload?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Tickets, invoices, photos, field notes, price books, rate sheets, customer agreements, and full job packets — in mixed formats. The system reads each artifact and reconciles it against your pricing and contracts.</p></div></div>
      <div class="qa"><button>How fast can I get started?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>It's self-serve by design. There's no integration project — create a workspace, upload or connect your data, and run your first audit the same afternoon.</p></div></div>
      <div class="qa"><button>Is my data secure?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Your job data is encrypted in transit and at rest, never used to train shared models, and processed under a non-custodial architecture. You stay in full control of your data and pricing — always.</p></div></div>
      <div class="qa"><button>Who is it built for?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Asset-heavy operations that run on field execution — oilfield service, industrial contractors, construction service, equipment rental &amp; service, and field maintenance companies. If money is made in the field and billed in the office, it's built for you.</p></div></div>
    </div>
  </div>
</section>

<section class="section final" id="cta">
  <div class="container">
    <div class="final-card reveal">
      <div class="glow"></div>
      <span class="eyebrow" style="justify-content:center;margin-bottom:18px">Request Early Access</span>
      <h2 class="display">Stop leaking revenue<br/>from completed jobs.</h2>
      <p class="lede">Find missed charges before the invoice goes out. Turn scattered tickets, photos, pricing, and field notes into invoice-ready proof — and get paid for the work you already did.</p>
      <div class="final-cta">
        <a href="/onboarding" class="btn btn-primary">Request Early Access
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="#features" class="btn btn-ghost">Explore SYNNR</a>
      </div>
    </div>
  </div>
</section>

</main>

<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a class="brand" href="#top">
          <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="url(#fm)"/><circle cx="16" cy="16" r="2.4" fill="#060608"/><defs><linearGradient id="fm" x1="2" y1="2" x2="30" y2="30"><stop stop-color="#f3ecdb"/><stop offset="1" stop-color="#ccbe9d"/></linearGradient></defs></svg>
          <span class="wordmark">SYNNR</span>
        </a>
        <p class="blurb">Revenue intelligence for companies that run on trucks, crews, equipment, tickets, documents, pricing, and field execution.</p>
      </div>
      <div><h5>Product</h5><ul><li><a href="#features">SYNNR</a></li><li><a href="#how">How it works</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#faq">FAQ</a></li></ul></div>

      <div><h5>Company</h5><ul><li><a href="/onboarding">Early Access</a></li><li><a href="mailto:hello@synnr.io">Contact</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 SYNNR</span>
      <span>The field does the work. SYNNR makes sure the revenue survives the handoff.</span>
    </div>
  </div>
</footer>
`;
