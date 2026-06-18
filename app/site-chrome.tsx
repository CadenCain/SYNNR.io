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
          <a href="/apps">Apps</a>
          <a href="/services">Custom Builds</a>
          <a href="/apps/tallyshot#pricing">Pricing</a>
          <a href="/glossary">Glossary</a>
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
              <a href="/apps" className="btn btn-primary btn-sm">Browse apps</a>
            </>
          )}
          <label className="nav-burger" htmlFor="navMenu" aria-label="Open menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </label>
        </div>
        <input type="checkbox" id="navMenu" className="nav-toggle" aria-hidden="true" />
        <nav className="nav-mobile">
          <a href="/apps">Apps</a>
          <a href="/services">Custom Builds</a>
          <a href="/apps/tallyshot#pricing">Pricing</a>
          <a href="/glossary">Glossary</a>
          {nav ? <a href="/dashboard">Dashboard</a> : <a href="/login">Sign in</a>}
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
            <p className="blurb">The app platform for oilfield service companies. Purpose-built apps, ready to use — pick one, start in minutes.</p>
          </div>
          <div><h5>Apps</h5><ul><li><a href="/apps/tallyshot">TallyShot</a></li><li><a href="/apps">All apps</a></li><li><a href="/services">Custom Builds</a></li><li><a href="/apps/tallyshot#pricing">Pricing</a></li><li><a href="/glossary">Glossary</a></li></ul></div>
          <div><h5>Company</h5><ul><li><a href="/login">Sign in</a></li><li><a href="/ingest">Live demo</a></li><li><a href="mailto:cadencain@darkstarops.com">Contact</a></li><li><a href="/legal/terms">Terms</a></li><li><a href="/legal/privacy">Privacy</a></li></ul></div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SYNNR</span>
          <span>The boring operational stuff, finally done right.</span>
        </div>
      </div>
    </footer>
  );
}
