import "./op.css";
import Link from "next/link";
import { getOperator } from "@/lib/op/auth";

/**
 * Operator console shell. Wraps every /op/* page with the sidebar + auth
 * check. The /op/login route uses a marker file to skip the chrome — when
 * children is the login page, we render without the sidebar.
 *
 * Auth: read once here in the layout. Child pages call requireOperator()
 * defensively so a missing session never reaches data fetching.
 */
export const metadata = {
  title: "SYNNR · Operator Console",
  description: "SYNNR operator console — not for shop use.",
  robots: { index: false, follow: false },
};

export default async function OpLayout({ children }: { children: React.ReactNode }) {
  // The auth gate runs in every page that needs it; the layout just shows
  // the right chrome based on whether someone's signed in.
  const op = await getOperator();

  return (
    <div className="op">
      {op ? <SignedInShell email={op.email}>{children}</SignedInShell> : children}
    </div>
  );
}

function SignedInShell({ email, children }: { email: string; children: React.ReactNode }) {
  return (
    <div className="op-shell">
      <aside className="op-side">
        <div className="op-side-brand">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
          </svg>
          SYNNR ops
        </div>

        <div className="op-side-section">Today</div>
        <nav className="op-nav">
          <Link href="/op">Dashboard</Link>
          <Link href="/op/outbound">Today&apos;s outbound</Link>
        </nav>

        <div className="op-side-section">Shops</div>
        <nav className="op-nav">
          <Link href="/op/shops">All shops</Link>
          <Link href="/op/shops/new">New shop</Link>
        </nav>

        <div className="op-side-foot">
          Signed in as<br />
          <b>{email}</b>
          <form action="/op/api/sign-out" method="post" style={{ marginTop: 10 }}>
            <button className="op-btn op-btn-ghost op-btn-sm" type="submit">Sign out</button>
          </form>
        </div>
      </aside>

      <main className="op-main">{children}</main>
    </div>
  );
}
