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
        setErr(d.error || "Something went wrong. Call or text 432-250-0715.");
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setErr("That didn't go through. Try again, or call or text 432-250-0715.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="ra-form-done">
        <b>Got it.</b>
        <p>
          I'll call or text you this week. Send the list whenever it's handy, and I'll tell you what's expired, coming due, and missing.
          If RollReady fits, I'll load your iron with you. If not, you still get the list back.
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
        What goes wrong at load-out in your yard?
        <textarea name="headache" required rows={4} placeholder="A line or two is plenty. Certs lapsing? Pieces left in the yard? Red tags that went anyway?" />
      </label>
      <div className="svc-form-row">
        <label>Cell<input name="phone" type="tel" required autoComplete="tel" placeholder="(432) 555-0100" /></label>
        <label>Email (optional)<input name="email" type="email" autoComplete="email" placeholder="you@shop.com" /></label>
      </div>
      {err ? <p className="svc-form-err">{err}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
