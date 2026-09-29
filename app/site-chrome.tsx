import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

/**
 * Shared marketing nav + footer for the subpages (partners, build, readiness
 * map, glossary, legal-adjacent). Same shape as the homepage: SYNNR only,
 * demo and phone as the two ways in, no card-first signup button.
 */
const MARK = (
  <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#1d4ed8" />
  </svg>
);

export function SiteNav() {
  return (
    <header className="nav nav-static">
      <div className="nav-pill">
        <a className="brand" href="/" aria-label="SYNNR">{MARK}<span className="wordmark">SYNNR</span></a>
        <nav className="nav-links">
          <a href="/#how">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/demo">Live demo</a>
        </nav>
        <div className="nav-cta">
          <a href={OWNER_PHONE_TEL} className="nav-login">{OWNER_PHONE}</a>
          <a href="/login" className="nav-login">Log in</a>
          <a href="/demo" className="btn btn-primary btn-sm">Open the live demo</a>
          <label className="nav-burger" htmlFor="navMenu" aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </label>
        </div>
        <input type="checkbox" id="navMenu" className="nav-toggle" aria-hidden="true" />
        <nav className="nav-mobile">
          <a href="/#how">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/demo">Live demo</a>
          <a href={OWNER_PHONE_TEL}>Call or text {OWNER_PHONE}</a>
          <a href="/login">Log in</a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="simple-footer">
      <div className="container">
        <div className="row">
          <span className="brand-sm">SYNNR</span>
          <a href={OWNER_PHONE_TEL}>Call or text {OWNER_PHONE}</a>
          <a href="/demo">Live demo</a>
          <a href="/readiness-audit">Free readiness map</a>
          <a href="/partners">Partners</a>
          <a href="/build">Custom builds</a>
          <a href="/login">Log in</a>
          <a href="/legal/terms">Terms</a>
          <a href="/legal/privacy">Privacy</a>
          <span className="copy">&copy; 2026 SYNNR</span>
        </div>
      </div>
    </footer>
  );
}
