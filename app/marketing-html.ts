// SYNNR marketing page — multi-product SaaS for oilfield service companies.
// TallyShot is product #1; SYNNR is the suite. Rendered via dangerouslySetInnerHTML
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
      <a href="/apps">Apps</a>
      <a href="#how">How it works</a>
      <a href="/apps/tallyshot#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
      <a href="/glossary">Glossary</a>
    </nav>
    <div class="nav-cta">
      <a href="/login" class="btn btn-ghost btn-sm">Sign in</a>
      <a href="/apps" class="btn btn-primary btn-sm">Browse apps</a>
    </div>
  </div>
</header>

<main id="top">

<section class="hero section">
  <div class="container">
    <span class="pill-badge reveal"><span class="d"></span>The app platform for oilfield service</span>
    <h1 class="display reveal" data-d="1">Oilfield software that<br/>actually <span class="grad">ships</span></h1>
    <p class="lede reveal" data-d="2">SYNNR is a growing suite of purpose-built apps for oilfield service companies — the boring operational stuff, finally done right. Pick an app, start in minutes. First up: <b>TallyShot</b> turns a photo of a handwritten tally sheet into clean Excel, every shaky digit flagged for review.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="/apps" class="btn btn-primary">Browse apps
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="/ingest" class="btn btn-ghost">Try the live demo</a>
    </div>
    <div class="rating reveal" data-d="4">
      <span class="badge-dot" aria-hidden="true"></span>
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
            <a class="on" data-view="dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Overview</a>
            <a data-view="audits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>Tally sheets</a>
            <a data-view="pricebook"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>Certs</a>
            <a data-view="risk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/></svg>Flags</a>
            <a data-view="packets"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg>Exports</a>
          </nav>
          <div class="app-foot">
            <div class="t"><span class="dot"></span>SYNNR</div>
            <p>TallyShot · connected</p>
          </div>
        </aside>
        <div class="app-main">
          <div class="app-top">
            <h3 id="appViewTitle">Overview</h3>
            <span class="sample-tag">Sample preview · illustrative</span>
            <div class="app-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>Search sheets</div>
          </div>

          <div class="app-view on" data-view="dashboard">
          <div class="app-grid">
            <div class="balance-card">
              <div class="bc-head">
                <div>
                  <div class="bc-label">Sheets digitized · YTD</div>
                  <div class="bc-amount"><span data-count="3840" data-prefix="">3,840</span><span class="bc-delta">+47.3%</span></div>
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
              <div class="qp-title">This week <span class="illus">· sample</span></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/></svg></div><div class="qn">Sheets digitized<small>142 this week</small></div><div class="qv pos">142</div></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/></svg></div><div class="qn">Digits flagged for review<small>caught before export</small></div><div class="qv pos">38</div></div>
              <div class="qrow"><div class="qic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v8m-4-4h8"/><circle cx="12" cy="12" r="9"/></svg></div><div class="qn">Hours saved keying<small>vs. manual entry</small></div><div class="qv pos">~46 hrs</div></div>
              <a href="/ingest" class="btn btn-primary btn-sm">Scan a sheet
                <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </a>
            </div>
          </div>
          </div>

          <div class="app-view" data-view="audits">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Recent tally sheets</span><span class="meta">Last 7 days</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Pad 14 · perf run tally</b><small>62 line items · read clean</small></div><div class="vtrail"><span class="vval">100%</span><span class="vpill ok"><span class="sd"></span>Exported</span></div></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Lease 7 · daily count</b><small>2 shaky digits flagged</small></div><div class="vtrail"><span class="vval">needs review</span><span class="vpill warn"><span class="sd"></span>2 flags</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Site B · consumables tally</b><small>48 line items · read clean</small></div><div class="vtrail"><span class="vval">100%</span><span class="vpill ok"><span class="sd"></span>Exported</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Pad 9 · standby log</b><small>read clean</small></div><div class="vtrail"><span class="vval">100%</span><span class="vpill ok"><span class="sd"></span>Exported</span></div></div>
            </div>
            <div class="view-cta"><p><b>Every sheet</b> read, low-confidence digits flagged, exported to your Excel template.</p><a href="/ingest" class="btn btn-primary btn-sm">Scan a sheet<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
          </div>

          <div class="app-view" data-view="pricebook">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Certs &amp; inspections</span><span class="meta">CertWatch · soon</span></div>
              <div class="vrow"><div class="vic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5"/></svg></div><div class="vmain"><b>J. Alvarez — H2S Clear</b><small>Expires in 9 days</small></div><div class="vtrail"><span class="vpill warn"><span class="sd"></span>At risk</span></div></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5"/></svg></div><div class="vmain"><b>M. Ross — rigging cert</b><small>Expired 12 days ago</small></div><div class="vtrail"><span class="vpill dang"><span class="sd"></span>Blocked</span></div></div>
            </div>
            <div class="view-cta"><p><b>CertWatch</b> is next in the suite — cert expirations that block a job before the truck rolls.</p></div>
          </div>

          <div class="app-view" data-view="risk">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Loadout check</span><span class="meta">LoadCheck · soon</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></div><div class="vmain"><b>TRK-04 · loaded</b><small>3 perf guns · 1 CCL verified</small></div><div class="vtrail"><span class="vpill ok"><span class="sd"></span>Ready</span></div></div>
              <div class="vrow"><div class="vic dang"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg></div><div class="vmain"><b>TRK-09 · staged</b><small>Missing a perforating gun</small></div><div class="vtrail"><span class="vpill dang"><span class="sd"></span>Blocked</span></div></div>
            </div>
            <div class="view-cta"><p><b>LoadCheck</b> is coming — photograph the truck bed, AI confirms the loadout before dispatch.</p></div>
          </div>

          <div class="app-view" data-view="packets">
            <div class="panel-card">
              <div class="pc-head"><span class="t">Exports</span><span class="meta">Your Excel templates</span></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Pad 14 tally → daily_count.xlsx</b><small>matched your template</small></div><div class="vtrail"><span class="vpill ok"><span class="sd"></span>Ready</span></div></div>
              <div class="vrow"><div class="vic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div><div class="vmain"><b>Site B tally → consumables.xlsx</b><small>matched your template</small></div><div class="vtrail"><span class="vpill ok"><span class="sd"></span>Ready</span></div></div>
            </div>
            <div class="view-cta"><p><b>Clean Excel</b> in your own template — not a CSV you have to reformat.</p></div>
          </div>

        </div>
      </div>
    </div>
  </div>
</section>

<section class="section tight container reveal">
  <div class="divider-label">Built for oilfield service companies</div>
  <div style="display:flex;flex-wrap:wrap;gap:18px 40px;justify-content:space-between;align-items:center;margin-top:28px;opacity:.6;font-family:var(--font-mono);font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-dim)">
    <span>Wireline</span><span>Coil Tubing</span><span>Cementing</span><span>Frac</span><span>Equipment Rental</span><span>Field Service</span>
  </div>
</section>

<section class="section statement">
  <div class="container reveal">
    <p>Tally sheets keyed by hand. Tickets that never reach billing. Certs nobody's tracking. <b>SYNNR</b> builds the software that finally does the boring operational stuff <span class="hl">right</span> — so the field stops costing you in the office.</p>
  </div>
</section>

<section class="section" id="products">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">The SYNNR suite</span>
      <h2 class="h2">One suite for the field. TallyShot ships first.</h2>
      <p class="lede">Each product kills one expensive, boring problem — and they all talk to each other. Start with TallyShot today; the rest is rolling out.</p>
    </div>

    <div class="bento">
      <div class="cell span4 reveal" data-d="1">
        <div class="corner"></div>
        <div class="visual">
          <div class="console" style="box-shadow:none">
            <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>TallyShot · read &amp; flag</div></div>
            <div class="console-body" style="padding:0">
              <div class="mini-tally">
                <div class="mt-row mt-head"><span>No.</span><span>Read</span><span>Length</span><span>Status</span></div>
                <div class="mt-row"><span>44</span><span class="mono">3234</span><span class="mono">32.34</span><span class="mt-tag ok">Trusted</span></div>
                <div class="mt-row"><span>45</span><span class="mono">3230</span><span class="mono">32.30</span><span class="mt-tag ok">Trusted</span></div>
                <div class="mt-row flag"><span>46</span><span class="mono">3072</span><span class="mono">30.72</span><span class="mt-tag flag">Range — confirm</span></div>
                <div class="mt-row warn"><span>47</span><span class="mono">32&#8202;5?</span><span class="mono">32.50</span><span class="mt-tag warn">Low confidence</span></div>
                <div class="mt-row"><span>48</span><span class="mono">3236</span><span class="mono">32.36</span><span class="mt-tag ok">Trusted</span></div>
              </div>
            </div>
          </div>
        </div>
        <h3>TallyShot <span class="hl">· live now</span></h3>
        <p class="ct">Snap a photo of a handwritten tally sheet. TallyShot reads it, flags the shaky digits for a quick human check, and exports clean Excel in your own template — no more keying 50 sheets a day by hand.</p>
      </div>

      <div class="cell span2 reveal" data-d="2">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17.5" cy="18" r="1.7"/></svg></div>
        <h3>LoadCheck <span class="soon">· soon</span></h3>
        <p class="ct">Photograph the truck bed — AI confirms the loadout is complete before the crew rolls, so the gear that didn't make the truck gets caught in the yard.</p>
      </div>
      <div class="cell span2 reveal" data-d="3">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6M8 14h8M8 17h5"/></svg></div>
        <h3>TicketFlow <span class="soon">· soon</span></h3>
        <p class="ct">Digital field tickets, auto-priced from your rate sheet and e-signed in the field — so the work is billable the day it's done.</p>
      </div>
      <div class="cell span2 reveal" data-d="1">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="5"/><path d="M8.5 12.5 7 21l5-3 5 3-1.5-8.5"/></svg></div>
        <h3>CertWatch <span class="soon">· soon</span></h3>
        <p class="ct">Cert and inspection expirations that block a job before the truck rolls — no more crews turned away at the gate for a lapsed card.</p>
      </div>
      <div class="cell span4 reveal" data-d="2">
        <div class="corner"></div>
        <div class="icon-chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16M9 4v16"/></svg></div>
        <h3>One login. One bill. They talk to each other.</h3>
        <p class="ct">Every product lives under SYNNR — same login, same data, priced for a service shop, not an enterprise. Add the next one when you're ready; it just plugs in.</p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="split">
      <div class="split-copy reveal">
        <span class="eyebrow">TallyShot</span>
        <h2 class="h2">From a stack of tally sheets to clean Excel.</h2>
        <p class="lede">Anybody can paste one photo into a chatbot. Nobody wants to do it 50 times a day and trust it blind. TallyShot reads every sheet, flags only the digits it isn't sure about, and exports to the spreadsheet you already use.</p>
        <ul class="checks">
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Confidence-flags the shaky handwriting — you only check what's uncertain</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Exports into your Excel template, not a raw CSV</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Same flow every time — trustworthy at 50 sheets a day</li>
        </ul>
        <a href="/ingest" class="btn btn-ghost">Scan a sheet free
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <div class="reveal" data-d="2">
        <div class="console">
          <div class="console-bar"><div class="console-dots"><i></i><i></i><i></i></div><div class="console-title"><span class="live"></span>TallyShot · review</div><div class="console-tabs"><span class="on">Read</span><span>Export</span></div></div>
          <div class="console-body">
            <div class="rows">
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><div><div class="label">Perf guns — qty 12</div><div class="sub">read clean · 99%</div></div><div class="amt">12</div><div class="pill good">Auto</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><div><div class="label">CCL — qty 3</div><div class="sub">read clean · 97%</div></div><div class="amt">3</div><div class="pill good">Auto</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/></svg><div><div class="label">Standby hrs — 6.5?</div><div class="sub">faint handwriting · 58%</div></div><div class="amt">?</div><div class="pill warn">Review</div></div>
              <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--good)" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><div><div class="label">Consumables — 42 lines</div><div class="sub">read clean · 96%</div></div><div class="amt">42</div><div class="pill good">Auto</div></div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:18px;padding-top:16px;border-top:1px solid var(--line)">
              <div><div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">1 digit to confirm</div><div class="h3" style="color:var(--accent-ink);margin-top:5px">then → Excel</div></div>
              <span class="btn btn-primary btn-sm">Export clean sheet</span>
            </div>
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
      <h2 class="h2">Photo in. Clean Excel out.</h2>
      <p class="lede">Three steps, a few seconds a sheet. No new hardware, no training the crew.</p>
    </div>
    <div class="steps3">
      <div class="step3 reveal" data-d="1">
        <span class="bn">1</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--fg-dim);line-height:2">
            <div><span style="color:var(--accent-ink)">›</span> open the app</div>
            <div><span style="color:var(--accent-ink)">›</span> photograph the sheet</div>
            <div><span style="color:var(--good)">✓</span> uploaded</div>
          </div>
        </div>
        <h4>Snap the sheet</h4>
        <p>From the truck or the yard, take a photo of the handwritten tally — coffee stains and all.</p>
      </div>
      <div class="step3 reveal" data-d="2">
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center;font-family:var(--font-mono);font-size:12px;color:var(--fg-dim);line-height:2">
            <div><span style="color:var(--accent-ink)">›</span> reading 62 line items</div>
            <div><span style="color:var(--accent-ink)">›</span> scoring each digit</div>
            <div><span style="color:var(--good)">✓</span> 2 flagged for review</div>
          </div>
        </div>
        <span class="bn">2</span>
        <h4>AI reads &amp; flags</h4>
        <p>TallyShot reads every line and flags only the digits it isn't sure about — you confirm those in one tap.</p>
      </div>
      <div class="step3 reveal" data-d="3">
        <span class="bn">3</span>
        <div class="visual">
          <div style="align-self:center;width:100%;text-align:center">
            <div class="mono" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-faint)">Exported</div>
            <div style="font-family:var(--font-display);font-size:34px;font-weight:600;color:var(--accent-ink);letter-spacing:-.03em;margin-top:6px">daily_count.xlsx</div>
            <div style="margin-top:10px"><span class="pill good">Your template</span></div>
          </div>
        </div>
        <h4>Export clean Excel</h4>
        <p>Out comes a clean spreadsheet in your own template — ready to send, not a CSV to reformat.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" id="why">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Built by operators</span>
      <h2 class="h2">Made for the people doing the keying</h2>
      <p class="lede">SYNNR is new — no borrowed logos, no invented quotes. Here's why the output earns trust on day one.</p>
    </div>
    <div class="trust-strip reveal" data-d="1">
      <div class="trust-item">
        <div class="ti-k">It doesn't guess — it flags</div>
        <p>One missed digit is a 45-foot lie in the string. TallyShot reads the clean digits and flags every shaky one for a human to confirm — so the number you export is one you can stand behind.</p>
      </div>
      <div class="trust-item">
        <div class="ti-k">Your sheets, your format</div>
        <p>MKS form, printed grid, or a field notebook — and it exports into the Excel template you already send the operator.</p>
      </div>
      <div class="trust-item">
        <div class="ti-k">Your data stays yours</div>
        <p>Encrypted in transit and at rest, isolated to your company, never used to train shared models.</p>
      </div>
      <div class="trust-item">
        <div class="ti-k">Try before you trust us</div>
        <p>Run a real sheet through the live demo — no account, no card — and judge the output yourself.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" id="pricing">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Pricing</span>
      <h2 class="h2">Pay per seat. Buy one, or fifty.</h2>
      <p class="lede">Each app is priced on its own. TallyShot is per user, per month — a one-man shop buys one seat, a fleet buys fifty, same flow. Volume discounts kick in automatically. 14-day free trial.</p>
    </div>
    <div class="prices">
      <div class="price reveal" data-d="1">
        <div class="tier">Solo</div>
        <div class="amt"><span class="n">$39</span><span class="per">/ user / mo</span></div>
        <p class="desc">1–9 seats. The one-truck shop and the office.</p>
        <a href="/apps/tallyshot#pricing" class="btn btn-ghost">Start free trial</a>
        <div class="feats">
          <div class="fh">Per seat</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>TallyShot — photo → clean Excel</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Confidence-flagged review</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>10 sheets / seat / mo included</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>14-day free trial</li>
        </div>
      </div>
      <div class="price popular reveal" data-d="2">
        <div class="pop-tag">Volume</div>
        <div class="tier">Crew &amp; Fleet</div>
        <div class="amt"><span class="n">$34–29</span><span class="per">/ user / mo</span></div>
        <p class="desc">10+ seats $34 · 25+ $29. Discounts apply automatically.</p>
        <a href="/apps/tallyshot#pricing" class="btn btn-primary">Start free trial</a>
        <div class="feats">
          <div class="fh">Everything in Solo, plus</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Invite your hands, assign seats</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Pooled scan quota across the org</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>One bill, self-serve seat changes</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Priority support</li>
        </div>
      </div>
      <div class="price reveal" data-d="3">
        <div class="tier">Enterprise</div>
        <div class="amt"><span class="n">50+</span><span class="per">seats</span></div>
        <p class="desc">Day &amp; night shift across a big fleet.</p>
        <a href="mailto:cadencain@darkstarops.com?subject=SYNNR%20enterprise%20(50%2B%20seats)" class="btn btn-ghost">Talk to us</a>
        <div class="feats">
          <div class="fh">Everything in Fleet, plus</div>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Volume pricing from $25 / seat</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Early access to the full suite</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Onboarding &amp; template setup</li>
          <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Dedicated support</li>
        </div>
      </div>
    </div>
    <p class="mono" style="text-align:center;margin-top:22px;font-size:12px;color:var(--fg-faint)">Beyond the pooled quota: $1 / extra sheet. Cancel anytime from your billing portal. <a href="/apps/tallyshot#pricing" style="color:var(--accent-ink)">Full TallyShot pricing →</a></p>
  </div>
</section>

<section class="section" id="faq">
  <div class="container">
    <div class="head reveal">
      <span class="eyebrow">Common questions</span>
      <h2 class="h2">All you need to know</h2>
    </div>
    <div class="faq reveal" data-d="1">
      <div class="qa"><button>What is TallyShot?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>TallyShot is SYNNR's first product: photograph a handwritten tally sheet and get clean Excel back, with every low-confidence digit flagged for a quick human check. It's built for the field hands and office staff who key counts by hand every day.</p></div></div>
      <div class="qa"><button>How accurate is it on bad handwriting?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>It reads the clean digits automatically and — this is the point — it doesn't guess on the shaky ones. Anything it isn't sure about gets flagged amber for you to confirm in a tap, so the number you export is one you can actually trust.</p></div></div>
      <div class="qa"><button>Do I need internet in the field?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Today TallyShot reads sheets in the cloud, so it needs signal at the moment you scan. Offline / store-and-forward (scan now, process when you're back in range) is on the roadmap.</p></div></div>
      <div class="qa"><button>How does the free trial work?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Every app starts with a 14-day free trial. You can also try TallyShot's reader right now with the live demo — no account needed. When the trial ends you keep going on your chosen plan, or cancel anytime from your billing portal.</p></div></div>
      <div class="qa"><button>What does it cost?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>TallyShot is per seat: $39/user/mo, dropping to $34 at 10 seats and $29 at 25 — volume discounts apply automatically. Each seat includes 10 sheets/mo (pooled across your org); extra sheets are $1 each. 50+ seats: talk to us. Each future app is priced on its own.</p></div></div>
      <div class="qa"><button>I'm a one-man shop — can I just buy one?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Yes. Sign up, buy a single seat, and you're using it — no company setup required. If you grow, you add seats and invite your hands from the same account. A solo operator and a 50-truck fleet use the exact same flow.</p></div></div>
      <div class="qa"><button>Is my data secure?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Your sheets and exports are encrypted in transit and at rest, isolated to your company, and never used to train shared models. Your data stays yours.</p></div></div>
      <div class="qa"><button>What else is coming?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>TallyShot is product #1 in the SYNNR suite. Next up: LoadCheck (photo-verify the truck loadout before dispatch), TicketFlow (digital, auto-priced field tickets), and CertWatch (cert/inspection expirations that block a job before it rolls). One login, one bill, all connected.</p></div></div>
    </div>
  </div>
</section>

<section class="section final" id="cta">
  <div class="container">
    <div class="final-card reveal">
      <div class="glow"></div>
      <span class="eyebrow" style="justify-content:center;margin-bottom:18px">TallyShot</span>
      <h2 class="display">Stop keying tally sheets<br/>by hand.</h2>
      <p class="lede">Photograph a sheet, check the digits it flags, export clean Excel. Scan one free — no card — and see it on your own sheet.</p>
      <div class="final-cta">
        <a href="/ingest" class="btn btn-primary">Try the live demo
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="/apps/tallyshot" class="btn btn-ghost">See TallyShot</a>
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
        <p class="blurb">The app platform for oilfield service companies. Purpose-built apps, ready to use — pick one, start in minutes.</p>
      </div>
      <div><h5>Apps</h5><ul><li><a href="/apps/tallyshot">TallyShot</a></li><li><a href="/apps">All apps</a></li><li><a href="/apps/tallyshot#pricing">Pricing</a></li><li><a href="/glossary">Glossary</a></li></ul></div>

      <div><h5>Company</h5><ul><li><a href="/login">Sign in</a></li><li><a href="/ingest">Live demo</a></li><li><a href="mailto:cadencain@darkstarops.com">Contact</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
    </div>
    <div class="footer-bottom">
      <span>© 2026 SYNNR</span>
      <span>The boring operational stuff, finally done right.</span>
    </div>
  </div>
</footer>
`;
