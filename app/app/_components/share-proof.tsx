"use client";

import { useState } from "react";
import { Share2, Check, Copy, X, Send } from "lucide-react";
import { createReadinessProof } from "../_proof-actions";

/**
 * One click → public proof link, shown until dismissed.
 *
 * The first version copied to the clipboard and flashed "copied" for four
 * seconds — and on any failure it silently reset to idle. An ops-manager
 * test run clicked the flagship trust feature, saw "Creating…", then
 * nothing, and concluded it was broken. The link now STAYS on screen with
 * its own copy button until the user closes it, and a failure says so.
 */
export default function ShareProof({
  scope,
  yardId,
  unitId,
  warn,
}: {
  scope: "company" | "yard" | "unit";
  yardId?: string;
  unitId?: string;
  /** Said next to the link, e.g. "CT-03 is NOT READY right now, and the link says so." */
  warn?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await createReadinessProof({ scope, yardId, unitId });
      if (!res.ok || !res.url) {
        setError(res.error || "Couldn't create the link. Try again.");
        return;
      }
      setUrl(res.url);
      // Best-effort convenience only — the visible panel is the real UX.
      try {
        await navigator.clipboard.writeText(res.url);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    } catch {
      setError("Couldn't create the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked — the input is selectable, nothing else to do
    }
  }

  // On a phone, hand it straight to Messages (or the share sheet) so the
  // company man gets it in one tap.
  async function send() {
    const text = `Readiness proof: ${url}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: "Readiness proof", url }); return; } catch { /* closed the sheet */ return; }
    }
    window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
  }

  if (url) {
    return (
      <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-1.5 pl-2.5">
        <span className="hidden text-xs font-semibold text-emerald-400 sm:block">Proof link</span>
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          className="h-8 w-28 min-w-0 rounded-md border border-line-2 bg-coal px-2 text-xs text-ink outline-none sm:w-64" />
        <button onClick={copy} className="flex h-8 items-center gap-1 rounded-md border border-line-2 px-2 text-xs text-ink-dim hover:bg-elevated hover:text-ink">
          {copied ? <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
        </button>
        <button onClick={send} className="flex h-8 items-center gap-1 rounded-md bg-bone px-2 text-xs font-medium text-white hover:bg-bone-soft">
          <Send className="h-3.5 w-3.5" /> Send
        </button>
        <button onClick={() => { setUrl(""); setCopied(false); }} aria-label="Dismiss"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint hover:bg-elevated hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {warn ? <p className="text-xs text-red-400">{warn}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="max-w-48 truncate text-xs text-red-400" title={error}>{error}</span> : null}
      <button onClick={go} disabled={busy}
        className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink disabled:opacity-50">
        <Share2 className="h-4 w-4" /> {busy ? "Creating…" : "Share proof"}
      </button>
    </div>
  );
}
