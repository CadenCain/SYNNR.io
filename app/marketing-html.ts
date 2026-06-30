// SYNNR marketing page — done-for-you equipment & cert readiness tracking for
// oilfield service shops. We track every asset + cert, alert before anything
// lapses, run it for the shop. Operator voice. Every CTA → the free readiness
// audit (email funnel). Rendered via dangerouslySetInnerHTML + MarketingScripts.
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
      <a href="#track">What we track</a>
      <a href="#why">Why SYNNR</a>
    </nav>
    <div class="nav-cta">
      <a href="/app" class="nav-login">Log in</a>
      <a href="/readiness-audit" class="btn btn-primary btn-sm">Free readiness audit</a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile">
      <a href="#problem">The problem</a>
      <a href="#how">How it works</a>
      <a href="#track">What we track</a>
      <a href="#why">Why SYNNR</a>
      <a href="/app">Log in</a>
      <a href="/readiness-audit">Free readiness audit</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="hero section">
  <div class="container">
    <span class="pill-badge reveal"><span class="d"></span>Equipment &amp; cert readiness for oilfield service shops</span>
    <h1 class="display reveal" data-d="1">Keep your crews<br/>rolling <span class="grad">ready</span></h1>
    <p class="lede reveal" data-d="2">SYNNR is a done-for-you readiness system for oilfield service shops. We track every asset and cert in your yard, text you before anything expires or goes missing, and keep a live check-out/check-in — so a crew never rolls out late, short, or with a lapsed cert again. You don't log into anything. We run it. You get the text.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="/readiness-audit" class="btn btn-primary">Get your free readiness audit
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
    <p class="mono reveal" data-d="3" style="margin-top:18px;font-size:12.5px;color:var(--fg-faint)">Tell us about your yard or we come log it on-site. We show you what's expired, expiring, and missing — free.</p>
  </div>
</section>

<section class="section container" id="problem" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">The problem</span>
    <h2 class="h2" data-fx="words">You don't lose money on the big stuff.</h2>
  </div>
  <p class="lede" style="margin-inline:0;max-width:72ch">
    You lose it at 5am, when a crew's gotta roll and the gear's not there — or it's the wrong one, or the BOP cert
    expired and nobody knew. Right now your whole yard lives in somebody's head, a whiteboard, and three spreadsheets.
    So the failure isn't an <b>if</b>, it's a <b>when</b>: the crew rolls out late or with the wrong gear, you eat the
    NPT, you pay for the hotshot, and you look unreliable to the operator — who's got a long memory and a short vendor
    list. Every shop deals with this. The only question is how much it's quietly costing you.
  </p>
</section>

<section class="section container" id="why-need" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Why you need it</span>
    <h2 class="h2" data-fx="words">You're already buried.</h2>
  </div>
  <p class="lede" style="margin-inline:0;max-width:72ch">
    The last thing you've got time for is walking the yard checking what's expired, what's out, or what's even here —
    so you don't, until it bites you. SYNNR takes it off your plate completely. One live view of every asset and cert,
    a text before anything goes down, and a check-out/check-in system so you always know what's out and what's in the
    yard. You stop checking. You stop wondering. You stop getting surprised.
  </p>
  <div class="callout">One prevented NPT day pays for it ten times over. It's not a cost — it's insurance against a bleed you've already got.</div>
</section>

<section class="section container" id="how" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">How it works</span>
    <h2 class="h2" data-fx="words">We set it up. We run it. You get the text.</h2>
  </div>
  <div class="steps3">
    <div class="step3c"><span class="step3n">1</span><h3>Free readiness audit</h3><p>Tell us about your yard or we come log it on-site. We show you what's expired, expiring, and missing.</p></div>
    <div class="step3c"><span class="step3n">2</span><h3>We build your readiness system</h3><p>Every asset and cert — with status, location, and expiration dates. Done for you.</p></div>
    <div class="step3c"><span class="step3n">3</span><h3>You're covered</h3><p>Automatic text alerts before anything lapses, check-out/check-in so nothing walks off, one view across every yard. We watch it. You get the text.</p></div>
  </div>
</section>

<section class="section container" id="track" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">What we track</span>
    <h2 class="h2" data-fx="words">Everything that has to be ready.</h2>
  </div>
  <div class="fixgrid">
    <div class="fixc"><h3>Equipment &amp; assets</h3><p>Tools, BOPs, trailers — anything in the yard.</p></div>
    <div class="fixc"><h3>Certs &amp; inspections</h3><p>Crew certs (H2S, well control) and equipment tests (BOP tests, etc.).</p></div>
    <div class="fixc"><h3>Check-out / check-in</h3><p>Who's got it, where it is, what's back.</p></div>
    <div class="fixc"><h3>Last-tested &amp; expiration dates</h3><p>Flagged before they lapse — not after.</p></div>
  </div>
</section>

<section class="section container" id="why" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Why SYNNR</span>
    <h2 class="h2" data-fx="words">Built by someone who's lived it.</h2>
  </div>
  <div class="whygrid">
    <div class="whyc"><h3>Done for you</h3><p>Your team never logs into anything or maintains a thing. We run it.</p></div>
    <div class="whyc"><h3>Built by an operator</h3><p>5 years on Permian wireline. I've lived the 5am scramble and built SYNNR to kill it.</p></div>
    <div class="whyc"><h3>Proactive, not reactive</h3><p>&ldquo;BOP #3 expires in 10 days&rdquo; — you hear about it before it costs you, not after.</p></div>
    <div class="whyc"><h3>Every yard, one view</h3><p>All your locations, all your gear, one place — no whiteboard, no three spreadsheets.</p></div>
  </div>
</section>

<section class="section container" id="pricing" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Pricing</span>
    <h2 class="h2" data-fx="words">Priced to your operation.</h2>
    <p class="lede" style="margin-inline:0;max-width:64ch">Flat monthly, priced per asset and per yard. Setup is one-time — we log your yard and build the system. Pick the tier that fits; we confirm the exact number at your free audit.</p>
  </div>
  <div class="tiers">
    <div class="tier">
      <div class="tier-name">Single Yard</div>
      <p class="tier-best">1 yard, up to ~100 assets</p>
      <div class="tier-row"><span>Setup (one-time)</span><b>$500</b></div>
      <div class="tier-row"><span>Monthly</span><b>$300&ndash;$500</b></div>
    </div>
    <div class="tier tier-featured">
      <div class="tier-name">Multi-Crew</div>
      <p class="tier-best">1&ndash;2 yards, a few hundred assets</p>
      <div class="tier-row"><span>Setup (one-time)</span><b>$1,000</b></div>
      <div class="tier-row"><span>Monthly</span><b>$750&ndash;$1,500</b></div>
    </div>
    <div class="tier">
      <div class="tier-name">Multi-Yard</div>
      <p class="tier-best">3+ locations</p>
      <div class="tier-row"><span>Setup (one-time)</span><b>Custom</b></div>
      <div class="tier-row"><span>Monthly</span><b>Custom</b></div>
    </div>
  </div>
  <p class="tiers-note">Final number is set at your free readiness audit, once we both know exactly what we're tracking. One prevented NPT day covers a year of any tier.</p>
  <div class="hero-cta" style="margin-top:22px">
    <a href="/readiness-audit" class="btn btn-primary">Get your free readiness audit
      <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    </a>
  </div>
</section>

<section class="section container" id="proof" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Proof</span>
    <h2 class="h2" data-fx="words">Built by someone who's lived the 5am scramble.</h2>
    <p class="lede" style="margin-inline:0;max-width:72ch">
      SYNNR is built and run by an operator with 5 years on Permian wireline — not a software vendor guessing at your yard. The free readiness audit is the proof: before you pay a dollar, we show you exactly what's expired, expiring, and missing in your operation. You see the value before you buy it.
    </p>
    <p class="lede" style="margin-inline:0;max-width:72ch;color:var(--fg-dim);font-size:16px">
      We're onboarding our first shops now. Real numbers go here the day they're real — we don't make them up.
    </p>
  </div>
</section>

<section class="section container" id="miss" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Cost of a miss</span>
    <h2 class="h2" data-fx="words">Cheaper than one bad day.</h2>
    <p class="lede" style="margin-inline:0;max-width:64ch">You already know what a miss costs. Here's the math we're up against — and we're a fraction of any single one.</p>
  </div>
  <ul class="miss-list" aria-label="What a single miss costs">
    <li class="miss-item"><span class="miss-what">A day of NPT sitting on location</span><span class="miss-cost">$10,000+</span></li>
    <li class="miss-item"><span class="miss-what">A hotshot run to chase down what got left behind</span><span class="miss-cost">$500&ndash;$2,000</span></li>
    <li class="miss-item"><span class="miss-what">A failed DOT inspection that sidelines a truck</span><span class="miss-cost">Thousands + lost revenue days</span></li>
    <li class="miss-item"><span class="miss-what">A failed safety audit</span><span class="miss-cost">Fines, shutdowns, paperwork hell</span></li>
    <li class="miss-item"><span class="miss-what">Getting dropped from an operator's vendor list</span><span class="miss-cost">The whole account</span></li>
  </ul>
  <p class="miss-kicker"><b>One prevented NPT day pays for 6&ndash;12 months of SYNNR.</b> Everything after that is pure protection.</p>
  <p class="miss-note">Typical industry cost ranges for illustration, not guarantees.</p>
</section>

<section class="section final" id="cta">
  <div class="container">
    <div class="final-card">
      <div class="glow"></div>
      <span class="eyebrow" style="justify-content:center;margin-bottom:18px">Free readiness audit</span>
      <h2 class="display">Get your free readiness audit.</h2>
      <p class="lede" style="margin:14px auto 0">Tell us about your operation — or we'll come log it on-site. We'll show you what's expired, expiring, and missing. No charge.</p>
      <div class="hero-cta" style="justify-content:center;margin-top:26px">
        <a href="/readiness-audit" class="btn btn-primary">Get your free readiness audit
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
      <p class="mono" style="margin-top:18px;font-size:13px;color:var(--fg-faint)">Or just email <a href="mailto:cadencain@darkstarops.com" style="color:var(--accent-ink)">cadencain@darkstarops.com</a></p>
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
      <span style="color:var(--fg-faint)">Equipment &amp; cert readiness for oilfield service shops · <a href="mailto:cadencain@darkstarops.com" style="color:var(--accent-ink)">cadencain@darkstarops.com</a></span>
    </div>
  </div>
</footer>
`;
