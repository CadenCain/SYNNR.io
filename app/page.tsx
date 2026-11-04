import type { Metadata } from "next";
import Link from "next/link";
import "./home.css";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";
import HomeGate from "./home-gate";
import HomeMotion from "./home-motion";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// RollReady homepage (2026-11). The product is the gate in the yard: nothing
// rolls without proof. Dark, plain, and built around the real check. The hero
// is the check itself; screenshots are of the real app (public/screens, shot
// from /shot). No customer names or counts anywhere.

const Mark = ({ className = "rr-mark" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="currentColor" />
  </svg>
);

const TRIP = [
  { n: "1", h: "Plan the job", p: "A manager sets what the job needs: the truck’s kit, a package, a few extras. The hand can add to it, never take anything off." },
  { n: "2", h: "Load out", p: "Each piece gets checked on as it’s loaded. Out of test, no paper, red-tagged, or not on the list gets called out right then." },
  { n: "3", h: "Prove it", p: "The record locks when it’s saved. The operator gets a link with every piece, its cert, who loaded it, and a photo of the truck." },
  { n: "4", h: "Check it back in", p: "Iron comes back off the truck. Anything out too long gets flagged, and damaged iron gets red-tagged on the spot." },
];

const STOPS = [
  "Out of test",
  "A test date with no cert behind it",
  "Red-tagged",
  "Short a piece on the job’s list",
  "Logged on the truck, nobody can find it",
  "Pressure iron with no test on file",
  "No photo of the loaded truck",
];

const VERSUS = [
  { a: "The hand taps done, and it’s done.", b: "Every piece is checked against its test, its cert, and the job’s list. The phone can’t talk it into READY." },
  { a: "Expired iron gets found at the gate.", b: "Expired iron gets stopped in the yard." },
  { a: "The operator gets a binder, or nothing.", b: "The operator gets a link: every piece, every cert, and a photo of the truck." },
  { a: "Nobody knows when the app wasn’t used.", b: "The morning email names every truck that left without a scan." },
];

const MISSES = [
  { h: "Expired lubricator cert on a major’s location", p: "The company man checked the paper and turned the crew around at the gate. $8,000 in NPT." },
  { h: "BOP test lapsed, found on location", p: "A $10,000+ NPT day, and an operator who remembers it the next time work gets handed out." },
  { h: "Right truck, missing a piece", p: "The plug valve the job needed is still on the rack. The crew waits on location for a hotshot." },
  { h: "Red-tagged iron that went anyway", p: "Somebody tagged it out. It still got loaded, because nothing on the way to the truck stopped it." },
];

export default function Home() {
  return (
    <div className="rr">
      <HomeMotion />
      <header className="rr-nav" id="rr-nav">
        <div className="rr-wrap rr-nav-in">
          <Link className="rr-brand" href="/" aria-label="RollReady by SYNNR">
            <Mark /><span className="rr-word">RollReady</span><span className="rr-by">by SYNNR</span>
          </Link>
          <nav className="rr-links" aria-label="Main">
            <a href="#trip">How it works</a>
            <a href="#stops">What stops a truck</a>
            <a href="#pricing">Pricing</a>
            <Link href="/demo">Live demo</Link>
          </nav>
          <div className="rr-nav-cta">
            <Link href="/login" className="rr-login">Log in</Link>
            <Link href="/signup" className="rr-btn rr-btn-sm">Get started</Link>
            <label htmlFor="rr-menu" className="rr-burger" aria-label="Open menu">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </label>
          </div>
        </div>
        <input type="checkbox" id="rr-menu" className="rr-menu-toggle" aria-hidden="true" />
        <nav className="rr-mobile" aria-label="Menu">
          <a href="#trip">How it works</a>
          <a href="#stops">What stops a truck</a>
          <a href="#pricing">Pricing</a>
          <Link href="/demo">Live demo</Link>
          <Link href="/login">Log in</Link>
          <a href={OWNER_PHONE_TEL}>Call or text {OWNER_PHONE}</a>
        </nav>
      </header>

      <main>
        <section className="rr-hero" aria-labelledby="rr-hero-h">
          <div className="rr-wrap rr-hero-grid">
            <div className="rr-hero-copy">
              <p className="rr-kicker">Load-out software for oilfield service yards</p>
              <h1 id="rr-hero-h">Nothing rolls without proof.</h1>
              <p className="rr-lede">
                RollReady checks every truck before it leaves the yard. Each piece has to be on the job’s list, in test,
                and backed by its cert. If anything’s off, the truck reads NOT READY and stays put.
              </p>
              <div className="rr-cta">
                <Link href="/demo" className="rr-btn">Open the live demo</Link>
                <Link href="/l/showcase" className="rr-btn rr-btn-ghost">See a real load-out record</Link>
              </div>
              <p className="rr-note">The demo is the real app with a made-up yard. No signup, no card.</p>
            </div>
            <HomeGate />
          </div>
        </section>

        <section className="rr-band rr-phones" aria-labelledby="rr-phones-h">
          <div className="rr-wrap">
            <h2 className="rr-h3" id="rr-phones-h">Works on the phones your crew already has</h2>
            <div className="rr-grid3">
              <article className="rr-card rv">
                <h3>iPhone</h3>
                <p>Tap <b>It’s on the truck</b> as each piece goes on, then take one photo of the loaded truck. No serials to punch in.</p>
              </article>
              <article className="rr-card rv">
                <h3>Android</h3>
                <p>Tap the testing company’s NFC tag on each piece. The tag proves the piece was there.</p>
              </article>
              <article className="rr-card rv">
                <h3>No signal</h3>
                <p>Scans and the photo stay on the phone and send by themselves when you’re back in range.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="rr-sec" aria-labelledby="rr-vs-h">
          <div className="rr-wrap">
            <div className="rr-head rv">
              <h2 className="rr-h2" id="rr-vs-h">Most apps write down what the hand says. RollReady checks it.</h2>
            </div>
            <div className="rr-vs rv" role="table" aria-label="A checklist compared with RollReady">
              <div className="rr-vs-row rr-vs-headrow" role="row">
                <span role="columnheader">A checklist</span>
                <span role="columnheader">RollReady</span>
              </div>
              {VERSUS.map((v) => (
                <div className="rr-vs-row" role="row" key={v.a}>
                  <span role="cell" className="rr-vs-a">{v.a}</span>
                  <span role="cell" className="rr-vs-b">{v.b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rr-sec rr-band" id="trip" aria-labelledby="rr-trip-h">
          <div className="rr-wrap">
            <div className="rr-head rv">
              <p className="rr-kicker">How it works</p>
              <h2 className="rr-h2" id="rr-trip-h">One trip, start to finish</h2>
              <p className="rr-sub">Wireline, coil, rathole, pressure control: the truck goes out loaded and comes back. RollReady is the check at both ends.</p>
            </div>
            <ol className="rr-trip">
              {TRIP.map((t) => (
                <li key={t.n} className="rv">
                  <span className="rr-num">{t.n}</span>
                  <h3>{t.h}</h3>
                  <p>{t.p}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="rr-sec" id="stops" aria-labelledby="rr-stops-h">
          <div className="rr-wrap rr-split">
            <div className="rv">
              <p className="rr-kicker rr-kicker-red">The hard stop</p>
              <h2 className="rr-h2" id="rr-stops-h">What stops a truck</h2>
              <p className="rr-sub">Any one of these makes the truck NOT READY. A hand can’t wave it through.</p>
              <p className="rr-fine">Only a manager can roll it anyway. Their name and reason go on the record and the proof link, and the office gets an email.</p>
            </div>
            <ul className="rr-stops rv">
              {STOPS.map((s) => (
                <li key={s}><span className="rr-x" aria-hidden="true">✕</span>{s}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rr-sec rr-band" aria-labelledby="rr-used-h">
          <div className="rr-wrap rr-split">
            <div className="rv">
              <p className="rr-kicker">For the yard manager</p>
              <h2 className="rr-h2" id="rr-used-h">It tells you when it wasn’t used</h2>
              <p className="rr-sub">
                Software only helps if people use it. RollReady watches for the trucks that left without it, the plans nobody
                loaded, and the hands who haven’t opened it, and puts them in one email every morning. A quiet yard gets no email.
              </p>
            </div>
            <div className="rr-mail rv" aria-label="Example morning email">
              <div className="rr-mail-top">
                <span className="rr-mail-from">RollReady</span>
                <span className="rr-mail-time">6:30 AM</span>
              </div>
              <div className="rr-mail-subj">2 trucks not scanned out at your yard</div>
              <div className="rr-mail-body">
                <p className="rr-mail-sec">Not scanned out (the app wasn’t used):</p>
                <p>CT-01: Was planned to leave 7:00 AM. Nobody has scanned it out.</p>
                <p>CT-06 came back from a job it was never scanned out for.</p>
                <p className="rr-mail-sec">Blocked at load-out:</p>
                <p>CT-03: Out of test: Quad BOP stack #3 QB-4471</p>
                <p className="rr-mail-sec">Out too long, not checked back in:</p>
                <p>CT-08: 5 pieces, out 9 days</p>
              </div>
              <div className="rr-mail-foot">Example from the demo yard</div>
            </div>
          </div>
        </section>

        <section className="rr-sec" aria-labelledby="rr-real-h">
          <div className="rr-wrap">
            <div className="rr-head rv">
              <h2 className="rr-h2" id="rr-real-h">The real app</h2>
              <p className="rr-sub">Screenshots with the demo yard, not mockups. CT-03’s BOP stack is six days past its pressure test, so the load-out stops it in the yard.</p>
            </div>
            <div className="rr-shots rv">
              <div className="rr-browser">
                <div className="rr-browser-bar"><i /><i /><i /><span>synnr.io/app</span></div>
                {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot, sized */}
                <img src="/screens/app-desktop-dark.webp" width={2000} height={1250} loading="lazy"
                  alt="RollReady Load out screen: blocked trucks first with the reason in red, then trucks ready to load, each with a button to start its load-out" />
              </div>
              <div className="rr-phone">
                {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot, sized */}
                <img src="/screens/app-phone-dark.webp" width={750} height={1624} loading="lazy"
                  alt="A load-out on an iPhone: the BOP stack on CT-03 was just checked on, RollReady says it's out of test and not to load it, and the truck's list shows which lines are filled" />
              </div>
            </div>
            <div className="rr-cta rr-center">
              <Link href="/demo" className="rr-btn">Run a load-out in the demo</Link>
            </div>
          </div>
        </section>

        <section className="rr-sec rr-band" aria-labelledby="rr-miss-h">
          <div className="rr-wrap">
            <div className="rr-head rv">
              <h2 className="rr-h2" id="rr-miss-h">What a miss costs</h2>
              <p className="rr-sub">The first one happened to my crew. The rest are misses every shop out here has seen. They get caught at the gate because nobody checked in the yard.</p>
            </div>
            <div className="rr-grid2">
              {MISSES.map((m) => (
                <article className="rr-card rr-miss rv" key={m.h}>
                  <h3>{m.h}</h3>
                  <p>{m.p}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rr-sec" id="pricing" aria-labelledby="rr-price-h">
          <div className="rr-wrap rr-split">
            <div className="rv">
              <p className="rr-kicker">Pricing</p>
              <h2 className="rr-h2" id="rr-price-h">One price per yard. Your whole crew.</h2>
              <p className="rr-sub"><b>One bad load-out costs more than a year of RollReady.</b> A year is $6,000. The lubricator miss that started this cost $8,000 in one day.</p>
              <p className="rr-sub">Running a lot of yards? <a href={OWNER_PHONE_TEL}>Call or text me.</a></p>
            </div>
            <div className="rr-card rr-price rv">
              <div className="rr-price-big">$500<span>per yard, per month</span></div>
              <ul className="rr-checks">
                <li>Your whole crew, each with their own login. Never per seat.</li>
                <li>No contract. Cancel anytime.</li>
                <li>Load it yourself, free. Or I’ll load it for you: free for the first 10 yards, then $1,000 a yard, one time.</li>
                <li>Your data is yours. Export it as a spreadsheet anytime.</li>
              </ul>
              <Link href="/signup" className="rr-btn rr-block">Get started</Link>
              <Link href="/demo" className="rr-btn rr-btn-ghost rr-block">Open the live demo first</Link>
            </div>
          </div>
        </section>

        <section className="rr-sec rr-band" aria-labelledby="rr-about-h">
          <div className="rr-wrap">
            <div className="rr-founder rv">
              <h2 className="rr-h3" id="rr-about-h">Built by someone who’s been turned around at the gate</h2>
              <p>I ran wireline in the Permian for five years. I was on the crew that got sent home over an expired lubricator cert, and it cost us $8,000. RollReady is the check I wish we’d had in the yard that morning.</p>
              <p>If you want to see it with your own trucks in it, call or text me at <a href={OWNER_PHONE_TEL}>{OWNER_PHONE}</a>.</p>
              <p className="rr-sign">Caden Cain</p>
              <p className="rr-fine">You won’t find fake logos or customer counts on this site. RollReady is new, and I’d rather say so.</p>
            </div>
          </div>
        </section>

        <section className="rr-close" aria-labelledby="rr-close-h">
          <div className="rr-wrap rr-center">
            <Mark className="rr-close-mark" />
            <h2 className="rr-h2" id="rr-close-h">Nothing rolls without proof.</h2>
            <p className="rr-sub">Run a load-out in the demo on your phone, start your own yard today, or call and I’ll set it up with you.</p>
            <div className="rr-cta rr-center">
              <Link href="/demo" className="rr-btn">Open the live demo</Link>
              <Link href="/signup" className="rr-btn rr-btn-ghost">Get started</Link>
              <a href={OWNER_PHONE_TEL} className="rr-btn rr-btn-ghost">Call or text {OWNER_PHONE}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="rr-foot">
        <div className="rr-wrap rr-foot-in">
          <span className="rr-foot-brand"><Mark /> RollReady by SYNNR</span>
          <nav aria-label="Footer">
            <a href={OWNER_PHONE_TEL}>Call or text {OWNER_PHONE}</a>
            <Link href="/demo">Live demo</Link>
            <Link href="/readiness-audit">Send your iron list</Link>
            <Link href="/glossary">Glossary</Link>
            <Link href="/login">Log in</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
          </nav>
          <span className="rr-copy">© 2026 SYNNR</span>
        </div>
      </footer>
    </div>
  );
}
