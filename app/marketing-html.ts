import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

// An older static version of the RollReady homepage (not imported anywhere;
// app/page.tsx is the live one). Kept on the quick check pitch: make sure the
// right stuff goes out, a check at the truck in under a minute, and a locked
// record of who cleared the truck. No screenshots of the old full-check flow,
// and no customer names or counts anywhere.

const ICON = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  qr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>`,
  box: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z"/><path d="M15 9l-6 6"/><path d="m9 9 6 6"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  signal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  dollar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
};

export const MARKETING_HTML = `
<header class="nav nav-navy" id="nav">
  <div class="nav-pill">
    <a class="brand" href="/" aria-label="RollReady by SYNNR">
      <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#6f95ff"/>
      </svg>
      <span class="wordmark">RollReady</span><span class="by-synnr">by SYNNR</span>
    </a>
    <nav class="nav-links" aria-label="Main">
      <a href="#how">How it works</a>
      <a href="#product">What's in it</a>
      <a href="#pricing">Pricing</a>
      <a href="/demo">Live demo</a>
    </nav>
    <div class="nav-cta">
      <a href="${OWNER_PHONE_TEL}" class="nav-login">${OWNER_PHONE}</a>
      <a href="/login" class="nav-login">Log in</a>
      <a href="/signup" class="nav-start">Get started</a>
      <a href="/demo" class="btn btn-primary btn-sm"><span class="lbl-long">Open the live demo</span><span class="lbl-short">Live demo</span></a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile" aria-label="Menu">
      <a href="#how">How it works</a>
      <a href="#product">What's in it</a>
      <a href="#pricing">Pricing</a>
      <a href="/demo">Live demo</a>
      <a href="/signup">Get started</a>
      <a href="${OWNER_PHONE_TEL}">Call or text ${OWNER_PHONE}</a>
      <a href="/login">Log in</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="x-hero band-navy" aria-labelledby="hero-h">
  <div class="container x-hero-grid">
    <div class="x-hero-copy">
      <p class="x-kicker">Load-out checks for oilfield service yards</p>
      <h1 id="hero-h">Make sure the right stuff goes out.</h1>
      <p class="x-lede">RollReady is a check at the truck that takes under a minute. The hand taps what's on it, takes one photo, and taps Ready. If anything's missing, it reads NOT READY and says what. And you always know who cleared the truck.</p>
      <div class="x-cta">
        <a href="/demo" class="btn btn-primary">Open the live demo</a>
        <a href="${OWNER_PHONE_TEL}" class="btn btn-ghost">Call or text ${OWNER_PHONE}</a>
      </div>
      <p class="x-note">The demo is the real app with a made-up yard. No signup, no card. Ready for your own yard? <a href="/signup">Get started</a>.</p>
    </div>
    <div class="x-card x-proofcard">
      <h3>WL-07 · Plug set</h3>
      <ul class="x-checks">
        <li>${ICON.check}<span>Sinker bars: on truck</span></li>
        <li>${ICON.check}<span>Crossover subs: on truck</span></li>
        <li>${ICON.check}<span>Baker 20 setting tool: on truck</span></li>
        <li>${ICON.check}<span>Frac plugs × 3: all 3 on</span></li>
        <li>${ICON.check}<span>BOP rams closed for travel: done</span></li>
        <li>${ICON.check}<span>Photo of the loaded truck: taken 5:01 AM</span></li>
      </ul>
      <p class="x-body"><b>READY.</b> Cleared by Dale Wooten at 5:02 AM. The record is locked, and the proof link is ready for the operator.</p>
    </div>
  </div>
</section>

<section class="x-section band-light" id="problem" aria-labelledby="problem-h">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2" id="problem-h">What still costs shops money</h2>
      <p class="x-sub">The everyday miss is the wrong gear on the truck, a hotshot to fix it, and nobody knowing who cleared the truck.</p>
    </div>
    <div class="x-grid x-grid-2">
      <article class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Right truck, missing a piece</h3><p>The sinker bars are still on the rack. The crew waits on location for a hotshot.</p></div></article>
      <article class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>"Truck's loaded" in a group text</h3><p>Something's missing, and nobody can say who cleared the truck or what they said was on it.</p></div></article>
    </div>
  </div>
</section>

<section class="x-section" id="how" aria-labelledby="how-h">
  <div class="container">
    <div class="x-head">
      <p class="x-kicker x-kicker-blue">How it works</p>
      <h2 class="x-h2" id="how-h">Under a minute at the truck</h2>
    </div>
    <ol class="x-grid x-grid-3 x-steps">
      <li class="x-card x-step"><span class="x-num">1</span><h3>Set each truck's list once</h3><p>A manager picks the 5 to 8 things that cause a hotshot when they get left behind. Add a job list like Plug set if you want one. No iron to enter, no serials, no cert dates.</p></li>
      <li class="x-card x-step"><span class="x-num">2</span><h3>Check it at the truck</h3><p>The hand taps the truck, taps On truck on each line, taps checks like BOP rams closed for travel, takes one photo, and taps Ready. Anything not tapped reads <b>NOT READY</b> and says what's missing.</p></li>
      <li class="x-card x-step"><span class="x-num">3</span><h3>The record locks</h3><p>Who cleared the truck, what they said was on it, the photo, and the time. Nobody can edit it. The operator gets a proof link that shows the same.</p></li>
    </ol>
    <div class="x-cta x-cta-center">
      <a href="/demo" class="btn btn-primary">Check a truck in the demo</a>
    </div>
  </div>
</section>

<section class="x-section band-light" id="value" aria-labelledby="value-h">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2" id="value-h">Why it beats a group text</h2>
    </div>
    <div class="x-grid x-grid-4">
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.clock}</span><h3>Fast</h3><p>Under a minute at the truck. Tap each line, one photo, Ready.</p></article>
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.stop}</span><h3>Says what's missing</h3><p>Anything not tapped reads NOT READY in the yard: Not on the truck: Sinker bars.</p></article>
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.user}</span><h3>A name on it</h3><p>When something's missing, the record shows who cleared the truck and what they said was on it. No digging through group chats.</p></article>
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.link}</span><h3>Proof for the operator</h3><p>The operator gets a link with the same record and the photo of the loaded truck.</p></article>
    </div>
  </div>
</section>

<section class="x-section" id="product" aria-labelledby="product-h">
  <div class="container">
    <div class="x-split">
      <div>
        <p class="x-kicker x-kicker-blue">What's in it</p>
        <h2 class="x-h2" id="product-h">Built around the truck, and nothing else</h2>
        <p class="x-body">No dispatch, no invoicing, no ticketing. RollReady does one job: make sure the right stuff goes out, and show who cleared the truck.</p>
      </div>
      <div class="x-card x-proofcard">
        <span class="x-ic x-ic-blue">${ICON.grid}</span>
        <h3>Every truck on one screen</h3>
        <ul class="x-checks">
          <li>${ICON.check}<span>Ready, not ready, out on a job, or not checked yet</span></li>
          <li>${ICON.check}<span>A truck that isn't ready shows what's missing</span></li>
          <li>${ICON.check}<span>Tap It's back when a truck gets back from a job</span></li>
        </ul>
      </div>
    </div>

    <div class="x-grid x-grid-3 x-features">
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.box}</span><h3>Truck lists and job lists</h3><p>A short list for each truck, set once, plus job lists like Plug set when a job needs more.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.truck}</span><h3>Tools out</h3><p>Setting tools like Silver Fox and Baker 20, counted per yard: ready, out with someone, and used waiting on the vendor's pickup.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.signal}</span><h3>Keeps working without signal</h3><p>In a dead spot at the back of the yard, the taps stay on the phone until there's signal.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.hand}</span><h3>Made for gloves</h3><p>Big buttons and a plain READY or NOT READY you can read in the sun.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.user}</span><h3>Every check has a name on it</h3><p>Each hand logs in as themselves. Every check is stamped with who did it and when.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.shield}</span><h3>Want more?</h3><p>A yard can switch on the full check in Settings: every piece scanned, with its tests and cert paper checked.</p></article>
    </div>
  </div>
</section>

<section class="x-section band-light" id="pricing" aria-labelledby="pricing-h">
  <div class="container">
    <div class="x-price">
      <div class="x-price-left">
        <p class="x-kicker x-kicker-blue">Pricing</p>
        <h2 class="x-h2" id="pricing-h">One price per yard. Your whole crew.</h2>
        <p class="x-body"><b>One bad load-out costs more than a year of RollReady.</b> A year is $6,000. The lubricator miss that started this cost $8,000 in one day.</p>
        <p class="x-body">Running a lot of yards? <a href="${OWNER_PHONE_TEL}">Call or text me.</a></p>
      </div>
      <div class="x-card x-price-card">
        <div class="x-price-big">$500<span>per yard, per month</span></div>
        <ul class="x-checks">
          <li>${ICON.check}<span>Your whole crew, each with their own login. Never per-seat.</span></li>
          <li>${ICON.check}<span>No contract. Cancel anytime.</span></li>
          <li>${ICON.check}<span>Set up your truck lists yourself, free. Or I'll set them up with you: $1,000 a yard, one time, and free for the first 10 yards I set up.</span></li>
          <li>${ICON.check}<span>Your data is yours. Export it as a spreadsheet anytime.</span></li>
        </ul>
        <a href="/signup" class="btn btn-primary x-block">Get started</a>
        <a href="/demo" class="btn btn-ghost x-block x-block-2">Open the live demo first</a>
        <p class="x-fine x-center">Sign up, pick your yards, pay by card, and you're in. About 3 minutes.</p>
      </div>
    </div>
  </div>
</section>

<section class="x-section" id="about" aria-labelledby="about-h">
  <div class="container">
    <div class="x-card x-founder">
      <span class="x-ic x-ic-blue">${ICON.shield}</span>
      <h2 class="x-h2 x-founder-h" id="about-h">Built by someone who's been turned around at the gate</h2>
      <p>I ran wireline in the Permian for five years. I was on the crew that got sent home over an expired lubricator cert, and it cost us $8,000. RollReady is the check I wish we'd had in the yard that morning.</p>
      <p>What yards have told me since is that the everyday miss is the wrong gear on the truck, a hotshot to fix it, and nobody knowing who cleared the truck.</p>
      <p>If you want to see it with your own trucks in it, call or text me at <a href="${OWNER_PHONE_TEL}">${OWNER_PHONE}</a>.</p>
      <p class="x-sign">Caden Cain</p>
      <p class="x-fine">You won't find fake logos or customer counts on this site. RollReady is new, and I'd rather say so.</p>
    </div>
  </div>
</section>

<section class="x-close band-navy" aria-labelledby="close-h">
  <div class="container">
    <h2 class="x-h2" id="close-h">Every truck leaves with the right gear.</h2>
    <p class="x-lede">Check a truck in the demo on your phone. It takes under a minute. Or call, and I'll set up your trucks with you.</p>
    <div class="x-cta x-cta-center">
      <a href="/demo" class="btn btn-primary">Open the live demo</a>
      <a href="/signup" class="btn btn-ghost">Get started</a>
      <a href="${OWNER_PHONE_TEL}" class="btn btn-ghost">Call or text ${OWNER_PHONE}</a>
    </div>
  </div>
</section>

</main>

<footer class="simple-footer">
  <div class="container">
    <div class="row">
      <span class="brand-sm">RollReady by SYNNR</span>
      <a href="${OWNER_PHONE_TEL}">Call or text ${OWNER_PHONE}</a>
      <a href="/demo">Live demo</a>
      <a href="/readiness-audit">Send your truck lists</a>
      <a href="/glossary">Glossary</a>
      <a href="/login">Log in</a>
      <a href="/legal/terms">Terms</a>
      <a href="/legal/privacy">Privacy</a>
      <span class="copy">&copy; 2026 SYNNR</span>
    </div>
  </div>
</footer>
`;
