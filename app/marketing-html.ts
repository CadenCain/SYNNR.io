// RollReady marketing page (product by SYNNR) — "editorial industrial" v2.
// Structure: dark hero with mono data block → light problem band → dark
// product demo + check → light how-it-works + pricing → dark statement,
// ledger, final CTA. Two-tone display type, hairline grids, square buttons.
// Operator voice. CTAs → /signup. Rendered via dangerouslySetInnerHTML +
// MarketingScripts + MarketingFx.
export const MARKETING_HTML = `
<header class="nav" id="nav">
  <div class="nav-pill">
    <a class="brand" href="/" aria-label="RollReady by SYNNR">
      <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#ece5d7"/>
      </svg>
      <span class="wordmark">RollReady</span><span class="by-synnr">by SYNNR</span>
    </a>
    <nav class="nav-links">
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="/partners">Partners</a>
      <a href="/build">Custom builds</a>
    </nav>
    <div class="nav-cta">
      <a href="/login" class="nav-login">Log in</a>
      <a href="/signup" class="btn btn-primary btn-sm">Get started</a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile">
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="/partners">Partners</a>
      <a href="/build">Custom builds</a>
      <a href="/readiness-audit">Free readiness map</a>
      <a href="/login">Log in</a>
      <a href="/signup">Get started</a>
    </nav>
  </div>
</header>

<main id="top">

<!-- ═══ HERO — dark, left-anchored, mono data block ═══ -->
<section class="band hero">
  <div class="container">
    <div class="hero-main">
      <span class="eyebrow reveal">Yard readiness · oilfield service shops</span>
      <h1 class="display reveal" data-d="1"><span class="lt">The truck rolls</span> ready.<br/><span class="dim">Or it doesn't roll.</span></h1>
      <p class="lede reveal" data-d="2">RollReady runs the pre-dispatch check that catches the missing BOP, the lapsed cert, and the expired crew card before the truck leaves the yard. Built by a Permian wireline hand, not a software vendor.</p>
      <div class="hero-cta reveal" data-d="3">
        <a href="/signup" class="btn btn-primary">Get started
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="/readiness-audit" class="btn btn-ghost">Free readiness map</a>
      </div>
    </div>
    <div class="hero-foot reveal" data-d="3">
      <p class="fineprint">Billed monthly. Cancel anytime. Your data stays yours, exportable.</p>
      <div class="dt" role="table" aria-label="The math">
        <div class="dt-row"><span class="k">One miss on location, NPT</span><span class="v bad">$10,000+ / day</span></div>
        <div class="dt-row"><span class="k">RollReady, per yard</span><span class="v">$500 / mo</span></div>
        <div class="dt-row"><span class="k">Setup</span><span class="v">one afternoon</span></div>
      </div>
    </div>
  </div>
</section>

<!-- ═══ PROBLEM — light paper band ═══ -->
<section class="band band-light section" id="problem">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">The problem</span>
      <h2 class="h2">You don't lose money on the big stuff.<br/><span class="dim">You lose it at 5am.</span></h2>
      <p class="lede">A crew's gotta roll and the gear's not there. Or it's the wrong one. Or the BOP cert expired and nobody knew. Your whole yard lives in somebody's head, a whiteboard, and three spreadsheets — so the failure isn't an if, it's a when. The crew rolls late or wrong, you eat the NPT, you pay the hotshot, and the operator remembers. He's got a long memory and a short vendor list.</p>
      <p class="lede" style="margin-top:18px"><b style="color:var(--fg)">Every shop deals with this. The only question is how much it's quietly costing you.</b></p>
    </div>
  </div>
</section>

<!-- ═══ PRODUCT DEMO — dark, the living artifact ═══ -->
<section class="band section showcase" id="showcase">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">Inside RollReady</span>
      <h2 class="h2">Watch it catch the miss.</h2>
      <p class="lede">The board a shop leaves open all day. Every tile is a truck. Watch Truck 12 get stopped at the gate.</p>
    </div>

    <div class="show-stage">
      <div class="show-frame" role="img" aria-label="RollReady command center: fleet readiness board with two trucks Ready and Truck 12 flagged NOT READY — BOP number 3 missing from the asset list">
        <div class="show-bar" aria-hidden="true"><i></i><i></i><i></i><span>RollReady — command center</span></div>
        <div class="show-body" aria-hidden="true">
          <div class="show-kpis">
            <div class="show-kpi k1"><span class="lbl">Readiness</span><span class="val amber" data-n="74" data-suffix="%">74%</span><span class="bar"><i></i></span></div>
            <div class="show-kpi k2"><span class="lbl">Due soon</span><span class="val amber" data-n="3">3</span><span class="sub">next 30 days</span></div>
            <div class="show-kpi k3"><span class="lbl">Misses caught</span><span class="val green" data-n="4">4</span><span class="sub">this month</span></div>
          </div>
          <div class="show-board">
            <div class="show-tile t1"><span class="tname">Wireline 7</span><span class="chip ok">Ready</span><span class="twhy">All current</span></div>
            <div class="show-tile t2"><span class="tname">Pump 3</span><span class="chip ok">Ready</span><span class="twhy">DOT good · crew current</span></div>
            <div class="show-tile t3">
              <span class="tname">Truck 12</span>
              <span class="chip scan">Checking…</span>
              <span class="chip bad">Not ready</span>
              <span class="twhy why-ok">Running loadout check…</span>
              <span class="twhy why-bad">BOP #3 — missing</span>
            </div>
          </div>
          <div class="show-banner">
            <span class="bang">!</span>
            <span class="btext"><b>NOT READY — Truck 12.</b> BOP #3 missing from the asset list · fix it or it stays red</span>
          </div>
          <div class="show-feed">
            <span class="dotline"></span>Caught before rollout on Truck 12: BOP #3 — missing <span class="ftime">4:58 AM</span>
          </div>
        </div>
      </div>

      <div class="show-chip c1" aria-hidden="true">
        <span class="cico">▮</span>
        <span><b>RollReady:</b> Truck 12 NOT ready — BOP missing. —your shop</span>
      </div>
      <div class="show-chip c2" aria-hidden="true">
        <span class="cok">✓</span>
        <span>Readiness proof — <b>shared with operator</b></span>
      </div>
    </div>

    <p class="show-caption">That red banner is the product. The miss caught in the yard at 5am, not on location at 9 with a company man watching.</p>
    <div class="show-cta">
      <a href="/signup" class="btn btn-primary">Catch your first miss
        <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>
    </div>
  </div>
</section>

<!-- ═══ THE CHECK — dark continues, hairline grid ═══ -->
<section class="band section" id="dispatch" style="padding-top:0">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">The 5am check</span>
      <h2 class="h2">No override button.<br/><span class="dim">You fix it or it stays red.</span></h2>
      <p class="lede">A cert tracker tells you what expired last week. RollReady runs the loadout check on the phone before the truck rolls: every required asset, every cert and DOT item, every assigned crew card, pulled live. Anything off and the truck reads <b style="color:var(--fg)">Not ready</b> — and names every item.</p>
    </div>
    <div class="hairgrid">
      <div class="cell"><span class="num">01</span><h3>Loadout check</h3><p>Right gear, right paper, right crew. A green light or an itemized &ldquo;here&rsquo;s what&rsquo;s wrong.&rdquo;</p></div>
      <div class="cell"><span class="num">02</span><h3>Immutable records</h3><p>Every check is recorded: who ran it, what it found, when. Read-only after. That record is your proof.</p></div>
      <div class="cell"><span class="num">03</span><h3>Crew cards count</h3><p>The assigned hand&rsquo;s H2S, well control, and medical count toward ready. An expired card blocks the green light.</p></div>
      <div class="cell"><span class="num">04</span><h3>Proof on demand</h3><p>One tap sends the operator a live, read-only proof page. No more building a binder every quarter.</p></div>
    </div>
  </div>
</section>

<!-- ═══ HOW IT WORKS — light band ═══ -->
<section class="band band-light section" id="how">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">How it works</span>
      <h2 class="h2">Up and running in an afternoon.</h2>
    </div>
    <div class="hairgrid cols3">
      <div class="cell"><span class="num">01</span><h3>Load your yard</h3><p>Add a yard, trucks, gear, and crew. Import your existing list in minutes, or add as you go from your phone.</p></div>
      <div class="cell"><span class="num">02</span><h3>Run the check</h3><p>Before a truck leaves, run the loadout check: right gear, right paper, right crew, all current. Not ready? The screen says exactly what's wrong.</p></div>
      <div class="cell"><span class="num">03</span><h3>Get the heads-up</h3><p>We watch every date across every yard and crew. You get the text before it lapses, and hand the operator a proof link on demand.</p></div>
    </div>
    <div class="dt" style="margin-top:56px" role="table" aria-label="What we track">
      <div class="dt-row"><span class="k">Equipment &amp; assets</span><span class="v">tools · BOPs · lubricators · trailers</span></div>
      <div class="dt-row"><span class="k">Certs, inspections &amp; DOT</span><span class="v">BOP tests · annual DOT · safety</span></div>
      <div class="dt-row"><span class="k">Crew &amp; crew cards</span><span class="v">H2S · well control · CDL · medical</span></div>
      <div class="dt-row"><span class="k">Every date, watched</span><span class="v">flagged before it lapses, not after</span></div>
    </div>
  </div>
</section>

<!-- ═══ COST OF A MISS — dark ledger ═══ -->
<section class="band section" id="miss">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">Cost of a miss</span>
      <h2 class="h2">Cheaper than one bad day.</h2>
    </div>
    <ul class="miss-list" aria-label="What a single miss costs">
      <li class="miss-item"><span class="miss-what">A day of NPT sitting on location</span><span class="miss-cost">$10,000+</span></li>
      <li class="miss-item"><span class="miss-what">A hotshot run to chase down what got left behind</span><span class="miss-cost">$500&ndash;$2,000</span></li>
      <li class="miss-item"><span class="miss-what">A failed DOT inspection that sidelines a truck</span><span class="miss-cost">thousands + lost days</span></li>
      <li class="miss-item"><span class="miss-what">A failed safety audit</span><span class="miss-cost">fines &amp; shutdowns</span></li>
      <li class="miss-item"><span class="miss-what">Getting dropped from an operator's vendor list</span><span class="miss-cost">the whole account</span></li>
    </ul>
    <p class="miss-kicker"><b>One prevented NPT day covers more than a year and a half of RollReady.</b> Everything after that is pure protection.</p>
    <p class="miss-note">Typical industry cost ranges for illustration, not guarantees.</p>
  </div>
</section>

<!-- ═══ PRICING — light paper, one giant number ═══ -->
<section class="band band-light section" id="pricing">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">Pricing</span>
      <h2 class="h2">One number. Per yard.</h2>
      <p class="lede">Flat monthly, per yard. Never per-seat, so you're never punished for adding crew or trucks. No contracts. No annual lock-in.</p>
    </div>
    <div class="price-hero">
      <div class="price-big">$500<span>per yard / month</span></div>
      <p class="price-why">That's about half a day of one hand's wages. One miss it catches — one expired DOT, one lapsed BOP — costs you a truck for a day and $10,000+ in NPT. If it stops that once a year, it paid for itself twenty times over.</p>
      <ul class="price-hero-features">
        <li>Pre-dispatch loadout checks with enforcement</li>
        <li>Certs, DOT, gear &amp; crew cards — alerts before they lapse</li>
        <li>Readiness proof links + immutable dispatch records</li>
        <li>Unlimited assets, crew &amp; users. Every yard costs the same.</li>
      </ul>
      <div class="hero-cta">
        <a href="/signup" class="btn btn-primary">Get started
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="/readiness-audit" class="btn btn-ghost">Get a free readiness map</a>
      </div>
      <p class="mono" style="margin-top:18px;font-size:12px;color:var(--fg-faint)">Card required · billed monthly per active yard · cancel anytime · your data, exportable.</p>
    </div>

    <div class="setup-card">
      <h3>Don't want to do the data entry? Setup is optional and one-time.</h3>
      <p>Load your own yard free with the importer, or we do it for you:</p>
      <div class="setup-opts">
        <div class="setup-opt">
          <span class="so-k">Remote setup</span>
          <div class="so-p">$750 <small>first yard · +$250 each additional</small></div>
          <p>Send your lists and spreadsheets; we load the yard and hand it back running.</p>
        </div>
        <div class="setup-opt">
          <span class="so-k">Onsite setup</span>
          <div class="so-p">$1,500 <small>first yard · +$400 each additional</small></div>
          <p>In person, anywhere in the Permian Basin / West Texas. Outside the region: same rate plus travel at cost.</p>
        </div>
      </div>
      <p class="setup-note">3+ yards, or need something custom? <a href="mailto:cadencain@synnr.io">Talk to us</a> — fleet deals are negotiated, not discounted by formula.</p>
    </div>
  </div>
</section>

<!-- ═══ FOUNDER STATEMENT — dark ═══ -->
<section class="band section statement" id="why">
  <div class="container">
    <span class="eyebrow" style="margin-bottom:26px">Why RollReady exists</span>
    <p>Five years on Permian wireline. I've eaten the 5am scramble, the hotshot bill, and the company man's long memory. <b>RollReady is the tool I needed and nobody built.</b></p>
    <div class="sig">Caden Cain · founder, SYNNR · Texas</div>
    <p class="mono" style="margin-top:34px;font-size:12px;color:var(--fg-ghost);max-width:52ch;line-height:1.7">No fake logos. No made-up numbers. We're onboarding our first shops now — real numbers go here the day they're real.</p>
  </div>
</section>

<!-- ═══ CUSTOM BUILDS — dark strip ═══ -->
<section class="band section tight build-strip" id="build">
  <div class="container">
    <div class="shead">
      <span class="eyebrow">Custom builds · SYNNR</span>
      <h2 class="h2" style="font-size:clamp(26px,3.4vw,40px)">Got a paper problem RollReady doesn't cover?</h2>
      <p class="lede">SYNNR, the shop behind RollReady, builds custom software for oilfield and blue-collar operations: field tickets, invoicing, rental tracking, dispatch boards, digital forms. Built by a hand who's run the yard, not an agency guessing at it.</p>
      <div class="hero-cta" style="margin-top:28px">
        <a href="/build" class="btn btn-ghost">See custom builds
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ═══ FINAL CTA — dark, huge ═══ -->
<section class="band section final" id="cta">
  <div class="container">
    <div class="final-card">
      <span class="eyebrow" style="margin-bottom:24px">Get started</span>
      <h2 class="display" style="font-size:clamp(40px,6.4vw,84px)"><span class="lt">Stop getting turned around</span> at the gate.</h2>
      <p class="lede">Load your yard, run the check, and stop the not-ready truck before it costs you a day. Import your list and go.</p>
      <div class="hero-cta">
        <a href="/signup" class="btn btn-primary">Get started
          <svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </a>
        <a href="/login" class="btn btn-ghost">Log in</a>
      </div>
      <p class="mono" style="margin-top:20px;font-size:12px;color:var(--fg-faint)">Billed monthly · cancel anytime · or email <a href="mailto:cadencain@synnr.io" style="color:var(--fg)">cadencain@synnr.io</a></p>
    </div>
  </div>
</section>

</main>

<footer class="footer">
  <div class="container">
    <div class="footer-bottom">
      <a class="brand" href="/" aria-label="RollReady by SYNNR">
        <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7"/></svg>
        <span class="wordmark">SYNNR</span>
      </a>
      <span>Yard readiness for oilfield service shops · <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a></span>
    </div>
  </div>
</footer>
`;
