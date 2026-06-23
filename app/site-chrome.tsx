/**
 * Shared marketing nav + footer. The nav is auth-aware: signed-out shows
 * Sign in / Browse apps; signed-in shows a profile menu (settings / billing /
 * team / sign out). The homepage keeps its bespoke animated header.
 */
import { getNavContext } from "@/lib/marketplace/access";
import ProfileMenu from "./profile-menu";

const MARK = (
  <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
    <circle cx="16" cy="16" r="2.4" fill="#060608" />
  </svg>
);

export async function SiteNav() {
  const nav = await getNavContext();
  return (
    <header className="nav nav-static">
      <div className="nav-pill">
        <a className="brand" href="/" aria-label="SYNNR">{MARK}<span className="wordmark">SYNNR</span></a>
        <nav className="nav-links">
          <a href="/#how">How it works</a>
          <a href="/#fix">What we fix</a>
          <a href="/#faq">FAQ</a>
        </nav>
        <div className="nav-cta">
          {nav ? (
            <>
              <a href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</a>
              <ProfileMenu email={nav.email} canManageTeam={nav.canManageTeam} />
            </>
          ) : (
            <>
              <a href="/login" className="btn btn-ghost btn-sm nav-signin">Sign in</a>
              <a href="/readiness-map" className="btn btn-primary btn-sm">Free Readiness Map</a>
            </>
          )}
          <label className="nav-burger" htmlFor="navMenu" aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </label>
        </div>
        <input type="checkbox" id="navMenu" className="nav-toggle" aria-hidden="true" />
        <nav className="nav-mobile">
          <a href="/#how">How it works</a>
          <a href="/#fix">What we fix</a>
          <a href="/#faq">FAQ</a>
          {nav ? <a href="/dashboard">Dashboard</a> : <><a href="/login">Sign in</a><a href="/readiness-map">Free Readiness Map</a></>}
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
            <p className="blurb">Operations partner for oilfield &amp; blue-collar service shops. We find where your jobs leak money, build the fix, and run it for you.</p>
          </div>
          <div><h5>SYNNR</h5><ul><li><a href="/#how">How it works</a></li><li><a href="/#fix">What we fix</a></li><li><a href="/#faq">FAQ</a></li><li><a href="/readiness-map">Free Readiness Map</a></li></ul></div>
          <div><h5>Company</h5><ul><li><a href="/login">Client sign in</a></li><li><a href="mailto:cadencain@darkstarops.com">cadencain@darkstarops.com</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SYNNR</span>
          <span>Operations systems for service shops.</span>
        </div>
      </div>
    </footer>
  );
}
