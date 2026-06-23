"use client";

import { useState } from "react";

const RUNS = ["Wireline", "Coil tubing", "Cementing", "Construction / sub-trade", "Other"];
const HURTS = ["Missing tools / loadouts", "Certs & inspections", "Paperwork & tallies", "Dispatch / scheduling", "Billing / kickbacks"];

/** Free Readiness Map intake → /api/services-lead (stores + emails the founder). */
export default function ReadinessForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");

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
        <p>I&apos;ll map where your jobs are leaking money and email you this week.</p>
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
        Describe one real job packet or loadout — what goes wrong with it?
        <textarea name="bottleneck" required rows={4} placeholder="A line or two is plenty. Or just upload it below." />
      </label>
      <label className="svc-file">
        <span>Upload one job packet / loadout list and we&apos;ll map it. <em>(optional — PDF, JPG, PNG, XLSX, CSV)</em></span>
        <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,image/jpeg,image/png"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
        {fileName ? <span className="svc-file-name">{fileName}</span> : null}
      </label>
      <div className="svc-form-row">
        <label>Best email<input name="email" type="email" required autoComplete="email" placeholder="you@shop.com" /></label>
        <label>Phone <span style={{ textTransform: "none", color: "var(--fg-faint)" }}>(optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="(432) 555-0100" /></label>
      </div>
      {err ? <p className="svc-form-err">{err}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Get my free Readiness Map"}
      </button>
    </form>
  );
}
