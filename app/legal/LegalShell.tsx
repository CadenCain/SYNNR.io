import "./legal.css";
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
        <a className="lback" href="/">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Back to SYNNR
        </a>
        <span className="lbrand">{MARK} SYNNR</span>
      </div>
      <article className="ldoc">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <div className="updated">Last updated {updated}</div>
        {children}
        <div className="note">
          <b>This is placeholder legal copy</b> for the SYNNR.io preview, not
          reviewed by counsel. Replace it with attorney-reviewed Terms and a
          Privacy Policy before processing live payments or production data.
        </div>
      </article>
    </div>
  );
}
