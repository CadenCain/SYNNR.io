import type { Metadata } from "next";
import Link from "next/link";
import "./home.css";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";
import HomeGate from "./home-gate";
import HomeMotion from "./home-motion";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// RollReady homepage (2026-11, the quick check). The pitch: make sure the
// right stuff goes out. A check at the truck in under a minute, NOT READY
// that says what's missing, and a locked record of who cleared the truck.
// The hero is the check itself and the board is drawn in code, not a
// screenshot. No customer names, logos, or counts anywhere.

const Mark = ({ className = "rr-mark" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="currentColor" />
  </svg>
);

const STEPS = [
  { n: "1", h: "Set each truck’s list once", p: "A manager picks the 5 to 8 things that cause a hotshot when they get left behind. Add a job list like Plug set if you want one. No iron to enter, no serials, no cert dates." },
  { n: "2", h: "Check it at the truck", p: "The hand taps the truck, taps On truck on each line, taps checks like BOP rams closed for travel, takes one photo, and taps Ready." },
  { n: "3", h: "Missing means NOT READY", p: "Anything not tapped makes the truck NOT READY, and the screen says what’s missing, like “Not on the truck: Sinker bars.” You find out in the yard, not on location." },
  { n: "4", h: "The record locks", p: "Who cleared the truck, what they said was on it, the photo, and the time. Nobody can edit it. The operator gets a proof link that shows the same." },
];

const VERSUS = [
  { a: "“Truck’s loaded” at 4:50 AM.", b: "Every line tapped On truck, one photo, and Ready, with a name and the time." },
  { a: "Something got left behind. You find out on location.", b: "Anything not tapped reads NOT READY in the yard, and says what’s missing." },
  { a: "Who loaded it? Scroll back and guess.", b: "The record shows who cleared the truck and what they said was on it." },
  { a: "The operator takes your word for it.", b: "The operator gets a proof link with the same record and the photo." },
];

const BOARD = [
  { truck: "WL-07", tone: "go", status: "Ready", line: "Cleared by Dale Wooten, 5:02 AM", act: null },
  { truck: "WL-03", tone: "stop", status: "Not ready", line: "Not on the truck: Crossover subs", act: "Check it again" },
  { truck: "WL-05", tone: "out", status: "Out on a job", line: "Left yesterday, 6:15 AM", act: "It’s back" },
  { truck: "WL-09", tone: "idle", status: "Not checked yet", line: "Nobody has checked it today", act: "Check it" },
];

const TOOLS = [
  { name: "Silver Fox", ready: 4, out: 2, used: 3 },
  { name: "Baker 20", ready: 6, out: 1, used: 2 },
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
            <a href="#board">For managers</a>
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
          <a href="#board">For managers</a>
          <a href="#pricing">Pricing</a>
          <Link href="/demo">Live demo</Link>
          <Link href="/signup">Get started</Link>
          <Link href="/login">Log in</Link>
          <a href={OWNER_PHONE_TEL}>Call or text {OWNER_PHONE}</a>
        </nav>
      </header>

      <main>
        <section className="rr-hero" aria-labelledby="rr-hero-h">
          <div className="rr-wrap rr-hero-grid">
            <div className="rr-hero-copy">
              <p className="rr-kicker">Load-out checks for oilfield service yards</p>
              <h1 id="rr-hero-h">Make sure the right stuff goes out.</h1>
              <p className="rr-lede">
                RollReady is a check at the truck that takes under a minute. The hand taps what’s on it, takes one photo,
                and taps Ready. If anything’s missing, it reads NOT READY and says what. And you always know who cleared the truck.
              </p>
              <div className="rr-cta">
                <Link href="/demo" className="rr-btn">Open the live demo</Link>
                <a href={OWNER_PHONE_TEL} className="rr-btn rr-btn-ghost">Call or text {OWNER_PHONE}</a>
              </div>
              <p className="rr-note">The demo is the real app with a made-up yard. No signup, no card.</p>
            </div>
            <HomeGate />
          </div>
        </section>

        <section className="rr-sec rr-band" id="trip" aria-labelledby="rr-trip-h">
          <div className="rr-wrap">
            <div className="rr-head rv">
              <p className="rr-kicker">How it works</p>
              <h2 className="rr-h2" id="rr-trip-h">Under a minute at the truck</h2>
              <p className="rr-sub">Made for a tired hand at 5 AM. Big buttons, plain words, and nothing to type.</p>
            </div>
            <ol className="rr-trip">
              {STEPS.map((t) => (
                <li key={t.n} className="rv">
                  <span className="rr-num">{t.n}</span>
                  <h3>{t.h}</h3>
                  <p>{t.p}</p>
                </li>
              ))}
            </ol>
            <p className="rr-fine rr-trip-fine rv">
              Works on the phones your crew already has. If there’s no signal, the taps stay on the phone until there is.
              A yard that wants more can switch on the full check in Settings: every piece scanned, with its tests and cert paper checked.
            </p>
          </div>
        </section>

        <section className="rr-sec" aria-labelledby="rr-vs-h">
          <div className="rr-wrap">
            <div className="rr-head rv">
              <p className="rr-kicker">Better than a group text</p>
              <h2 className="rr-h2" id="rr-vs-h">When something’s missing, you know who cleared the truck.</h2>
              <p className="rr-sub">No digging through group chats. Every check saves one record that nobody can edit.</p>
            </div>
            <div className="rr-vs rv" role="table" aria-label="A group text compared with RollReady">
              <div className="rr-vs-row rr-vs-headrow" role="row">
                <span role="columnheader">A group text</span>
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

        <section className="rr-sec rr-band" id="board" aria-labelledby="rr-board-h">
          <div className="rr-wrap rr-split">
            <div className="rv">
              <p className="rr-kicker">For the yard manager</p>
              <h2 className="rr-h2" id="rr-board-h">Every truck on one screen</h2>
              <p className="rr-sub">
                Ready, not ready, out on a job, or not checked yet. A truck that isn’t ready shows what’s missing.
                When one gets back from a job, tap It’s back.
              </p>
              <p className="rr-sub">
                <b>Tools out</b> counts the setting tools in each yard, like Silver Fox and Baker 20: how many are ready,
                how many are out with someone, and how many are used and waiting on the vendor’s pickup.
              </p>
            </div>
            <figure className="rr-board rv" aria-label="Example of the manager’s board and Tools out">
              <div className="rr-board-top"><b>Trucks</b><span>Example yard</span></div>
              <ul className="rr-board-rows">
                {BOARD.map((r) => (
                  <li key={r.truck} className={r.tone}>
                    <span className="rr-board-truck">{r.truck}</span>
                    <span className="rr-board-mid">
                      <span className={`rr-chip ${r.tone}`}>{r.status}</span>
                      <span className="rr-board-line">{r.line}</span>
                    </span>
                    {r.act ? <span className="rr-board-act" aria-hidden="true">{r.act}</span> : null}
                  </li>
                ))}
              </ul>
              <div className="rr-tools">
                <div className="rr-tools-h">Tools out</div>
                <table>
                  <thead>
                    <tr><th scope="col">Setting tools</th><th scope="col">Ready</th><th scope="col">Out</th><th scope="col">Used</th></tr>
                  </thead>
                  <tbody>
                    {TOOLS.map((t) => (
                      <tr key={t.name}><th scope="row">{t.name}</th><td>{t.ready}</td><td>{t.out}</td><td>{t.used}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="rr-tools-fine">Used ones wait on the shelf for the vendor’s pickup.</p>
              </div>
            </figure>
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
                <li>Set up your truck lists yourself, free. Or I’ll set them up with you: $1,000 a yard, one time, and free for the first 10 yards I set up.</li>
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
              <p>What yards have told me since is that the everyday miss is the wrong gear on the truck, a hotshot to fix it, and nobody knowing who cleared the truck.</p>
              <p>If you want to see it with your own trucks in it, call or text me at <a href={OWNER_PHONE_TEL}>{OWNER_PHONE}</a>.</p>
              <p className="rr-sign">Caden Cain</p>
              <p className="rr-fine">You won’t find fake logos or customer counts on this site. RollReady is new, and I’d rather say so.</p>
            </div>
          </div>
        </section>

        <section className="rr-close" aria-labelledby="rr-close-h">
          <div className="rr-wrap rr-center">
            <Mark className="rr-close-mark" />
            <h2 className="rr-h2" id="rr-close-h">Every truck leaves with the right gear.</h2>
            <p className="rr-sub">Check a truck in the demo on your phone. It takes under a minute. Or call, and I’ll set up your trucks with you.</p>
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
            <Link href="/readiness-audit">Send your truck lists</Link>
            <Link href="/glossary">Glossary</Link>
            <Link href="/login">Log in</Link>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
          </nav>
          <span className="rr-copy">© 2026 SYNNR · Darkstar Dynamics LLC</span>
        </div>
      </footer>
    </div>
  );
}
