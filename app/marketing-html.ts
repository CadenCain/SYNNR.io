// SYNNR marketing page markup — AI automation & operations agency for oilfield
// service companies ("Build & Transfer"). Rendered via dangerouslySetInnerHTML
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
      <a href="#build">What we build</a>
      <a href="#how">How it works</a>
      <a href="#testimonials">Results</a>
      <a href="#faq">FAQ</a>
      <a href="/glossary">Glossary</a>
    </nav>
    <div class="nav-cta">
      <a href="#audit" class="btn btn-primary btn-sm">Request an Operations Audit</a>
    </div>
  </div>
</header>

<main id="top">

<section class="hero section">
  <div class="container">
    <span class="pill-badge reveal"><span class="d"></span>AI automation &amp; ops · built for oilfield service</span>
    <h1 class="display reveal" data-d="1">Stop paying monthly for software<br/>that <span class="grad">doesn't talk to each other</span></h1>
    <p class="lede reveal" data-d="2">SYNNR builds custom, owned operating systems for oilfield service companies — dispatch, ticketing, asset tracking, and AI ingestion, built for your operation and owned entirely by you. No monthly seat licenses.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="#audit" class="btn btn-primary">Request an Operations Audit
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="#build" class="btn btn-ghost">What we build</a>
    </div>
    <div class="rating reveal" data-d="4">
      <span class="stars" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
      </span>
      <b>Built by operators</b><span>for oilfield service companies</span>
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
            <a class="on" data-view="dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Command</a>
            <a data-view="audits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>Jobs</a>
            <a data-view="pricebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Certs</a>
            <a data-view="risk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/></svg>Risk flags</a>
            <a data-view="packets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg>Packets</a>
          </nav>
          <div class="app-foot">
            <div class="t"><span class="dot"></span>SYNNR</div>
            <p>Your OS · your cloud</p>
          </div>
        </aside>
        <div class="app-main">
          <div class="app-top">
            <h3 id="appViewTitle">Command</h3>
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
              <span class="btn btn-primary btn-sm">Your custom build</span>
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
            <div class="view-cta"><p><b>Each check</b> verifies crew, certs, tools, paperwork &amp; billing backup.</p></div>
          </div>

          <div class="app-view" data-view="pricebook">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Certs &amp; inspections</span><span class="meta">12 expiring</span></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5"/></svg></div><div class="vmain"><b>J. Alvarez — H2S Clear</b><small>Expires in 9 days · on 3 scheduled jobs</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>At risk</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5"/></svg></div><div class="vmain"><b>Crane 14 — annual inspection</b><small>Due in 6 days · assigned tomorrow</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>At risk</span></div></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5"/></svg></div><div class="vmain"><b>M. Ross — rigging cert</b><small>Expired 12 days ago · pulls him off 2 jobs</small></div><div class="vtrail"><span class="vpill dang"><span class="sd"></span>Blocked</span></div></div>
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
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg></div><div class="vmain"><b>#4772 · Consumables low</b><small>Below required quantity for job type</small></div><div class="vtrail"><span class="vval">restock</span><span class="vpill warn"><span class="sd"></span>Medium</span></div></div>
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
  <div class="divider-label">We build for oilfield service companies</div>
  <div style="display:flex;flex-wrap:wrap;gap:18px 40px;justify-content:space-between;align-items:center;margin-top:28px;opacity:.6;font-family:var(--font-mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-dim)">
    <span>Wireline</span><span>Coil Tubing</span><span>Cementing</span><span>Frac</span><span>Equipment Rental</span><span>Field Service</span>
  </div>
</section>

<section class="section statement">
  <div class="container reveal">
    <p>The oilfield hates SaaS — paying per-seat, every month, forever, for tools that solve 20% of the problem and <span class="hl">don't talk to each other.</span> We build the system that does, <b>deploy it on your cloud, and hand you the keys.</b></p>
  </div>
</section>

<section class="section" id="build">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">What we build</span>
      <h2 class="h2">Custom operating systems, owned by you</h2>
      <p class="lede">One integrated system where everything talks to everything — built around your exact workflow, deployed on your own cloud, no monthly seat licenses.</p>
    </div>

    <div class="bento">
      <div class="cell span4 reveal" data-d="1">
        <div class="corner"></div>
        <div class="visual">
          <div class="console" style="box-shadow:none">
            <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>AI Document Ingestion</div></div>
            <div class="console-body" style="padding:16px">
              <div class="viz" style="margin:0;border:0;padding:0;background:none">
                <div class="bars" style="height:88px">
                  <div class="bar" style="height:40%"></div><div class="bar" style="height:55%"></div><div class="bar leak" style="height:90%"></div><div class="bar" style="height:48%"></div><div class="bar" style="height:64%"></div><div class="bar leak" style="height:82%"></div><div class="bar" style="height:44%"></div><div class="bar" style="height:60%"></div><div class="bar" style="height:70%"></div><div class="bar leak" style="height:96%"></div><div class="bar" style="height:52%"></div><div class="bar" style="height:68%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <h3>AI Document Ingestion</h3>
        <p class="ct">Pipelines that read your messy rate sheets, paper certs, and field tickets and turn them into structured data automatically — every field confidence-scored, the unsure ones routed to a human.</p>
      </div>

      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="assetlist">
          <div class="asset"><div class="tk">OK</div><div class="nm">TRK-04 · loaded<small>3 perf guns · 1 CCL verified</small></div><div class="vv"><span class="pos">Ready</span></div></div>
          <div class="asset"><div class="tk">!</div><div class="nm">Rigging gear<small>Sling inspection due in 6 days</small></div><div class="vv"><span>At risk</span></div></div>
          <div class="asset"><div class="tk">✕</div><div class="nm">TRK-09 · blocked<small>Missing tool for Job #442</small></div><div class="vv"><span>Blocked</span></div></div>
        </div>
        <h3>Digital Yard Twins</h3>
        <p class="ct">A live virtual mirror of your yard — every tool, truck, and cert as a tracked state. Know exactly what's on what truck, and block a dispatch before it rolls without the right gear.</p>
      </div>

      <div class="cell span2 reveal" data-d="1">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6M8 14h8M8 17h5"/></svg></div>
        <h3>Intelligent Ticketing</h3>
        <p class="ct">Replace paper tickets with digital workflows that auto-calculate pricing from your rate sheet and capture e-signatures in the field — so billing is clean the day the job closes.</p>
      </div>
      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16M9 4v16"/></svg></div>
        <h3>Your tools, connected</h3>
        <p class="ct">QuickBooks, your fuel cards, telematics, dispatch — integrated into one system that talks to itself, instead of five apps that don't.</p>
      </div>
      <div class="cell span2 reveal" data-d="3">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg></div>
        <h3>Deployed &amp; owned by you</h3>
        <p class="ct">We build it on your AWS / Vercel / Supabase accounts and hand you the keys. You own the software outright — no vendor lock-in, no monthly ransom.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="split">
      <div class="split-copy reveal">
        <span class="eyebrow">Owned, not rented</span>
        <h2 class="h2">Built on your stack. Owned by you.</h2>
        <p class="lede">We deploy your operating system on your own cloud accounts and transfer it to you completely. It runs your operation, not ours — and you never pay a per-seat license again.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Deployed on your own AWS / Vercel / Supabase</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>You own the code &amp; the data — outright</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Built for your exact workflow, not a template</li>
        </ul>
        <a href="#audit" class="btn btn-ghost">Request an Operations Audit
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="console">
          <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>Readiness · Job #RC-4821</div><div class="console-tabs"><span class="on">Checks</span><span>Packet</span></div></div>
          <div class="console-body">
            <div class="rows">
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M4 21c1.4-3.8 4.6-6 8-6s6.6 2.2 8 6"/></svg><div><div class="label">Rigger cert expired</div><div class="sub">M. Ross · required for crane lift</div></div><div class="amt">blocked</div><div class="pill danger">Crew</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><path d="M14.7 6.3a4.6 4.6 0 0 0-6 6L3 18v3h3l5.7-5.7a4.6 4.6 0 0 0 6-6l-3 3-2.3-2.3 3-3Z"/></svg><div><div class="label">Rigging inspection due</div><div class="sub">Slings &amp; shackles · due in 6 days</div></div><div class="amt">at risk</div><div class="pill warn">Tools</div></div>
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
        <span class="eyebrow">The audit comes first</span>
        <h2 class="h2">We map the gaps before we build a thing.</h2>
        <p class="lede">Every engagement starts with a paid Operations Audit. We analyze your dispatch, loadout, and ticketing workflow and hand you a Gap Map — exactly where you're bleeding money and the blueprint to fix it. Then you decide.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Untracked hotshot trips &amp; downtime, quantified</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Delayed billing &amp; kicked-back invoices, mapped</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>A concrete build blueprint — no obligation</li>
        </ul>
        <a href="#how" class="btn btn-ghost">How it works
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="terminal">
          <div class="terminal-head"><div class="console-dots"><i></i><i></i><i></i></div><span class="mono" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-dim)">operations-audit — gap-map</span></div>
          <div class="terminal-body">
            <div class="ln"><span class="dim">$</span> <span class="cmd">synnr audit ./apex-midstream</span></div>
            <div class="ln"><span class="acc">›</span> reviewing dispatch + loadout + ticketing … <span class="ok">done</span></div>
            <div class="ln"><span class="flag">!</span> 14 hotshot trips/mo — untracked gear misses</div>
            <div class="ln"><span class="flag">!</span> avg 21 days ticket → invoice</div>
            <div class="ln"><span class="flag">!</span> 6 apps, none integrated</div>
            <div class="ln" style="margin-top:8px"><span class="acc">▣</span> est. recoverable: <span class="acc">$220k / yr</span></div>
            <div class="ln"><span class="dim">$</span> <span class="cmd">synnr blueprint --build</span><span style="display:inline-block;width:8px;height:15px;background:var(--accent);margin-left:4px;vertical-align:-2px;animation:mkt-pulse 1.1s steps(1) infinite"></span></div>
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
      <h2 class="h2">Audit → Build → Own</h2>
      <p class="lede">A paid discovery phase that proves the value, a fixed-scope build, and software you own at the end. No subscriptions, no lock-in.</p>
    </div>
    <div class="steps3">
      <div class="step3 reveal" data-d="1">
        <span class="bn">1</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--fg-dim);line-height:2">
            <div><span style="color:var(--accent-ink)">›</span> dispatch · loadout · billing</div>
            <div><span style="color:var(--accent-ink)">›</span> where money leaks</div>
            <div><span style="color:var(--good)">✓</span> Gap Map delivered</div>
          </div>
        </div>
        <h4>1 · Operations Audit</h4>
        <p>One week. We map your workflow and deliver a Gap Map showing exactly where you're losing money — and the blueprint to fix it.</p>
      </div>
      <div class="step3 reveal" data-d="2">
        <span class="bn">2</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--fg-dim);line-height:2">
            <div><span style="color:var(--accent-ink)">›</span> ingestion · twin · ticketing</div>
            <div><span style="color:var(--accent-ink)">›</span> your integrations</div>
            <div><span style="color:var(--good)">✓</span> deployed to your cloud</div>
          </div>
        </div>
        <h4>2 · Core Build</h4>
        <p>4–8 weeks. We build and deploy your custom OS on your own cloud accounts — ingestion, ticketing, asset tracking, and the integrations you need.</p>
      </div>
      <div class="step3 reveal" data-d="3">
        <span class="bn">3</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center">
            <div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">Software you own</div>
            <div style="font-family:var(--font-display);font-size:38px;font-weight:600;color:var(--accent-ink);letter-spacing:-.03em;margin-top:6px">$0/seat</div>
            <div style="margin-top:10px"><span class="pill good">Keys handed over</span></div>
          </div>
        </div>
        <h4>3 · You Own It</h4>
        <p>We hand you the keys — you own the code and the data. Optional maintenance retainer covers monitoring and updates, far cheaper than an in-house dev.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Why Build &amp; Transfer</span>
      <h2 class="h2">Why operators choose owning over renting</h2>
      <p class="lede">Built by operators, for the messy reality of oilfield field operations.</p>
    </div>
    <div class="benefits">
      <div class="benefit reveal" data-d="1"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg></div><h4>Own it outright</h4><p>Pay once, own the software forever. No per-seat fees draining margin every month.</p></div>
      <div class="benefit reveal" data-d="2"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16M9 4v16"/></svg></div><h4>One system, integrated</h4><p>Dispatch, tickets, assets, and billing in one OS that talks to itself — not five apps that don't.</p></div>
      <div class="benefit reveal" data-d="3"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg></div><h4>Built for your workflow</h4><p>Not a generic template — your job types, your rate sheets, your customers' rules.</p></div>
      <div class="benefit reveal" data-d="4"><div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div><h4>Fast, fixed-scope</h4><p>Live in weeks, not quarters — with a paid audit up front so you know exactly what you're getting.</p></div>
    </div>
  </div>
</section>

<section class="section" id="testimonials">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Results</span>
      <h2 class="h2">Built for operators who run on the field</h2>
    </div>
    <div class="tcard reveal" data-d="1" id="tcard">
      <div class="tslide on">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“We were paying for three apps that didn't talk. SYNNR built us one system that does — and we own it. The hotshot trips back to the yard basically stopped.”</blockquote>
        <div class="who"><div class="av">RM</div><div class="nm"><b>Ray Mendez</b><span>VP Operations · wireline services</span></div></div>
      </div>
      <div class="tslide">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“The audit alone paid for itself — they showed us 21 days of lag between ticket and invoice we couldn't see. The build cut it to three.”</blockquote>
        <div class="who"><div class="av">DK</div><div class="nm"><b>Dana Kohl</b><span>Controller · oilfield service contractor</span></div></div>
      </div>
      <div class="tslide">
        <div class="stars" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7z"/></svg>
        </div>
        <blockquote>“It runs on our own cloud and it's ours. No vendor holding our operation hostage, no monthly bill that climbs every time we add a hand.”</blockquote>
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

<section class="section" id="audit">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Request an operations audit</span>
      <h2 class="h2">Find where your operation is bleeding money.</h2>
      <p class="lede">One week. We map your dispatch, loadout, and ticketing workflow and hand you a Gap Map — exactly where money leaks and how automation fixes it. Tell us a bit about your operation:</p>
    </div>
    <div class="auditform reveal" data-d="1">
      <div class="afsteps" id="afSteps">
        <span class="afdot on"></span><span class="afdot"></span><span class="afdot"></span><span class="afdot"></span>
      </div>

      <div class="afstep on" data-step="1">
        <div class="afq">What type of service company are you?</div>
        <div class="afopts" data-field="serviceType">
          <button type="button" class="afopt" data-v="Wireline">Wireline</button>
          <button type="button" class="afopt" data-v="Coil Tubing">Coil Tubing</button>
          <button type="button" class="afopt" data-v="Cementing">Cementing</button>
          <button type="button" class="afopt" data-v="Frac">Frac</button>
          <button type="button" class="afopt" data-v="Other">Other</button>
        </div>
      </div>

      <div class="afstep" data-step="2">
        <div class="afq">How many trucks / crews do you run?</div>
        <div class="afopts" data-field="fleetSize">
          <button type="button" class="afopt" data-v="1-5">1–5</button>
          <button type="button" class="afopt" data-v="6-15">6–15</button>
          <button type="button" class="afopt" data-v="16-40">16–40</button>
          <button type="button" class="afopt" data-v="40+">40+</button>
        </div>
      </div>

      <div class="afstep" data-step="3">
        <div class="afq">What's your biggest operational bottleneck right now?</div>
        <textarea id="afBottleneck" class="afinput afarea" placeholder="e.g. missing tools on location, delayed field tickets, paper certs, invoices kicked back…"></textarea>
      </div>

      <div class="afstep" data-step="4">
        <div class="afq">Where do we send your Gap Map?</div>
        <div class="afgrid">
          <input id="afName" class="afinput" type="text" placeholder="Your name" autocomplete="name" />
          <input id="afCompany" class="afinput" type="text" placeholder="Company" autocomplete="organization" />
          <input id="afEmail" class="afinput" type="email" placeholder="Work email" autocomplete="email" />
          <input id="afPhone" class="afinput" type="tel" placeholder="Phone" autocomplete="tel" />
        </div>
      </div>

      <div class="afnav">
        <button type="button" class="btn btn-ghost btn-sm" id="afBack" style="visibility:hidden">Back</button>
        <button type="button" class="btn btn-primary" id="afNext">Continue<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <button type="button" class="btn btn-primary" id="afSubmit" hidden>Request my audit</button>
      </div>
      <div class="afmsg" id="afMsg"></div>

      <div class="afdone" id="afDone" hidden>
        <div class="afdone-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h3>Request received.</h3>
        <p>We'll review your operation and reach out within one business day to schedule your audit. Talk soon.</p>
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
      <div class="qa"><button>What exactly is SYNNR?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>SYNNR is an AI automation &amp; operations agency for oilfield service companies. We build custom operating systems — AI document ingestion, digital yard twins, intelligent ticketing — deploy them on your own cloud, and hand you the keys. You own the software.</p></div></div>
      <div class="qa"><button>Is this another monthly SaaS subscription?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>No. You pay for the build once and own the software outright — no per-seat licenses. An optional maintenance retainer is available for monitoring and updates, but it's your call, and it's far cheaper than an in-house developer.</p></div></div>
      <div class="qa"><button>How does the Operations Audit work?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>It's a one-week paid discovery phase. We analyze your dispatch, loadout, and ticketing workflow and deliver a Gap Map — exactly where you're losing money (untracked hotshot trips, delayed billing) and a concrete blueprint to fix it. No obligation to build afterward.</p></div></div>
      <div class="qa"><button>How long does a build take, and where does it run?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Typically 4–8 weeks depending on scope. We deploy on your own cloud accounts (AWS / Vercel / Supabase) so the system — and your data — belong to you from day one.</p></div></div>
      <div class="qa"><button>What does it cost?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>It depends on your operation and scope, which is exactly what the audit determines. Request an Operations Audit and we'll scope it precisely — most companies are replacing several apps that already cost them more every month than owning one system that actually fits.</p></div></div>
    </div>
  </div>
</section>

<section class="section final" id="cta">
  <div class="container">
    <div class="final-card reveal">
      <div class="glow"></div>
      <span class="eyebrow" style="justify-content:center;margin-bottom:18px">Build &amp; Transfer</span>
      <h2 class="display">Stop renting software.<br/>Own your operation.</h2>
      <p class="lede">One system, built for your exact workflow, deployed on your cloud, owned by you. It starts with a one-week Operations Audit.</p>
      <div class="final-cta">
        <a href="#audit" class="btn btn-primary">Request an Operations Audit
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="#build" class="btn btn-ghost">What we build</a>
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
        <p class="blurb">AI automation &amp; operations agency for oilfield service companies. Custom operating systems, built on your cloud, owned by you.</p>
      </div>
      <div><h5>Agency</h5><ul><li><a href="#build">What we build</a></li><li><a href="#how">How it works</a></li><li><a href="#audit">Operations Audit</a></li><li><a href="/glossary">Field-ops glossary</a></li></ul></div>

      <div><h5>Company</h5><ul><li><a href="#audit">Request an audit</a></li><li><a href="mailto:cadencain@darkstarops.com">Contact</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 SYNNR · Darkstar Ops LLC</span>
      <span>Stop paying monthly for software that doesn't talk to each other.</span>
    </div>
  </div>
</footer>
`;
