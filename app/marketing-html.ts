import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

// SYNNR homepage. One product (cert tracking that prevents NPT); readiness
// checks, gear last-seen, and proof links ride along at the same price.
// Plain on purpose: short sentences, real screenshots, no decorative motion.
// The phone number shows in the nav, the hero button, the founder note, and
// the footer, and nowhere else.
export const MARKETING_HTML = `
<header class="nav" id="nav">
  <div class="nav-pill">
    <a class="brand" href="/" aria-label="SYNNR">
      <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#ece5d7"/>
      </svg>
      <span class="wordmark">SYNNR</span>
    </a>
    <nav class="nav-links">
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
      <a href="#how">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="/demo">Live demo</a>
      <a href="${OWNER_PHONE_TEL}">Call or text ${OWNER_PHONE}</a>
      <a href="/login">Log in</a>
    </nav>
  </div>
</header>

<main id="top">

<section class="band hero-plain">
  <div class="container">
    <h1>An expired lubricator cert cost us $8,000 on a major's location.</h1>
    <p class="lede">Nobody knew until the company man checked the paper and turned the crew around at the gate. SYNNR watches every cert, DOT date, and crew card in your yard so that never happens again.</p>
    <div class="cta-row">
      <a href="/demo" class="btn btn-primary">Open the live demo</a>
      <a href="${OWNER_PHONE_TEL}" class="btn btn-ghost">Call or text ${OWNER_PHONE}</a>
    </div>
    <p class="small-note">The demo is the real app loaded with made-up trucks. No signup, no card.</p>
  </div>
</section>

<section class="band band-light section" id="problem">
  <div class="container">
    <h2 class="h2">How it goes wrong</h2>
    <ul class="misses">
      <li><b>Expired lubricator cert on a major's location.</b> $8,000 in NPT and the crew turned around at the gate.</li>
      <li><b>BOP pressure test lapsed, found on location.</b> A $10,000+ NPT day.</li>
      <li><b>Expired DOT sticker.</b> Truck sidelined, job rescheduled, and a hotshot bill on top.</li>
      <li><b>One hand's H2S card expired.</b> The whole crew got sent home.</li>
    </ul>
    <p class="small-note">The first one happened to us. The rest are the misses every shop out here has seen.</p>
  </div>
</section>

<section class="band section" id="product">
  <div class="container">
    <h2 class="h2">Every expiration date in your yard, on one list</h2>
    <p class="lede">BOP and pressure tests, annual DOT, registrations, H2S, well control, CDLs, and medical cards all go on one register. Before anything lapses, an email goes to the people you pick for that yard, like the foreman who rolls the trucks. If something does lapse, that truck reads <b>NOT READY</b> until the record is fixed. There is no override button.</p>

    <h3 class="also-head">Also included at the same price</h3>
    <div class="also">
      <div><h3>Readiness check</h3><p>Run a truck against the job date before it leaves. If anything on it or its crew is out of date, it says what.</p></div>
      <div><h3>Gear last-seen</h3><p>Where each piece was last seen, who said so, and how long ago.</p></div>
      <div><h3>Proof links</h3><p>A live, read-only page you send the operator instead of a binder.</p></div>
    </div>
  </div>
</section>

<section class="band section showcase" id="screens" style="padding-top:0">
  <div class="container">
    <h2 class="h2">This is the actual app</h2>
    <p class="lede">Screenshots of the real thing, not mockups. CT-03 is red because its BOP pressure test expired six days ago. It stays red until somebody renews it.</p>
    <div class="show-stage">
      <div class="show-frame">
        <img class="show-shot" src="/screens/command-center.png" width="1360" height="860"
          alt="SYNNR dashboard: readiness numbers, a 14-day chart, and the fleet board with CT-03 marked NOT READY" loading="lazy"/>
      </div>
      <img class="show-phone" src="/screens/mobile-verdict.png" width="250" height="512"
        alt="The same yard on a phone: CT-03 not ready, with a button to fix it" loading="lazy"/>
    </div>
    <div class="cta-row">
      <a href="/demo" class="btn btn-primary">Open the live demo</a>
    </div>
  </div>
</section>

<section class="band band-light section" id="how">
  <div class="container">
    <h2 class="h2">Getting set up</h2>
    <ol class="steps">
      <li>Hand me your binder or spreadsheet. We load your trucks, gear, crew, and every date in one afternoon.</li>
      <li>Pick who gets the alerts for each yard.</li>
      <li>Before a truck rolls, run the readiness check from a phone. If something is off, it tells you what.</li>
    </ol>
  </div>
</section>

<section class="band section" id="pricing">
  <div class="container">
    <h2 class="h2">Pricing</h2>
    <div class="price-big">$500<span>per yard, per month</span></div>
    <p class="price-why">One lubricator miss is 16 months of SYNNR.</p>
    <p class="price-why" style="margin-top:8px">Early yards lock in $500 for as long as they stay on.</p>
    <ul class="price-points">
      <li>Your whole crew gets access. It's never per-seat.</li>
      <li>No contract. Cancel anytime.</li>
      <li>Setup is free for the first 10 yards. I'll do it with you in one afternoon.</li>
      <li>Your data is yours. Export it as a spreadsheet anytime.</li>
    </ul>
    <p class="price-why">Running a lot of yards? Fleets are a conversation. <a href="${OWNER_PHONE_TEL}" style="color:var(--fg);text-decoration:underline;text-underline-offset:3px">Call or text me.</a></p>
    <div class="cta-row">
      <a href="/demo" class="btn btn-primary">Open the live demo</a>
    </div>
  </div>
</section>

<section class="band band-light section founder" id="about">
  <div class="container">
    <p>I ran wireline in the Permian for five years. I've been the hand on location when the paper was wrong, and I built SYNNR because nobody else had. If you want to see it with your own trucks in it, call or text me at <a href="${OWNER_PHONE_TEL}">${OWNER_PHONE}</a>.</p>
    <p class="sign">Caden Cain</p>
    <p class="small-note">You won't find fake logos or customer counts on this site. SYNNR is new, and I'd rather say so.</p>
  </div>
</section>

</main>

<footer class="simple-footer">
  <div class="container">
    <div class="row">
      <span class="brand-sm">SYNNR</span>
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
