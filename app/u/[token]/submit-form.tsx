"use client";

import { useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { submitDocUpdate } from "./actions";

/**
 * The hand's upload form — built for a phone in a truck cab: one big camera
 * button, huge tap targets, nothing to figure out. Kind + date are one tap
 * each; the photo is the point.
 */

const KINDS = ["CDL", "DOT medical card", "H2S", "Well control", "Other card"];
const fld = "h-13 min-h-13 w-full rounded-xl border border-line-2 bg-coal px-4 text-base text-ink outline-none focus:border-bone";

export default function SubmitForm({ token, kindHint, alreadySubmitted }: { token: string; kindHint: string | null; alreadySubmitted: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("token", token);
    const res = await submitDocUpdate(fd);
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "something went wrong — try again");
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
          <Check className="h-7 w-7 text-emerald-400" />
        </span>
        <p className="text-xl font-semibold">Got it. You&apos;re done.</p>
        <p className="text-base text-ink-dim">Your card&apos;s in — the office takes it from here.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {alreadySubmitted && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          A photo already came through on this link — sending another replaces it.
        </p>
      )}

      <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
        Which card?
        <select name="kind" defaultValue={kindHint && KINDS.includes(kindHint) ? kindHint : kindHint || "CDL"} className={fld}>
          {kindHint && !KINDS.includes(kindHint) ? <option value={kindHint}>{kindHint}</option> : null}
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>

      {/* The star of the page. Solid, huge, impossible to miss in sunlight. */}
      <button type="button" onClick={() => fileRef.current?.click()}
        className={`flex min-h-16 items-center justify-center gap-2.5 rounded-xl text-lg font-semibold ${fileName ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "bg-bone text-coal"}`}>
        <Camera className="h-6 w-6" />
        {fileName ? "Photo attached — tap to retake" : "Take a photo of the card"}
      </button>
      <input ref={fileRef} name="photo" type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />

      <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
        New expiration date (it&apos;s printed on the card)
        <input name="expiration" type="date" className={fld} />
      </label>

      <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
        Anything else? (optional)
        <input name="note" placeholder="e.g. renewed at the Odessa clinic" className={fld} />
      </label>

      {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">{error}</p>}

      <button type="submit" disabled={busy || !fileName}
        className="min-h-14 rounded-xl bg-bone text-lg font-semibold text-coal disabled:opacity-40">
        {busy ? "Sending…" : "Send it in"}
      </button>
    </form>
  );
}
