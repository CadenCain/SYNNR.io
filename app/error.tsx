"use client";

import { useEffect } from "react";
import "./marketing.css";

/**
 * Route-segment error boundary. Catches render/data errors in any page under
 * app/ and shows a calm, on-brand recovery screen instead of a raw 500 — field
 * users get a "try again", not a stack trace. Also logs to the server console
 * (visible in Vercel runtime logs / observability).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in Vercel runtime logs for monitoring.
    console.error("[app/error]", error?.digest ?? "", error?.message ?? error);
  }, [error]);

  return (
    <div className="mkt">
      <main className="container" style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ maxWidth: 460 }}>
          <span className="eyebrow">Something broke</span>
          <h1 className="h2" style={{ marginTop: 8 }}>That didn&apos;t go through.</h1>
          <p className="lede" style={{ marginInline: "auto" }}>
            We hit an error on our end — your data is safe. Try again, and if it keeps happening, email{" "}
            <a href="mailto:cadencain@synnr.io">cadencain@synnr.io</a>.
          </p>
          {error?.digest ? (
            <p className="mono" style={{ fontSize: 12, color: "var(--fg-faint)", marginTop: 6 }}>ref: {error.digest}</p>
          ) : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => reset()}>Try again</button>
            <a className="btn btn-ghost" href="/dashboard">Back to your apps</a>
          </div>
        </div>
      </main>
    </div>
  );
}
