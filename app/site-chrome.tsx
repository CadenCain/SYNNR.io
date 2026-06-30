/**
 * Shared marketing nav + footer for the public service site. No "Dashboard" or
 * "Sign in" — SYNNR is a service, not a software login. Every CTA is the
 * free readiness audit. The homepage keeps its bespoke animated header.
 */
const MARK = (
  <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
    <circle cx="16" cy="16" r="2.4" fill="#060608" />
  </svg>
);

export function SiteNav() {
  return (
    <header className="nav nav-static">
      <div className="nav-pill">
        <a className="brand" href="/" aria-label="SYNNR">{MARK}<span className="wordmark">SYNNR</span></a>
        <nav className="nav-links">
          <a href="/#problem">The problem</a>
          <a href="/#how">How it works</a>
          <a href="/#track">What we track</a>
          <a href="/#why">Why SYNNR</a>
        </nav>
        <div className="nav-cta">
          <a href="/readiness-audit" className="btn btn-primary btn-sm">Free readiness audit</a>
          <label className="nav-burger" htmlFor="navMenu" aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </label>
        </div>
        <input type="checkbox" id="navMenu" className="nav-toggle" aria-hidden="true" />
        <nav className="nav-mobile">
          <a href="/#problem">The problem</a>
          <a href="/#how">How it works</a>
          <a href="/#track">What we track</a>
          <a href="/#why">Why SYNNR</a>
          <a href="/readiness-audit">Get your free readiness audit</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <a className="brand" href="/">{MARK}<span className="wordmark">SYNNR</span></a>
            <p className="blurb">Equipment &amp; cert readiness tracking for oilfield service shops, done for you. Never miss an expiration or asset again.</p>
          </div>
          <div><h5>SYNNR</h5><ul><li><a href="/#how">How it works</a></li><li><a href="/#track">What we track</a></li><li><a href="/#why">Why SYNNR</a></li><li><a href="/readiness-audit">Free readiness audit</a></li></ul></div>
          <div><h5>Company</h5><ul><li><a href="/readiness-audit">Free readiness audit</a></li><li><a href="mailto:cadencain@darkstarops.com">cadencain@darkstarops.com</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SYNNR</span>
          <span>Equipment &amp; cert readiness, done for you.</span>
        </div>
      </div>
    </footer>
  );
}
