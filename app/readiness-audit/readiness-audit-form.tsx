"use client";

import { useState } from "react";

const RUNS = ["Wireline", "Coil tubing", "Cementing", "Construction / sub-trade", "Other"];

/** Free readiness audit intake form → /api/readiness-audit */
export default function ReadinessAuditForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await fetch("/api/readiness-audit", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setErr(d.error || "Something went wrong — email cadencain@darkstarops.com.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setErr("Couldn't reach us — try again, or email cadencain@darkstarops.com.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ra-form-done">
        <b>Got it ✓</b>
        <p>
          We'll email you this week with your free readiness audit — what's expired, expiring, and missing in your yard.
          No pitch, just the facts. We'll follow up if it looks like a fit.
        </p>
      </div>
    );
  }

  return (
    <form className="svc-form" onSubmit={onSubmit}>
      <div className="svc-form-row">
        <label>Name<input name="name" type="text" required autoComplete="name" placeholder="Your name" /></label>
        <label>Shop / company<input name="company" type="text" autoComplete="organization" placeholder="Your shop" /></label>
      </div>
      <div className="svc-form-row">
        <label>Your role<input name="role" type="text" placeholder="Owner, ops manager…" /></label>
        <label>What do you run?
          <select name="runs" defaultValue="">
            <option value="" disabled>Pick one…</option>
            {RUNS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <label>
        What's your biggest asset or cert headache right now?
        <textarea name="headache" required rows={4} placeholder="A line or two is plenty. Certs lapsing? DOT surprises? Whiteboard chaos? Tell us." />
      </label>
      <div className="svc-form-row">
        <label>Best email<input name="email" type="email" required autoComplete="email" placeholder="you@shop.com" /></label>
        <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" placeholder="(432) 555-0100" /></label>
      </div>
      {err ? <p className="svc-form-err">{err}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send my details →"}
      </button>
    </form>
  );
}
