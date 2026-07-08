"use client";

import { useState } from "react";

/** Partner interest form — posts to /api/partners. Kept to four fields:
 *  a shop owner on a phone shouldn't have to type an essay to say "call me." */
export default function PartnersForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/partners", { method: "POST", body: new FormData(e.currentTarget) });
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
        <p><b>Got it.</b> Caden will call you within a day to set up your link and rate.</p>
        <p className="muted">Faster: call or text <a href="tel:4322500715">432-250-0715</a> right now.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="pt-form">
      <label>Your name<input name="name" type="text" required autoComplete="name" placeholder="Cody" /></label>
      <label>Company<input name="company" type="text" autoComplete="organization" placeholder="Your recert / testing shop" /></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" placeholder="432-555-0100" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" placeholder="you@yourshop.com" /></label>
      <label>Anything we should know? <span className="muted">(optional)</span><textarea name="note" rows={2} placeholder="e.g. we run BOP recerts out of Odessa" /></label>
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Become a partner"}
      </button>
      {err ? <p className="pt-err">{err}</p> : null}
      <p className="muted pt-fine">Phone or email — whichever you&apos;ll actually answer.</p>
    </form>
  );
}
