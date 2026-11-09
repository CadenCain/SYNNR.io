import "./legal.css";
import Link from "next/link";
import type { ReactNode } from "react";

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

export function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="legal">
      <div className="lbar">
        <Link className="lback" href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to SYNNR
        </Link>
        <span className="lbrand">{MARK} SYNNR</span>
      </div>
      <article className="ldoc">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <div className="updated">Last updated {updated}</div>
        {children}
        {/* Not yet reviewed by a lawyer (see the flags at the top of terms/page.tsx).
            Get it reviewed before signing big customers; the public page doesn't say "placeholder". */}
      </article>
    </div>
  );
}
