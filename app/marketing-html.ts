// SYNNR marketing page — managed-service operations partner for oilfield &
// blue-collar service shops. Sells outcomes (recurring run-it-for-you), not
// software. Every CTA → the free Readiness Map intake. Rendered via
// dangerouslySetInnerHTML and driven by MarketingScripts.
export const MARKETING_HTML = `
<div class="page-atmosphere" aria-hidden="true">
  <div class="bg-grid"></div>
  <div class="amb amb-1"></div>
  <div class="amb amb-2"></div>
</div>

<header class="nav" id="nav">
  <div class="nav-pill">
    <a class="brand" href="/" aria-label="SYNNR">
      <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="url(#bm)"/>
        <circle cx="16" cy="16" r="2.4" fill="#060608"/>
        <defs><linearGradient id="bm" x1="2" y1="2" x2="30" y2="30"><stop stop-color="#f3ecdb"/><stop offset="1" stop-color="#ccbe9d"/></linearGradient></defs>
      </svg>
      <span class="wordmark">SYNNR</span>
    </a>
    <nav class="nav-links">
      <a href="#problem">The problem</a>
      <a href="#how">How it works</a>
      <a href="#fix">What we fix</a>
      <a href="#faq">FAQ</a>
    </nav>
    <div class="nav-cta">
      <a href="/readiness-map" class="btn btn-primary btn-sm">Book a call</a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile">
      <a href="#problem">The problem</a>
      <a href="#how">How it works</a>
      <a href="#fix">What we fix</a>
      <a href="#faq">FAQ</a>
      <a href="/readiness-map">Book your free Readiness Call</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="hero section">
  <div class="container">
    <span class="pill-badge reveal"><span class="d"></span>Operations partner for service shops</span>
    <h1 class="display reveal" data-d="1">Your jobs are leaking money<br/>in the <span class="grad">boring stuff</span></h1>
    <p class="lede reveal" data-d="2">Missing tools. Wrong trucks. Invoices that get kicked back. SYNNR finds where your operation bleeds, builds the system that stops it, and runs it for you — so you don't have to staff it.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="/readiness-map" class="btn btn-primary">Book your free Readiness Call
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
    <p class="mono reveal" data-d="3" style="margin-top:18px;font-size:12.5px;color:var(--fg-faint)">15 minutes. Tell us how your shop runs and we'll pinpoint your biggest money leak — free. No packet to dig up, no pitch.</p>
  </div>
</section>

<section class="section container" id="problem">
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">The problem</span>
    <h2 class="h2">You don't lose money on the big stuff.</h2>
    <p class="lede" style="margin-inline:0">You lose it on the boring failures nobody's counting:</p>
  </div>
  <ul class="leak-list">
    <li><span class="lk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 16V6h11v10M14 9h4l3 3v4h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></span>A truck rolls out missing one part — now it's a hotshot and a half-day gone.</li>
    <li><span class="lk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6Z"/><path d="M9 12l2 2 4-4"/></svg></span>A cert lapsed three days ago and the crew gets turned around at the gate.</li>
    <li><span class="lk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></span>A tally gets re-keyed into Excel wrong, the invoice kicks back, the day vanishes.</li>
    <li><span class="lk-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg></span>Four people "checked" and everybody trusted the last guy.</li>
  </ul>
  <p class="lede" style="margin-inline:0;margin-top:8px">None of it is a skill problem. It's that <b>nothing catches it before the truck rolls.</b></p>
</section>

<section class="section container" id="how">
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">How it works</span>
    <h2 class="h2">Map it. Build the fix. Run it for you.</h2>
  </div>
  <div class="steps3">
    <div class="step3c"><span class="step3n">1</span><h3>Hop on a 15-min call — free.</h3><p>Tell us how your shop runs and where it hurts. We pinpoint your biggest money leak — that's your Readiness Map.</p></div>
    <div class="step3c"><span class="step3n">2</span><h3>We build the fix.</h3><p>A system tied to your actual jobs, specs, and rate sheets — built around your shop, not a template.</p></div>
    <div class="step3c"><span class="step3n">3</span><h3>We run it for you.</h3><p>Every week — so the misses get caught and you don't have to hire and train someone to watch it.</p></div>
  </div>
</section>

<section class="section container" id="fix">
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">What we fix</span>
    <h2 class="h2">The costs nobody's counting.</h2>
  </div>
  <div class="fixgrid">
    <div class="fixc"><h3>Paperwork &amp; tallies</h3><p>The re-keying that eats hours and kicks back invoices.</p></div>
    <div class="fixc"><h3>Loadouts that roll out wrong</h3><p>The truck leaves missing the one tool the job needed.</p></div>
    <div class="fixc"><h3>Cert &amp; paperwork misses</h3><p>The lapse that stops a job cold on location.</p></div>
    <div class="fixc"><h3>Dispatch chaos</h3><p>Schedules that don't know if the job's actually ready.</p></div>
    <div class="fixc"><h3>Invoice kickbacks</h3><p>Jobs that bill with weak backup and bounce back.</p></div>
    <div class="fixc"><h3>The trips back</h3><p>Hotshots, return runs, lost photos — the quiet bleed.</p></div>
  </div>
</section>

<section class="section container" id="why">
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Why SYNNR</span>
    <h2 class="h2">Built and run by an operator.</h2>
  </div>
  <div class="whygrid">
    <div class="whyc"><h3>An operator, not a software vendor</h3><p>Field background, not a login you have to figure out yourself.</p></div>
    <div class="whyc"><h3>Built around your shop</h3><p>Your specs, your rate sheets, your rules — not a one-size template.</p></div>
    <div class="whyc"><h3>We run it for you</h3><p>You get the result without hiring and training someone new.</p></div>
    <div class="whyc"><h3>Human-checked, field-tested</h3><p>Nothing goes live until it survives a real yard.</p></div>
  </div>
</section>

<section class="section container" id="proof">
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Proof</span>
    <h2 class="h2">Real results, soon.</h2>
    <p class="lede" style="margin-inline:0">We're onboarding our first design-partner shops now. Before-and-afters and real numbers go here once they're real — we don't make them up. Want to be one of the first? The Readiness Call is free.</p>
  </div>
</section>

<section class="section" id="faq">
  <div class="container">
    <div class="head"><span class="eyebrow">FAQ</span><h2 class="h2">Straight answers</h2></div>
    <div class="faq">
      <div class="qa"><button>Do I need to be technical?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>No. You show us the problem, we handle the build and run it. You never touch the tech.</p></div></div>
      <div class="qa"><button>Are you a software company?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>No. We're an operations partner. The tech is just how we fix it — it's invisible plumbing.</p></div></div>
      <div class="qa"><button>What's it cost?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Depends what's actually broken — that's what the free Readiness Call is for. No blind quotes. We price on what the leaks cost you, not on hours.</p></div></div>
      <div class="qa"><button>Is my data safe?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>Yes. Handled carefully, human in the loop, nothing leaves as final until it's checked.</p></div></div>
      <div class="qa"><button>How fast?<span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></span></button><div class="ans"><p>We map your biggest leak on the call. First build in weeks, not months.</p></div></div>
    </div>
  </div>
</section>

<section class="section final" id="cta">
  <div class="container">
    <div class="final-card">
      <div class="glow"></div>
      <span class="eyebrow" style="justify-content:center;margin-bottom:18px">Free Readiness Call</span>
      <h2 class="display">Tell us about your operation.</h2>
      <p class="lede" style="margin:14px auto 0">We'll find your biggest money leak — free. 15 minutes, no packet to dig up, no pitch.</p>
      <div class="hero-cta" style="justify-content:center;margin-top:26px">
        <a href="/readiness-map" class="btn btn-primary">Book your free Readiness Call
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
    </div>
  </div>
</section>

</main>

<footer class="footer">
  <div class="container">
    <div class="footer-bottom" style="border:0;padding-top:0">
      <a class="brand" href="/" aria-label="SYNNR">
        <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7"/></svg>
        <span class="wordmark">SYNNR</span>
      </a>
      <span style="color:var(--fg-faint)">Operations systems for service shops · <a href="mailto:cadencain@darkstarops.com" style="color:var(--accent-ink)">cadencain@darkstarops.com</a></span>
    </div>
  </div>
</footer>
`;
