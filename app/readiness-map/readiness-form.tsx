"use client";

import { useState } from "react";

const RUNS = ["Wireline", "Coil tubing", "Cementing", "Construction / sub-trade", "Other"];
const HURTS = ["Missing tools / loadouts", "Certs & inspections", "Paperwork & tallies", "Dispatch / scheduling", "Billing / kickbacks"];

/** Free Readiness Map intake → /api/services-lead (stores + emails the founder). */
export default function ReadinessForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const r = await fetch("/api/services-lead", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error || "Something went wrong — email cadencain@darkstarops.com."); setBusy(false); return; }
      setDone(true);
    } catch {
      setErr("Couldn't reach SYNNR — try again, or email cadencain@darkstarops.com.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="svc-form-done">
        <b>Got it.</b>
        <p>Now pick a time below and we&apos;ll dig into your biggest money leak on the call. If you&apos;d rather, just reply to the email we send.</p>
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
      <label>Where does it hurt most?
        <select name="hurts" defaultValue="">
          <option value="" disabled>Pick the worst one…</option>
          {HURTS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
      <label>
        What made you reach out — what&apos;s the headache?
        <textarea name="bottleneck" required rows={4} placeholder="A line or two is plenty. No job packet needed — we'll dig in on the call." />
      </label>
      <div className="svc-form-row">
        <label>Best email<input name="email" type="email" required autoComplete="email" placeholder="you@shop.com" /></label>
        <label>Phone <span style={{ textTransform: "none", color: "var(--fg-faint)" }}>(optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="(432) 555-0100" /></label>
      </div>
      {err ? <p className="svc-form-err">{err}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send my details →"}
      </button>
    </form>
  );
}
