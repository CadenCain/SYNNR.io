"use client";

import { useState } from "react";
import { Check, Phone } from "lucide-react";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

/**
 * "Want this loaded with your trucks?" — phone-first lead capture. Three
 * fields, no card, no account. The buyer this exists for would rather get
 * a call than start a free trial.
 */
const fld = "h-12 w-full rounded-lg border border-line-2 bg-coal px-3.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-bone";

export default function DemoLeadForm() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/demo-lead", { method: "POST", body: new FormData(e.currentTarget) });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (j.ok) setDone(true);
      else setErr(j.error ?? "Didn't go through — call me instead.");
    } catch {
      setErr("Didn't go through — call me instead.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
          <Check className="h-6 w-6 text-emerald-400" />
        </span>
        <p className="text-lg font-semibold">Got it — I&apos;ll call you.</p>
        <p className="text-sm text-ink-dim">Usually same day. Impatient? <a href={OWNER_PHONE_TEL} className="text-bone underline">{OWNER_PHONE}</a></p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3">
      <input name="name" required placeholder="Your name" autoComplete="name" className={fld} />
      <input name="company" placeholder="Company (optional)" autoComplete="organization" className={fld} />
      <input name="phone" required type="tel" placeholder="Cell" autoComplete="tel" className={fld} />
      <input name="email" type="email" placeholder="Email (optional)" autoComplete="email" className={fld} />
      {err && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">{err}</p>}
      <button type="submit" disabled={busy}
        className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-bone px-5 font-semibold text-coal hover:bg-bone-soft disabled:opacity-50">
        <Phone className="h-4 w-4" /> {busy ? "Sending…" : "Have me set it up — free"}
      </button>
      <p className="text-center text-xs text-ink-faint">No card, no account. I call you, we load your yard together in one afternoon.</p>
    </form>
  );
}
