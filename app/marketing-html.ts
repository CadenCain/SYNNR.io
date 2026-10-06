import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

// RollReady homepage (the product; SYNNR is the company). Equipment test tracking that prevents NPT.
// Every piece of iron, its serial, where it is, and its next test; QR tags,
// move history, truck checks, and proof links ride along at the same price.
// Navy top with the real app in a laptop and phone, light sections below.
// Real screenshots only (public/screens, shot from /shot). The phone number
// shows in the nav, the hero button, the founder note, the closing band, and
// the footer.

const ICON = {
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  qr: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>`,
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
    <nav class="nav-links">
      <a href="#product">Product</a>
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="/demo">Live demo</a>
    </nav>
    <div class="nav-cta">
      <a href="${OWNER_PHONE_TEL}" class="nav-login">${OWNER_PHONE}</a>
      <a href="/login" class="nav-login">Log in</a>
      <a href="/demo" class="btn btn-primary btn-sm">Open the live demo</a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile">
      <a href="#product">Product</a>
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="/demo">Live demo</a>
      <a href="${OWNER_PHONE_TEL}">Call or text ${OWNER_PHONE}</a>
      <a href="/login">Log in</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="x-hero band-navy">
  <div class="container x-hero-grid">
    <div class="x-hero-copy">
      <p class="x-kicker">Equipment test tracking for oilfield service yards</p>
      <h1>An expired lubricator cert cost us $8,000 on a major's location.</h1>
      <p class="x-lede">Nobody knew until the company man checked the paper and turned the crew around at the gate. RollReady keeps every piece of iron in your yard on one list, with its serial, where it is, and when its next test is due, so that never happens again.</p>
      <div class="x-cta">
        <a href="/demo" class="btn btn-primary">Open the live demo</a>
        <a href="${OWNER_PHONE_TEL}" class="btn btn-ghost">Call or text ${OWNER_PHONE}</a>
      </div>
      <p class="x-note">The demo is the real app loaded with a made-up yard. No signup, no card.</p>
    </div>
    <div class="x-devices">
      <div class="x-laptop">
        <div class="x-laptop-screen">
          <img src="/screens/app-desktop.webp" width="2000" height="1250"
            alt="RollReady equipment list: 62 pieces of iron with serials, where each one is, its next test, and a status. Two overdue, two red-tagged or missing." fetchpriority="high"/>
        </div>
        <div class="x-laptop-base"></div>
      </div>
      <div class="x-phone">
        <img src="/screens/app-phone.webp" width="750" height="1624"
          alt="The same equipment list on a phone, red-tagged plug valve on top"/>
      </div>
    </div>
  </div>
</section>

<section class="x-section band-light" id="problem">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2">How it goes wrong</h2>
      <p class="x-sub">The first one happened to us. The rest are the misses every shop out here has seen.</p>
    </div>
    <div class="x-grid x-grid-2">
      <div class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Expired lubricator cert on a major's location</h3><p>$8,000 in NPT and the crew turned around at the gate.</p></div></div>
      <div class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>BOP pressure test lapsed, found on location</h3><p>A $10,000+ NPT day.</p></div></div>
      <div class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Expired DOT sticker</h3><p>Truck sidelined, job rescheduled, and a hotshot bill on top.</p></div></div>
      <div class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Plug valve past its recert, out in the basket</h3><p>The operator's inspector pulls it on location and you wait on a hotshot.</p></div></div>
    </div>
  </div>
</section>

<section class="x-section" id="product">
  <div class="container">
    <div class="x-split">
      <div>
        <p class="x-kicker x-kicker-blue">The product</p>
        <h2 class="x-h2">Every piece of iron, on one list</h2>
        <p class="x-body">BOP stacks, lubricators, plug valves, swivels, pup joints, reels, and the trucks they ride on. Each piece has its serial, where it is right now, and every test and cert with its date. Before anything comes due, an email goes to the people you pick for that yard.</p>
        <p class="x-body">If a piece lapses or gets red-tagged, the truck it's on reads <b>NOT READY</b> until it's fixed. There is no override button.</p>
      </div>
      <div class="x-card x-proofcard">
        <span class="x-ic x-ic-blue">${ICON.camera}</span>
        <h3>Nobody fixes a record by typing a new date</h3>
        <p>Someone takes a photo of the new cert, and RollReady reads it before anything turns green:</p>
        <ul class="x-checks">
          <li>${ICON.check}<span>The expiration date has to be printed on the paper</span></li>
          <li>${ICON.check}<span>The serial on the cert has to match the iron</span></li>
          <li>${ICON.check}<span>It has to be the right kind of test</span></li>
          <li>${ICON.check}<span>One photo can only clear one piece</span></li>
        </ul>
        <p class="x-fine">If it all matches, the piece goes green. If it doesn't, it stays red until a manager looks at the photo.</p>
      </div>
    </div>

    <h3 class="x-h3">Also included at the same price</h3>
    <div class="x-grid x-grid-2">
      <div class="x-card"><span class="x-ic x-ic-blue">${ICON.qr}</span><h3>QR tags</h3><p>Print a tag for every piece. Anyone who scans it with a phone camera sees the serial, the test dates, and the cert. No app, no login.</p></div>
      <div class="x-card"><span class="x-ic x-ic-blue">${ICON.pin}</span><h3>Where it is, and where it's been</h3><p>Move iron between trucks and the yard in two taps. Every move is saved with who did it and when, and nobody can edit that history.</p></div>
      <div class="x-card"><span class="x-ic x-ic-blue">${ICON.truck}</span><h3>Truck check</h3><p>Run a truck against the job date before it leaves. If anything on it is out of test or red-tagged, it says what.</p></div>
      <div class="x-card"><span class="x-ic x-ic-blue">${ICON.link}</span><h3>Proof links and a due list</h3><p>Send the operator a live page instead of a binder. Download what's coming due as a spreadsheet for your test company.</p></div>
    </div>
  </div>
</section>

<section class="x-section band-light" id="screens">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2">This is the actual app</h2>
      <p class="x-sub">Screenshots of the real thing, not mockups. The BOP stack on CT-03 is six days past its pressure test, so CT-03 can't roll. It stays that way until somebody uploads the new cert.</p>
    </div>
    <div class="x-browser">
      <div class="x-browser-bar"><i></i><i></i><i></i><span>synnr.io/app</span></div>
      <img src="/screens/app-desktop.webp" width="2000" height="1250" loading="lazy"
        alt="RollReady equipment list: each piece with its serial, where it is, its next test, and a status"/>
    </div>
    <div class="x-cta x-cta-center">
      <a href="/demo" class="btn btn-primary">Open the live demo</a>
    </div>
  </div>
</section>

<section class="x-section" id="how">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2">Getting set up</h2>
    </div>
    <div class="x-grid x-grid-3">
      <div class="x-card x-step"><span class="x-num">1</span><p>Hand me your spreadsheet or binder. We load your iron, the serials, and every test date in one afternoon.</p></div>
      <div class="x-card x-step"><span class="x-num">2</span><p>Print the QR tags and stick one on each piece.</p></div>
      <div class="x-card x-step"><span class="x-num">3</span><p>Pick who gets the alerts. Before anything comes due, they hear about it.</p></div>
    </div>
  </div>
</section>

<section class="x-section band-light" id="pricing">
  <div class="container">
    <div class="x-price">
      <div class="x-price-left">
        <p class="x-kicker x-kicker-blue">Pricing</p>
        <h2 class="x-h2">One price. Your whole crew.</h2>
        <p class="x-body">One lubricator miss is 16 months of RollReady.</p>
        <p class="x-body">Early yards lock in $500 for as long as they stay on.</p>
        <p class="x-body">Running a lot of yards? Fleets are a conversation. <a href="${OWNER_PHONE_TEL}">Call or text me.</a></p>
      </div>
      <div class="x-card x-price-card">
        <div class="x-price-big">$500<span>per yard, per month</span></div>
        <ul class="x-checks">
          <li>${ICON.check}<span>Your whole crew gets access. It's never per-seat.</span></li>
          <li>${ICON.check}<span>No contract. Cancel anytime.</span></li>
          <li>${ICON.check}<span>Setup is free for the first 10 yards. I'll do it with you in one afternoon.</span></li>
          <li>${ICON.check}<span>Your data is yours. Export it as a spreadsheet anytime.</span></li>
        </ul>
        <a href="/demo" class="btn btn-primary x-block">Open the live demo</a>
      </div>
    </div>
  </div>
</section>

<section class="x-section" id="about">
  <div class="container">
    <div class="x-card x-founder">
      <span class="x-ic x-ic-blue">${ICON.shield}</span>
      <p>I ran wireline in the Permian for five years. I've been the hand on location when the paper was wrong, and I built RollReady because nobody else had. If you want to see it with your own trucks in it, call or text me at <a href="${OWNER_PHONE_TEL}">${OWNER_PHONE}</a>.</p>
      <p class="x-sign">Caden Cain</p>
      <p class="x-fine">You won't find fake logos or customer counts on this site. RollReady is new, and I'd rather say so.</p>
    </div>
  </div>
</section>

<section class="x-close band-navy">
  <div class="container">
    <h2 class="x-h2">See your iron in RollReady</h2>
    <p class="x-lede">Open the demo on your phone right now, or call and I'll load your yard.</p>
    <div class="x-cta x-cta-center">
      <a href="/demo" class="btn btn-primary">Open the live demo</a>
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
      <a href="/readiness-audit">Free readiness map</a>
      <a href="/partners">Partners</a>
      <a href="/build">Custom builds</a>
      <a href="/login">Log in</a>
      <a href="/legal/terms">Terms</a>
      <a href="/legal/privacy">Privacy</a>
      <span class="copy">&copy; 2026 SYNNR</span>
    </div>
  </div>
</footer>
`;
