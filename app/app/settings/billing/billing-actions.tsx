"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The billing buttons. Three states, not two: subscribed accounts get the
 * Stripe portal, unsubscribed get checkout, and COMPED accounts (status
 * active with no Stripe customer — the owner's own demo companies) get a
 * plain label instead of a portal button that can only fail. Errors render
 * inline; the old alert() box read like the app breaking.
 */
export default function BillingActions({ mode }: { mode: "portal" | "subscribe" | "comped" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (mode === "comped") {
    return (
      <span className="rounded-lg border border-line-2 bg-elevated px-3 py-2 text-sm text-ink-faint">
        Comped account — no card on file
      </span>
    );
  }

  async function go(endpoint: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(endpoint, { method: "POST" });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      setError(d.error || "Something went wrong. Try again.");
    } catch {
      setError("Couldn't reach billing. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {mode === "portal" ? (
        <Button onClick={() => go("/api/saas/portal")} disabled={busy} variant="outline">
          {busy ? "Opening…" : "Manage billing"}
        </Button>
      ) : (
        <Button onClick={() => go("/api/saas/checkout")} disabled={busy}>
          {busy ? "Starting…" : "Subscribe"}
        </Button>
      )}
      {error ? <span className="max-w-64 text-right text-xs text-red-400">{error}</span> : null}
    </div>
  );
}
