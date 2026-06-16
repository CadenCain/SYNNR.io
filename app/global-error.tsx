"use client";

import { useEffect } from "react";

/** Last-resort boundary for errors thrown in the root layout itself. Must render
 *  its own <html>/<body>. Kept dependency-free so it can't fail the same way. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error?.digest ?? "", error?.message ?? error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#0c0d0e", color: "#e9e4d8", fontFamily: "ui-sans-serif, system-ui, sans-serif", margin: 0 }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
          <div style={{ maxWidth: 440 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>Something broke.</h1>
            <p style={{ color: "#9b958a", lineHeight: 1.6 }}>
              We hit an error on our end — your data is safe. Try again, or email support@synnr.io.
            </p>
            <button
              onClick={() => reset()}
              style={{ marginTop: 18, background: "#c9b88a", color: "#0b0b0b", border: 0, borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
