"use client";

import { useState } from "react";

/** Free Operations Audit lead form — multipart (optional file) → /api/services-lead. */
export default function AuditForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const form = e.currentTarget;
    const fd = new FormData(form);
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
        <p>I&apos;ll map your readiness gaps and email you this week.</p>
      </div>
    );
  }

  return (
    <form className="svc-form" onSubmit={onSubmit}>
      <div className="svc-form-row">
        <label>Name<input name="name" type="text" required autoComplete="name" placeholder="Your name" /></label>
        <label>Company<input name="company" type="text" autoComplete="organization" placeholder="Optional" /></label>
      </div>
      <label>Work email<input name="email" type="email" required autoComplete="email" placeholder="you@company.com" /></label>
      <label>
        What&apos;s your biggest operational bottleneck right now? Missing tools, delayed tickets, dispatch chaos?
        <textarea name="bottleneck" required rows={4} placeholder="A line or two is plenty." />
      </label>
      <label className="svc-file">
        <span>Send a loadout list or field ticket and we&apos;ll map it. <em>(optional — PDF, JPG, PNG, XLSX, CSV)</em></span>
        <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,application/pdf,image/jpeg,image/png"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
        {fileName ? <span className="svc-file-name">{fileName}</span> : null}
      </label>
      {err ? <p className="svc-form-err">{err}</p> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send it — map my readiness gaps"}
      </button>
    </form>
  );
}
