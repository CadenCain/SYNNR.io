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
      <a href="/login" class="nav-login">Log in</a>
      <a href="/signup" class="btn btn-primary btn-sm">Start free</a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile">
      <a href="#problem">The problem</a>
      <a href="#how">How it works</a>
      <a href="#track">What we track</a>
      <a href="#pricing">Pricing</a>
      <a href="/login">Log in</a>
      <a href="/signup">Start free</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="hero section">
  <div class="container">
    <span class="pill-badge reveal"><span class="d"></span>Equipment &amp; cert readiness for oilfield service shops</span>
    <h1 class="display reveal" data-d="1">Keep your crews<br/>rolling <span class="grad">ready</span></h1>
    <p class="lede reveal" data-d="2">Track every asset and cert in your yard — tools, BOPs, trailers, crew certs, DOT. Snap a photo, set the date, and get a text before anything expires or goes missing. Set it up yourself in minutes, or import your list and load a whole yard at once.</p>
    <div class="hero-cta reveal" data-d="3">
      <a href="/signup" class="btn btn-primary">Start free — 14 days
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
      <a href="#pricing" class="btn btn-ghost">See pricing</a>
    </div>
    <p class="mono reveal" data-d="3" style="margin-top:18px;font-size:12.5px;color:var(--fg-faint)">Start free, no card to look around · cancel anytime · your data, exportable.</p>
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
    <h2 class="h2" data-fx="words">Up and running in an afternoon.</h2>
  </div>
  <div class="steps3">
    <div class="step3c"><span class="step3n">1</span><h3>Sign up &amp; add your yard</h3><p>Create your account and add a yard. Import an existing asset/cert list or add as you go.</p></div>
    <div class="step3c"><span class="step3n">2</span><h3>Snap a photo of each cert &amp; asset</h3><p>Photograph the cert or asset, set the expiration date. That's the record — done from your phone.</p></div>
    <div class="step3c"><span class="step3n">3</span><h3>Get a text before it expires</h3><p>We watch every date across every yard. You get the heads-up before it lapses — not after.</p></div>
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
    <div class="whyc"><h3>Yours in minutes</h3><p>Add a yard, snap your certs, done. No consultant, no data-entry marathon — import your list and go. (Or have us load it for you.)</p></div>
    <div class="whyc"><h3>Built by an operator</h3><p>5 years on Permian wireline. I've lived the 5am scramble and built SYNNR to kill it.</p></div>
    <div class="whyc"><h3>Proactive, not reactive</h3><p>&ldquo;BOP #3 expires in 10 days&rdquo; — you hear about it before it costs you, not after.</p></div>
    <div class="whyc"><h3>Every yard, one view</h3><p>All your locations, all your gear, one place — no whiteboard, no three spreadsheets.</p></div>
  </div>
</section>

<section class="section container" id="proof" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Proof</span>
    <h2 class="h2" data-fx="words">Built by someone who's lived the 5am scramble.</h2>
    <p class="lede" style="margin-inline:0;max-width:72ch">
      SYNNR is built and run by an operator with 5 years on Permian wireline — not a software vendor guessing at your yard. Starting free is the proof: add a yard, snap a few certs, and see exactly what's expired, expiring, and missing in your operation before you pay a dollar.
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
  <p class="miss-kicker"><b>One prevented NPT day covers more than two years of SYNNR for a yard.</b> Everything after that is pure protection.</p>
  <p class="miss-note">Typical industry cost ranges for illustration, not guarantees.</p>
</section>

<section class="section container" id="pricing" data-fx-atmos>
  <div class="head" style="text-align:left;margin-inline:0">
    <span class="eyebrow">Pricing</span>
    <h2 class="h2" data-fx="words">Priced per yard. Scales with you.</h2>
    <p class="lede" style="margin-inline:0;max-width:64ch">Flat monthly, per yard — never per-seat, so you're never punished for adding crew. Less than $10 a day per yard. Annual billing saves two months.</p>
  </div>
  <div class="tiers">
    <div class="tier">
      <div class="tier-name">Single Yard</div>
      <p class="tier-best">1 yard, getting started</p>
      <div class="tier-price">$298<span>per yard / month, billed annually</span></div>
      <ul class="tier-features">
        <li>Unlimited assets &amp; users</li>
        <li>Photo + proof storage</li>
        <li>Email expiration alerts</li>
        <li>The full renewal loop</li>
      </ul>
      <a href="/signup" class="btn btn-primary btn-sm tier-cta">Start free</a>
    </div>
    <div class="tier tier-featured">
      <span class="tier-pop">Most popular</span>
      <div class="tier-name">Operator</div>
      <p class="tier-best">Growing shops, 2+ yards</p>
      <div class="tier-price">$258<span>per yard / month, billed annually</span></div>
      <ul class="tier-features">
        <li>Everything in Single Yard</li>
        <li>SMS &ldquo;you get the text&rdquo; alerts</li>
        <li>Roles &amp; permissions</li>
        <li>CSV import + priority support</li>
      </ul>
      <a href="/signup" class="btn btn-primary btn-sm tier-cta">Start free</a>
    </div>
    <div class="tier">
      <div class="tier-name">Fleet</div>
      <p class="tier-best">Multi-yard operations</p>
      <div class="tier-price">Custom<span>for 3+ locations</span></div>
      <ul class="tier-features">
        <li>Everything in Operator</li>
        <li>SSO + dedicated support</li>
        <li>Done-for-you yard load</li>
        <li>Custom integrations</li>
      </ul>
      <a href="/readiness-audit" class="btn btn-ghost btn-sm tier-cta">Talk to us</a>
    </div>
  </div>
  <p class="tiers-note">14-day free trial · cancel anytime · your data, exportable. Don&apos;t want to do the data entry? Our team will load your whole yard for you — $998&ndash;$3,000 one-time, then you&apos;re self-serve.</p>
</section>

<section class="section final" id="cta">
  <div class="container">
    <div class="final-card">
      <div class="glow"></div>
      <span class="eyebrow" style="justify-content:center;margin-bottom:18px">Start free</span>
      <h2 class="display">Stop getting turned around at the gate.</h2>
      <p class="lede" style="margin:14px auto 0">Add your first yard, snap your certs, and get a text before anything expires. Free for 14 days — load your list in minutes.</p>
      <div class="hero-cta" style="justify-content:center;margin-top:26px">
        <a href="/signup" class="btn btn-primary">Start free — 14 days
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="/login" class="btn btn-ghost">Log in</a>
      </div>
      <p class="mono" style="margin-top:18px;font-size:13px;color:var(--fg-faint)">14-day free trial · cancel anytime · or email <a href="mailto:cadencain@darkstarops.com" style="color:var(--accent-ink)">cadencain@darkstarops.com</a></p>
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
