import type { ReactNode } from "react";
import { getSignedInOrg, getNavContext, getEntitlementContext } from "@/lib/marketplace/access";
import { PRODUCTS, canUseProduct } from "@/lib/catalog";
import SidebarSignout from "./sidebar-signout";

/** App-shell chrome for the whole signed-in surface: a persistent sidebar
 *  (desktop) / bottom tab bar (mobile) + a per-page top bar. Pages pass their
 *  title + content; the nav is built from what the user can actually open. */

const I = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>
);
const ICONS: Record<string, ReactNode> = {
  dashboard: I("M4 6h7v7H4ZM13 6h7v4h-7ZM13 13h7v5h-7ZM4 15h7v3H4Z"),
  tallyshot: I("M4 7h3l2-2h6l2 2h3v12H4Z|M12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"),
  gearvault: I("M21 7 12 2 3 7v10l9 5 9-5Z|M3 7l9 5 9-5M12 12v10"),
  loadcheck: I("M3 16V6h11v10M14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"),
  ticketflow: I("M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4Z|M12 7v10"),
  certwatch: I("M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6Z|M9 12l2 2 4-4"),
  services: I("M14 7a4 4 0 0 1-5 5l-5 5 2 2 5-5a4 4 0 0 0 5-5Z"),
  billing: I("M3 7h18v10H3ZM3 10h18"),
  account: I("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0"),
};

export default async function AppShell({
  current, title, subtitle, children,
}: { current: string; title: string; subtitle?: string; children: ReactNode }) {
  const org = await getSignedInOrg();
  const nav = await getNavContext();
  const ctx = org ? await getEntitlementContext(org) : { subscriptions: [], userSeatProducts: [] };
  const apps = PRODUCTS.filter((p) => canUseProduct(ctx, p.slug).allowed);

  const initials = (nav?.email || "?").slice(0, 2).toUpperCase();

  const NavLink = ({ href, slug, label, on }: { href: string; slug: string; label: string; on?: boolean }) => (
    <a href={href} className={`as-nav${on ? " on" : ""}`}>{ICONS[slug] ?? ICONS.dashboard}<span>{label}</span></a>
  );

  return (
    <div className="mkt appshell">
      <aside className="as-side">
        <a className="as-brand" href="/" aria-label="SYNNR">
          <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" /><circle cx="16" cy="16" r="2.4" fill="#060608" /></svg>
          <span className="wordmark">SYNNR</span>
        </a>
        <nav className="as-navlist">
          <NavLink href="/dashboard" slug="dashboard" label="Dashboard" on={current === "dashboard"} />
          {apps.map((p) => <NavLink key={p.slug} href={`/app/${p.slug}`} slug={p.slug} label={p.name} on={current === p.slug} />)}
          <NavLink href="/services" slug="services" label="Custom builds" on={current === "services"} />
        </nav>
        <div className="as-foot">
          <NavLink href="/billing" slug="billing" label="Billing" on={current === "billing"} />
          {nav?.canManageTeam ? <NavLink href="/team" slug="account" label="Team" on={current === "team"} /> : null}
          <a href="/account" className={`as-nav${current === "account" ? " on" : ""}`}>
            <span className="as-avatar">{initials}</span><span className="as-email">{nav?.email ?? "Account"}</span>
          </a>
          <SidebarSignout />
        </div>
      </aside>

      <div className="as-main">
        <header className="as-top">
          <a className="as-top-brand" href="/" aria-label="SYNNR"><svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" /></svg></a>
          <div className="as-top-titles">
            <h1 className="as-title">{title}</h1>
            {subtitle ? <p className="as-sub">{subtitle}</p> : null}
          </div>
        </header>
        <main className="as-content">{children}</main>
      </div>

      <nav className="as-mobnav">
        <a href="/dashboard" className={current === "dashboard" ? "on" : ""}>{ICONS.dashboard}<span>Apps</span></a>
        {apps.slice(0, 2).map((p) => <a key={p.slug} href={`/app/${p.slug}`} className={current === p.slug ? "on" : ""}>{ICONS[p.slug] ?? ICONS.dashboard}<span>{p.name}</span></a>)}
        <a href="/billing" className={current === "billing" ? "on" : ""}>{ICONS.billing}<span>Billing</span></a>
        <a href="/account" className={current === "account" ? "on" : ""}>{ICONS.account}<span>Account</span></a>
      </nav>
    </div>
  );
}
