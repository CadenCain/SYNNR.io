"use client";

import { useState } from "react";

/** Custom-build inquiry form — posts to /api/build. Same shape as the partner
 *  form: a shop owner shouldn't type an essay to say "here's my headache." */
export default function BuildForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/build", { method: "POST", body: new FormData(e.currentTarget) });
      const d = await r.json().catch(() => ({ ok: false, error: "Something went wrong." }));
      if (d.ok) setDone(true);
      else setErr(d.error || "Something went wrong — call or text 432-250-0715.");
    } catch {
      setErr("Couldn't reach the server — call or text 432-250-0715.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="pt-done">
        <p><b>Got it.</b> Caden will call you to scope it and give you a real number — no obligation.</p>
        <p className="muted">Faster: call or text <a href="tel:4322500715">432-250-0715</a>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="pt-form">
      <label>Your name<input name="name" type="text" required autoComplete="name" placeholder="Cody" /></label>
      <label>Company<input name="company" type="text" autoComplete="organization" placeholder="Your shop" /></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" placeholder="432-555-0100" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="you@yourshop.com" /></label>
      <label>What&apos;s the headache? <span className="muted">(the paperwork or nightly grind you&apos;d kill)</span>
        <textarea name="note" rows={3} required placeholder="e.g. field tickets are all paper and invoicing eats every weekend" /></label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Get a scope + a number"}
      </button>
      {err ? <p className="pt-err">{err}</p> : null}
      <p className="muted pt-fine">No obligation. We scope it, you get a fixed price before anyone writes code.</p>
    </form>
  );
}
