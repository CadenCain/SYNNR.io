"use client";

import { useState } from "react";

export default function SignOff({ id, confirmedBy, confirmedAt }: { id: string; confirmedBy: string | null; confirmedAt: string | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (confirmedAt) {
    const when = new Date(confirmedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return <div className="signoff verified">✓ Verified by <b>{confirmedBy || "a teammate"}</b> on {when}</div>;
  }

  async function signOff() {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/tally/${id}/confirm`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error || "Couldn't sign off."); setBusy(false); return; }
      window.location.reload();
    } catch { setErr("Couldn't sign off — try again."); setBusy(false); }
  }

  return (
    <div className="signoff pending">
      <span>Not yet verified — review the flagged digits, then sign off so this becomes a final, billable record.</span>
      <button className="btn btn-primary btn-sm" onClick={signOff} disabled={busy}>{busy ? "Signing…" : "Verify & sign off"}</button>
      {err ? <span className="wl-err">{err}</span> : null}
    </div>
  );
}
