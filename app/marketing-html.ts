import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

// RollReady homepage (the product; SYNNR is the company). One job: stop
// costly load-out mistakes, so the right iron, in date, leaves every time.
// Order: hero, what still costs shops money, how a load-out works, what it
// saves, what's in it, pricing, who built it. Navy top with the real app in a
// laptop and phone, light sections below. Real screenshots only
// (public/screens, shot from /shot). No customer names or counts anywhere.

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
      <a href="/demo" class="btn btn-primary btn-sm">Open the live demo</a>
      <label class="nav-burger" for="navMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></label>
    </div>
    <input type="checkbox" id="navMenu" class="nav-toggle" aria-hidden="true"/>
    <nav class="nav-mobile" aria-label="Menu">
      <a href="#how">How it works</a>
      <a href="#product">What's in it</a>
      <a href="#pricing">Pricing</a>
      <a href="/demo">Live demo</a>
      <a href="${OWNER_PHONE_TEL}">Call or text ${OWNER_PHONE}</a>
      <a href="/login">Log in</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="x-hero band-navy" aria-labelledby="hero-h">
  <div class="container x-hero-grid">
    <div class="x-hero-copy">
      <p class="x-kicker">Oilfield load-out software for service yards</p>
      <h1 id="hero-h">Stop costly load-out mistakes.</h1>
      <p class="x-lede">Make sure the right iron, in date, leaves your yard every time. Your hands scan each piece as it goes on the truck. Anything missing, out of test, or red-tagged stops the truck in the yard, and you keep a locked record of who loaded what.</p>
      <p class="x-punch">One bad load-out costs more than a year of RollReady.</p>
      <div class="x-cta">
        <a href="/demo" class="btn btn-primary">Open the live demo</a>
        <a href="/l/showcase" class="btn btn-ghost">See a load-out</a>
      </div>
      <p class="x-note">The demo is the real app with a made-up yard. No signup, no card. "See a load-out" opens the record a shop would send the operator.</p>
    </div>
    <div class="x-devices">
      <div class="x-laptop">
        <div class="x-laptop-screen">
          <img src="/screens/app-desktop.webp" width="2000" height="1250"
            alt="RollReady Load out screen: trucks counted as Blocked, Ready to load, and Loaded out today. CT-03 is blocked at load-out because its BOP stack is out of test." fetchpriority="high"/>
        </div>
        <div class="x-laptop-base"></div>
      </div>
      <div class="x-phone">
        <img src="/screens/app-phone.webp" width="750" height="1624"
          alt="A load-out scan on a phone: the BOP stack on CT-03 just got scanned, RollReady says it's out of test and not to load it, and the truck's kit list shows which lines are filled."/>
      </div>
    </div>
  </div>
</section>

<section class="x-section band-light" id="problem" aria-labelledby="problem-h">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2" id="problem-h">What still costs shops money</h2>
      <p class="x-sub">The first one happened to my crew. The rest are misses every shop out here has seen. None of them are hard to catch. They get caught at the gate because nobody checked in the yard.</p>
    </div>
    <div class="x-grid x-grid-2">
      <article class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Expired lubricator cert on a major's location</h3><p>The company man checked the paper and turned the crew around at the gate. $8,000 in NPT.</p></div></article>
      <article class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>BOP test lapsed, found on location</h3><p>A $10,000+ NPT day, and an operator who remembers it the next time work gets handed out.</p></div></article>
      <article class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Right truck, missing a piece</h3><p>The plug valve the job needed is still on the rack. The crew waits on location for a hotshot.</p></div></article>
      <article class="x-card x-miss"><span class="x-ic x-ic-red">${ICON.alert}</span><div><h3>Red-tagged iron that went anyway</h3><p>Somebody tagged it out. It still got loaded, because nothing on the way to the truck stopped it.</p></div></article>
    </div>
  </div>
</section>

<section class="x-section" id="how" aria-labelledby="how-h">
  <div class="container">
    <div class="x-head">
      <p class="x-kicker x-kicker-blue">How a load-out works</p>
      <h2 class="x-h2" id="how-h">Three steps. Every truck, every time.</h2>
    </div>
    <ol class="x-grid x-grid-3 x-steps">
      <li class="x-card x-step"><span class="x-num">1</span><h3>Set what goes on the truck</h3><p>Build your packages once, like a Standard Coil Package. Every truck keeps its own default kit. Need something different today? Add a quick list for that job.</p></li>
      <li class="x-card x-step"><span class="x-num">2</span><h3>Scan it on</h3><p>The hand taps each piece's tag or scans its QR code as it's loaded. Out of test, red-tagged, or not on the list gets called out right then: <b>Don't load it.</b> If anything is still missing at the end, the truck reads NOT READY. A hand can't wave it through.</p></li>
      <li class="x-card x-step"><span class="x-num">3</span><h3>Locked record and proof</h3><p>Every load-out saves what left, who scanned each piece, and when. Nobody can edit it. A proof link is made with it, so the operator gets the record instead of a binder.</p></li>
    </ol>
    <div class="x-browser">
      <div class="x-browser-bar"><i></i><i></i><i></i><span>synnr.io/app</span></div>
      <img src="/screens/app-desktop.webp" width="2000" height="1250" loading="lazy"
        alt="RollReady Load out screen: blocked trucks first with the reason in red, then trucks ready to load, each with a button to start its load-out scan"/>
    </div>
    <p class="x-fine x-center">Screenshots of the real app, not mockups. CT-03's BOP stack is six days past its pressure test, so the load-out stops it in the yard.</p>
    <div class="x-cta x-cta-center">
      <a href="/demo" class="btn btn-primary">Run a load-out in the demo</a>
    </div>
  </div>
</section>

<section class="x-section band-light" id="value" aria-labelledby="value-h">
  <div class="container">
    <div class="x-head">
      <h2 class="x-h2" id="value-h">What one caught mistake is worth</h2>
    </div>
    <div class="x-grid x-grid-4">
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.dollar}</span><h3>Money</h3><p>One turnaround at the gate runs $8,000 to $10,000 or more. A full year of RollReady is $6,000.</p></article>
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.clock}</span><h3>Time</h3><p>No digging through binders or the testing company's portal at 4 AM. Hands scan as they load, and the yard manager sees every truck on one screen.</p></article>
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.shield}</span><h3>Reputation</h3><p>Operators remember the crew that got sent home. Show up with the paper right and the proof link already sent.</p></article>
      <article class="x-card x-val"><span class="x-ic x-ic-blue">${ICON.stop}</span><h3>Mistakes</h3><p>Missing, expired, or red-tagged iron stops the truck in the yard. The check doesn't depend on who's loading that morning.</p></article>
    </div>
  </div>
</section>

<section class="x-section" id="product" aria-labelledby="product-h">
  <div class="container">
    <div class="x-split">
      <div>
        <p class="x-kicker x-kicker-blue">What's in it</p>
        <h2 class="x-h2" id="product-h">Built around the load-out, and nothing else</h2>
        <p class="x-body">No dispatch, no invoicing, no ticketing. RollReady does one job: make sure what goes on the truck is right, and prove it.</p>
        <p class="x-body">Your testing company's tag tells you about one piece. RollReady tells you whether the truck can leave.</p>
      </div>
      <div class="x-card x-proofcard">
        <span class="x-ic x-ic-blue">${ICON.camera}</span>
        <h3>A piece only turns green from a photo of the cert</h3>
        <p>Nobody clears a test by typing a new date. Someone takes a photo of the new cert, and RollReady reads it first:</p>
        <ul class="x-checks">
          <li>${ICON.check}<span>The serial on the cert has to match the iron</span></li>
          <li>${ICON.check}<span>The test date has to be printed on the paper</span></li>
          <li>${ICON.check}<span>It has to be the right kind of test</span></li>
          <li>${ICON.check}<span>One photo can only clear one piece</span></li>
        </ul>
        <p class="x-fine">If anything doesn't match, the piece stays red until a manager looks at the photo.</p>
      </div>
    </div>

    <div class="x-grid x-grid-3 x-features">
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.box}</span><h3>Packages and truck kits</h3><p>Reusable packages for each kind of job, a default kit for every truck, and quick one-off lists. The load-out checks against what the job calls for.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.qr}</span><h3>Works with the tags on your iron</h3><p>Scan the NFC tags your testing company already put on, from an Android phone. Write new tags yourself, or print QR tags that work on any phone.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.truck}</span><h3>A hard stop, not a warning</h3><p>Missing, expired, or red-tagged means NOT READY. Only a manager can roll it anyway, with their name and reason on the record and an email to the office.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.user}</span><h3>Every scan has a name on it</h3><p>Each hand logs in as themselves. Every scan, load-out, move, and cert update is stamped with who did it and when.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.grid}</span><h3>Every yard on one screen</h3><p>Filter by yard. See which trucks are ready, blocked, or already loaded out, and who did what today.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.search}</span><h3>Find any piece</h3><p>Search by serial, type, truck, or yard, and see its status and when its next test is due.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.signal}</span><h3>Keeps working without signal</h3><p>In a dead spot at the back of the yard, scans save on the phone and send by themselves when you're back in range.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.hand}</span><h3>Made for gloves</h3><p>Big buttons and a plain red or green answer you can read in the sun.</p></article>
      <article class="x-card"><span class="x-ic x-ic-blue">${ICON.link}</span><h3>Proof for the operator</h3><p>Every load-out gets its own link: what's on the truck, each piece's serial and test date, and who loaded it.</p></article>
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
          <li>${ICON.check}<span>Setup is free for the first 10 yards. I'll load your iron with you.</span></li>
          <li>${ICON.check}<span>Your data is yours. Export it as a spreadsheet anytime.</span></li>
        </ul>
        <a href="/demo" class="btn btn-primary x-block">Open the live demo</a>
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
      <p>If you want to see it with your own trucks in it, call or text me at <a href="${OWNER_PHONE_TEL}">${OWNER_PHONE}</a>.</p>
      <p class="x-sign">Caden Cain</p>
      <p class="x-fine">You won't find fake logos or customer counts on this site. RollReady is new, and I'd rather say so.</p>
    </div>
  </div>
</section>

<section class="x-close band-navy" aria-labelledby="close-h">
  <div class="container">
    <h2 class="x-h2" id="close-h">Catch it in the yard, not at the gate</h2>
    <p class="x-lede">Open the demo on your phone and run a load-out, or call and I'll set up your yard.</p>
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
      <a href="/readiness-audit">Send your iron list</a>
      <a href="/glossary">Glossary</a>
      <a href="/login">Log in</a>
      <a href="/legal/terms">Terms</a>
      <a href="/legal/privacy">Privacy</a>
      <span class="copy">&copy; 2026 SYNNR</span>
    </div>
  </div>
</footer>
`;
