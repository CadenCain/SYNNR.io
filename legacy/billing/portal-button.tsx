"use client";

import { useState } from "react";

/** Opens the Stripe Customer Portal, or explains why it's not available yet. */
export default function PortalButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function open() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/billing/portal", { method: "POST" });
      const d = await r.json();
      if (d.configured && d.url) { window.location.href = d.url; return; }
      if (d.configured === false) setMsg("Billing isn't connected yet — Stripe keys pending.");
      else setMsg(d.error || "Couldn't open billing.");
    } catch { setMsg("Couldn't reach billing — try again."); }
    setBusy(false);
  }

  return (
    <div>
      <button className="btn btn-primary" onClick={open} disabled={busy}>
        {busy ? "Opening…" : "Manage billing & seats"}
      </button>
      {msg ? <p className="apps-note" style={{ textAlign: "left", marginTop: 14 }}>{msg}</p> : null}
    </div>
  );
}
