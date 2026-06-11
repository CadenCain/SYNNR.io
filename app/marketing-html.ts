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
    <h1 class="display reveal" data-d="1">Job readiness<br/>for <span class="grad">field operations</span></h1>
    <p class="lede reveal" data-d="2">SYNNR verifies the crew, truck, tools, certs, inventory, paperwork, and billing backup are ready — before the truck leaves the yard and before the invoice goes out.</p>
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
            <a data-view="audits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>Jobs</a>
            <a data-view="pricebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Certs</a>
            <a data-view="risk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/></svg>Risk flags</a>
            <a data-view="packets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg>Packets</a>
          </nav>
          <div class="app-foot">
            <div class="t"><span class="dot"></span>SYNNR</div>
            <p>Readiness brain connected</p>
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
                  <div class="bc-label">Failure costs avoided · YTD</div>
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
              <div class="qp-title">Readiness breakdown</div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="qn">Blocked jobs caught<small>38 before dispatch</small></div><div class="qv pos">+$148,200</div></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h7"/></svg></div><div class="qn">Loadout gaps fixed<small>57 tools &amp; consumables</small></div><div class="qv pos">+$94,300</div></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/></svg></div><div class="qn">Packets made billable<small>61 completed pre-invoice</small></div><div class="qv pos">+$42,250</div></div>
              <a href="/onboarding" class="btn btn-primary btn-sm">Run a readiness check
                <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
            </div>
          </div>
          </div>

          <div class="app-view" data-view="audits">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Readiness checks</span><span class="meta">Last 90 days</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>August cycle — Permian field ops</b><small>1,204 jobs checked</small></div><div class="vtrail"><span class="vval">96% ready</span><span class="vpill ok"><span class="sd"></span>Complete</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>July cycle — Permian field ops</b><small>1,118 jobs checked</small></div><div class="vtrail"><span class="vval">94% ready</span><span class="vpill ok"><span class="sd"></span>Complete</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Crane &amp; rigging cert sweep</b><small>312 jobs · expirations checked</small></div><div class="vtrail"><span class="vval">9 blocked</span><span class="vpill ok"><span class="sd"></span>Complete</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><div class="vmain"><b>Q3 loadout review</b><small>890 jobs · awaiting your review</small></div><div class="vtrail"><span class="vval">31 at risk</span><span class="vpill warn"><span class="sd"></span>In review</span></div></div>
            </div>
            <div class="view-cta"><p><b>Each check</b> verifies crew, certs, tools, paperwork &amp; billing backup.</p><a href="/onboarding" class="btn btn-primary btn-sm">Run a readiness check<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          </div>

          <div class="app-view" data-view="pricebook">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Certs &amp; inspections</span><span class="meta">12 expiring</span></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>J. Alvarez — H2S Clear</b><small>Expires in 9 days · on 3 scheduled jobs</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>At risk</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>Crane 14 — annual inspection</b><small>Due in 6 days · assigned tomorrow</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>At risk</span></div></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>M. Ross — rigging cert</b><small>Expired 12 days ago · pulls him off 2 jobs</small></div><div class="vtrail"><span class="vpill dang"><span class="sd"></span>Blocked</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></div><div class="vmain"><b>Crew B-7 — all certs current</b><small>Cleared for the full schedule</small></div><div class="vtrail"><span class="vpill ok"><span class="sd"></span>Ready</span></div></div>
            </div>
            <div class="view-cta"><p><b>SYNNR connects</b> certs and inspections to tomorrow's jobs automatically.</p></div>
          </div>

          <div class="app-view" data-view="risk">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Jobs at risk</span><span class="meta">Needs attention</span></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg></div><div class="vmain"><b>#4821 · Unsigned ticket</b><small>Holds billing on completed job</small></div><div class="vtrail"><span class="vval">$4,570</span><span class="vpill dang"><span class="sd"></span>High</span></div></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg></div><div class="vmain"><b>#4790 · Customer form missing</b><small>Required by MSA before work starts</small></div><div class="vtrail"><span class="vval neutral">—</span><span class="vpill dang"><span class="sd"></span>High</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></svg></div><div class="vmain"><b>#4805 · Missing field photos</b><small>Packet incomplete · 4 of 7 docs</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>Medium</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="vmain"><b>#4772 · Consumables low</b><small>Below required quantity for job type</small></div><div class="vtrail"><span class="vval">restock</span><span class="vpill warn"><span class="sd"></span>Medium</span></div></div>
            </div>
            <div class="view-cta"><p><b>Risk flags</b> catch job-blocking issues before the crew rolls.</p></div>
          </div>

          <div class="app-view" data-view="packets">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Job packets</span><span class="meta">Completeness</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4833 · Hydro test — Pad 7</b><small>7 of 7 documents</small></div><div class="vtrail"><span class="vbar full"><i style="width:100%"></i></span><span class="vpill ok"><span class="sd"></span>Ready</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4821 · Crane lift — Site B</b><small>6 of 7 documents · missing signature</small></div><div class="vtrail"><span class="vbar"><i style="width:86%"></i></span><span class="vval neutral">86%</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4805 · Tank cleanout</b><small>4 of 7 documents · missing photos</small></div><div class="vtrail"><span class="vbar"><i style="width:57%"></i></span><span class="vval neutral">57%</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>#4799 · Pipeline inspection</b><small>5 of 7 documents</small></div><div class="vtrail"><span class="vbar"><i style="width:71%"></i></span><span class="vval neutral">71%</span></div></div>
            </div>
            <div class="view-cta"><p><b>Every packet</b> is verified complete and billable before it goes out.</p></div>
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
    <p>A job can fail before it starts. <b>SYNNR</b> checks the crew, truck, tools, certs, paperwork, and billing backup <span class="hl">before the job moves forward</span> — and tells you exactly <b>what to fix.</b></p>
  </div>
</section>

<section class="section" id="features">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Failures stopped before they happen</span>
      <h2 class="h2">Catch missing tools, expired certs, incomplete packets, and unbillable work</h2>
      <p class="lede">Field-operations readiness for service companies. Upload one job workflow; get back a readiness report that catches what would have gone wrong.</p>
    </div>

    <div class="bento">
      <div class="cell span4 reveal" data-d="1">
        <div class="corner"></div>
        <div class="visual">
          <div class="console" style="box-shadow:none">
            <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>Job Readiness Score</div></div>
            <div class="console-body" style="padding:16px">
              <div class="viz" style="margin:0;border:0;padding:0;background:none">
                <div class="bars" style="height:88px">
                  <div class="bar" style="height:40%"></div><div class="bar" style="height:55%"></div><div class="bar leak" style="height:90%"></div><div class="bar" style="height:48%"></div><div class="bar" style="height:64%"></div><div class="bar leak" style="height:82%"></div><div class="bar" style="height:44%"></div><div class="bar" style="height:60%"></div><div class="bar" style="height:70%"></div><div class="bar leak" style="height:96%"></div><div class="bar" style="height:52%"></div><div class="bar" style="height:68%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h3>Job Readiness Score</h3>
        <p class="ct">Every job scored Ready, At Risk, or Blocked — across crew, truck, tools, inventory, paperwork, and billing backup.</p>
      </div>

      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="assetlist">
          <div class="asset"><div class="tk">OK</div><div class="nm">Crew certs<small>Crew B-7 · all current</small></div><div class="vv"><span class="pos">Ready</span></div></div>
          <div class="asset"><div class="tk">!</div><div class="nm">Torque wrench #12<small>Calibration due in 6 days</small></div><div class="vv"><span>At risk</span></div></div>
          <div class="asset"><div class="tk">✕</div><div class="nm">Customer form<small>Required by MSA #882</small></div><div class="vv"><span>Blocked</span></div></div>
        </div>
        <h3>Loadout Checklists</h3>
        <p class="ct">Tools, consumables, truck items, and paperwork generated from job type and customer — checked before the truck leaves.</p>
      </div>

      <div class="cell span2 reveal" data-d="1">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6M8 14h8M8 17h5"/></svg></div>
        <h3>Field Packet Completeness</h3>
        <p class="ct">Tickets, photos, forms, and signatures tracked to 100% complete — so billing never chases the crew.</p>
      </div>
      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></div>
        <h3>Cert &amp; Asset Tracker</h3>
        <p class="ct">Employee certs, truck inspections, and tool calibrations — with expirations tied to upcoming jobs.</p>
      </div>
      <div class="cell span2 reveal" data-d="3">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m6 17 3-2 2 1.5L16 13l4 4"/></svg></div>
        <h3>Customer Rule Library</h3>
        <p class="ct">Every customer's required forms, photos, codes, and billing rules — matched to each job automatically.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="split">
      <div class="split-copy reveal">
        <span class="eyebrow">Total control</span>
        <h2 class="h2">Your operation. One readiness brain.</h2>
        <p class="lede">Drag in loadout lists, crew certs, truck inventory, job packets, tickets, photos, customer requirements, and billing rules. SYNNR turns them into readiness checks for every job.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Ingests messy, mixed-format job data</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Completeness checks on every job packet</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Customer rules matched to every job</li>
        </ul>
        <a href="/onboarding" class="btn btn-ghost">See it on your data
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="console">
          <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>Readiness · Job #RC-4821</div><div class="console-tabs"><span class="on">Checks</span><span>Packet</span></div></div>
          <div class="console-body">
            <div class="rows">
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M12 2v6m0 8v6M4.9 7l4.2 2.4M14.9 14.6l4.2 2.4M19.1 7l-4.2 2.4M9.1 14.6 4.9 17"/></svg><div><div class="label">Rigger cert expired</div><div class="sub">M. Ross · required for crane lift</div></div><div class="amt">blocked</div><div class="pill danger">Crew</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h5"/></svg><div><div class="label">Torque wrench calibration</div><div class="sub">Tool #T-12 · due in 6 days</div></div><div class="amt">at risk</div><div class="pill warn">Tools</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M21 15l-5-5L5 21M3 3l18 18"/></svg><div><div class="label">Missing field photos</div><div class="sub">3 of 5 images absent</div></div><div class="amt">at risk</div><div class="pill danger">No backup</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><div><div class="label">Consumables confirmed</div><div class="sub">42 line items loaded</div></div><div class="amt">ready</div><div class="pill good">Loadout</div></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
              <div><div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">Job status</div><div class="h3" style="color:var(--accent-ink);margin-top:5px">At Risk — 4 fixes</div></div>
              <span class="btn btn-primary btn-sm">Export readiness report</span>
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
        <h2 class="h2">Check every job. Before it rolls.</h2>
        <p class="lede">Self-serve. No integration project. Point SYNNR at tomorrow's jobs and it verifies crews, certs, tools, inventory, paperwork, and billing backup in minutes.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Checks at the scale of your whole operation</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Connects certs &amp; inspections to scheduled jobs</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Live Ready / At Risk / Blocked status per job</li>
        </ul>
        <a href="#how" class="btn btn-ghost">How it works
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="terminal">
          <div class="terminal-head"><div class="console-dots"><i></i><i></i><i></i></div><span class="mono" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-dim)">job-readiness — check</span></div>
          <div class="terminal-body">
            <div class="ln"><span class="dim">$</span> <span class="cmd">synnr check ./jobs/tomorrow</span></div>
            <div class="ln"><span class="acc">›</span> loading 38 scheduled jobs … <span class="ok">done</span></div>
            <div class="ln"><span class="acc">›</span> verifying crew certs … <span class="ok">done</span></div>
            <div class="ln"><span class="acc">›</span> checking loadouts vs job type … <span class="ok">done</span></div>
            <div class="ln"><span class="flag">!</span> 3 jobs blocked — expired certs</div>
            <div class="ln"><span class="flag">!</span> 5 loadouts missing required tools</div>
            <div class="ln"><span class="flag">!</span> 7 packets incomplete from last week</div>
            <div class="ln" style="margin-top:8px"><span class="acc">▣</span> ready to dispatch: <span class="acc">30 of 38</span></div>
            <div class="ln"><span class="dim">$</span> <span class="cmd">synnr report --readiness</span><span style="display:inline-block;width:8px;height:15px;background:var(--accent);margin-left:4px;vertical-align:-2px;animation:mkt-pulse 1.1s steps(1) infinite"></span></div>
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
      <h2 class="h2">Three steps to job-ready</h2>
      <p class="lede">From one messy job workflow to a readiness report — self-serve, in an afternoon.</p>
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
        <h4>Upload one job workflow</h4>
        <p>Drag in loadout lists, crew certs, job packets, tickets, photos, and customer requirements.</p>
      </div>
      <div class="step3 reveal" data-d="2">
        <span class="bn">2</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--fg-dim);line-height:2">
            <div><span style="color:var(--accent-ink)">›</span> reading 38 jobs</div>
            <div><span style="color:var(--accent-ink)">›</span> checking certs &amp; loadouts</div>
            <div><span style="color:var(--good)">✓</span> 14 gaps found</div>
          </div>
        </div>
        <h4>SYNNR checks readiness</h4>
        <p>Every job is checked against your rules — crew, truck, tools, inventory, paperwork, and billing backup.</p>
      </div>
      <div class="step3 reveal" data-d="3">
        <span class="bn">3</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center">
            <div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">Ready to dispatch</div>
            <div style="font-family:var(--font-display);font-size:38px;font-weight:600;color:var(--accent-ink);letter-spacing:-.03em;margin-top:6px">30 / 38</div>
            <div style="margin-top:10px"><span class="pill good">Cleared</span></div>
          </div>
        </div>
        <h4>Get the readiness report</h4>
        <p>Ready, At Risk, or Blocked — with reasons and the fix for each. Run it before every dispatch.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Benefits</span>
      <h2 class="h2">Why field teams run on SYNNR</h2>
      <p class="lede">Serious, self-serve readiness for the messy reality of field operations.</p>
    </div>
    <div class="benefits">
      <div class="benefit reveal" data-d="1"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><h4>Stop avoidable failures</h4><p>Catch missing tools, expired certs, and incomplete paperwork before they become downtime.</p></div>
      <div class="benefit reveal" data-d="2"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6h16M4 12h10M4 18h7"/><path d="m15 15 2.5 2.5L22 13"/></svg></div><h4>Dispatch with confidence</h4><p>Every crew and truck verified against the job's requirements before it rolls.</p></div>
      <div class="benefit reveal" data-d="3"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg></div><h4>Bill without disputes</h4><p>Packets and billing backup verified complete before the invoice goes out.</p></div>
      <div class="benefit reveal" data-d="4"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h4>Get paid faster</h4><p>Clean documentation means fewer rejected invoices and a shorter cash cycle.</p></div>
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
        <blockquote>“SYNNR caught an expired rigging cert the night before a crane job. That one catch paid for the year — the job would have been shut down on location.”</blockquote>
        <div class="who"><div class="av">RM</div><div class="nm"><b>Ray Mendez</b><span>VP Operations · oilfield services</span></div></div>
      </div>
      <div class="tslide">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“Billing used to chase crews for photos and signatures for weeks. Packets show up complete now — our rejected-invoice rate basically went to zero.”</blockquote>
        <div class="who"><div class="av">DK</div><div class="nm"><b>Dana Kohl</b><span>Controller · industrial contractor</span></div></div>
      </div>
      <div class="tslide">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“Self-serve was the selling point. We uploaded one job workflow and had a readiness report the same afternoon — it flagged gaps we'd been living with for years.”</blockquote>
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
      <h2 class="h2">See what unready jobs cost you.</h2>
      <p class="lede">Estimate what missed tools, expired certs, and incomplete packets cost your operation — and what SYNNR protects.</p>
    </div>
    <div class="roi-card reveal" data-d="1">
      <div class="roi-inputs">
        <div class="roi-control">
          <label>Jobs per month <b id="roiJobsV">750</b></label>
          <input type="range" id="roiJobs" min="50" max="5000" step="25" value="750" />
          <div class="hint">Tickets, work orders &amp; service calls</div>
        </div>
        <div class="roi-control">
          <label>Average job value <b id="roiAvgV">$2,800</b></label>
          <input type="range" id="roiAvg" min="250" max="25000" step="50" value="2800" />
          <div class="hint">Typical billed amount per job</div>
        </div>
        <div class="roi-control">
          <label>Jobs hit by readiness failures <b id="roiLeakV">2.5%</b></label>
          <input type="range" id="roiLeak" min="1" max="6" step="0.5" value="2.5" />
          <div class="hint">Missed tools, certs, paperwork &amp; backup</div>
        </div>
      </div>
      <div class="roi-output">
        <div class="roi-out-label">SYNNR protects ≈</div>
        <div class="roi-big" id="roiRecovered">$378,000</div>
        <div class="roi-sub">per year, from jobs that would have failed or gone unbilled</div>
        <div class="roi-rows">
          <div class="roi-row"><span class="k">Annual cost of unready jobs</span><span class="v" id="roiLeakAnnual">$630,000</span></div>
          <div class="roi-row"><span class="k">Recommended plan</span><span class="v" id="roiPlan">Growth · $11,988/yr</span></div>
          <div class="roi-row hl"><span class="k">Net annual gain</span><span class="v" id="roiNet">$288,000</span></div>
          <div class="roi-row"><span class="k">Return on subscription</span><span class="v"><span id="roiMultiple">4.2×</span> · pays back in <span id="roiPayback">~12 weeks</span></span></div>
        </div>
        <div class="roi-cta">
          <a href="/checkout?plan=growth" id="roiCta" class="btn btn-primary">Get job-ready — choose your plan
            <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
          <p class="mono" style="margin-top:14px;font-size:11.5px;color:var(--fg-faint);text-align:center">Estimate only · flat monthly pricing, cancel anytime</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="pricing">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Pricing</span>
      <h2 class="h2">Pricing that scales with your operation.</h2>
      <p class="lede">Flat monthly pricing. No contracts, no per-seat math — month to month, cancel anytime.</p>
      <div class="toggle" id="cycleToggle" role="tablist" style="margin-top:26px">
        <button class="on" data-cycle="monthly">Monthly</button>
        <button data-cycle="yearly">Yearly <span class="save">20% OFF</span></button>
      </div>
    </div>
    <div class="prices">
      <div class="price reveal" data-d="1">
        <div class="tier">Pro</div>
        <div class="amt"><span class="n" data-m="$499" data-y="$399">$499</span><span class="per">/ month</span></div>
        <p class="desc">For service companies with recurring field jobs.</p>
        <a href="/checkout?plan=pro" class="btn btn-ghost">Request access</a>
        <div class="feats">
          <div class="fh">Included</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Job readiness dashboard</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Loadout checklists by job type</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Cert &amp; asset tracking</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Email support</li>
        </div>
      </div>
      <div class="price popular reveal" data-d="2">
        <div class="pop-tag">Popular</div>
        <div class="tier">Growth</div>
        <div class="amt"><span class="n" data-m="$999" data-y="$799">$999</span><span class="per">/ month</span></div>
        <p class="desc">For multi-crew, multi-truck operations.</p>
        <a href="/checkout?plan=growth" class="btn btn-primary">Request access</a>
        <div class="feats">
          <div class="fh">Everything in Pro, plus</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Unlimited jobs &amp; crews</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Customer-rule library</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Billing-readiness checks</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Team access</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Priority support</li>
        </div>
      </div>
      <div class="price reveal" data-d="3">
        <div class="tier">Enterprise</div>
        <div class="amt"><span class="n">Custom</span></div>
        <p class="desc">For multi-site fleets and complex operations.</p>
        <a href="/onboarding" class="btn btn-ghost">Talk to us</a>
        <div class="feats">
          <div class="fh">Everything in Growth, plus</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>SYNNR data unification</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Dedicated success manager</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Custom integrations &amp; SSO</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Volume pricing &amp; custom terms</li>
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
      <div class="qa"><button>What is SYNNR?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>SYNNR is field-operations readiness software. It verifies the crew, truck, tools, certifications, inventory, paperwork, customer rules, and billing backup are ready before a job moves forward — and tells you exactly what to fix when they're not.</p></div></div>
      <div class="qa"><button>What kind of data can I upload?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Loadout lists, crew certs, truck inventory, job packets, field tickets, photos, forms, customer requirements, and billing rules — in mixed formats. SYNNR turns them into reusable readiness checks.</p></div></div>
      <div class="qa"><button>How fast can I get started?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>It's self-serve by design. There's no integration project — create a workspace, upload one job workflow, and get your first readiness report the same afternoon.</p></div></div>
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
      <h2 class="display">Stop job failures<br/>before they happen.</h2>
      <p class="lede">A missing tool, an expired cert, or an incomplete packet can sink a job before it starts. Check readiness before the crew rolls — and bill clean when the work is done.</p>
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
        <p class="blurb">Field-operations readiness for companies that run on trucks, crews, equipment, tickets, documents, and field execution.</p>
      </div>
      <div><h5>Product</h5><ul><li><a href="#features">SYNNR</a></li><li><a href="#how">How it works</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#faq">FAQ</a></li></ul></div>

      <div><h5>Company</h5><ul><li><a href="/onboarding">Early Access</a></li><li><a href="mailto:hello@synnr.io">Contact</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 SYNNR</span>
      <span>A job can fail before it starts. SYNNR makes sure it doesn't.</span>
    </div>
  </div>
</footer>
`;
