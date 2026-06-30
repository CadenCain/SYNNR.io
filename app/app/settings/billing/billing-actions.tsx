"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BillingActions({ subscribed }: { subscribed: boolean }) {
  const [busy, setBusy] = useState(false);
  async function go(endpoint: string) {
    setBusy(true);
    try {
      const r = await fetch(endpoint, { method: "POST" });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else { setBusy(false); alert(d.error || "Something went wrong."); }
    } catch { setBusy(false); }
  }
  return subscribed ? (
    <Button onClick={() => go("/api/saas/portal")} disabled={busy} variant="outline">
      {busy ? "Opening…" : "Manage billing"}
    </Button>
  ) : (
    <Button onClick={() => go("/api/saas/checkout")} disabled={busy}>
      {busy ? "Starting…" : "Subscribe"}
    </Button>
  );
}
