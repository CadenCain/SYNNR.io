"use client";

import { useState } from "react";
import { Minus, Plus, Check } from "lucide-react";

/**
 * Subscribe card with a yard-count stepper. A shop running 4 yards says so
 * here and the checkout opens at 4 × $500 — no support ticket, no surprise
 * on the first invoice. The count is adjustable again on the Stripe page,
 * and billing follows active yards after that.
 */
const PER_YARD = 500;
const FEATURES = [
  "Every asset, cert, DOT item & crew card — one place",
  "Alerts before anything lapses",
  "Job-date pre-dispatch check, no override",
  "Readiness-proof links instead of binders",
];

export default function SubscribeCard({ initialYards }: { initialYards: number }) {
  const [yards, setYards] = useState(Math.min(50, Math.max(1, initialYards)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function subscribe() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/saas/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: yards }),
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else { setErr(d.error || "Something went wrong. Try again."); setBusy(false); }
    } catch {
      setErr("Couldn't reach billing. Try again.");
      setBusy(false);
    }
  }

  const step = (d: number) => setYards((y) => Math.min(50, Math.max(1, y + d)));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Price header */}
      <div className="border-b border-line bg-elevated/60 p-6">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight text-bone">${PER_YARD}</span>
          <span className="text-sm text-ink-dim">per yard / month</span>
        </div>
        <p className="mt-1 text-sm text-ink-dim">No tiers, no per-seat math. A yard is a yard.</p>
      </div>

      <div className="flex flex-col gap-5 p-6">
        <ul className="flex flex-col gap-2.5 text-sm text-ink-dim">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}
            </li>
          ))}
        </ul>

        {/* Yard stepper */}
        <div className="flex items-center justify-between rounded-xl border border-line-2 bg-coal p-4">
          <div>
            <div className="text-sm font-medium text-ink">How many yards do you run?</div>
            <div className="mt-0.5 text-xs text-ink-faint">Add or drop yards anytime — billing follows.</div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => step(-1)} disabled={yards <= 1} aria-label="Fewer yards"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-8 text-center text-xl font-semibold tabular-nums">{yards}</span>
            <button type="button" onClick={() => step(1)} disabled={yards >= 50} aria-label="More yards"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Total + CTA */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-dim">Total today</span>
          <span className="text-lg font-semibold tabular-nums">${(yards * PER_YARD).toLocaleString()}<span className="text-sm font-normal text-ink-dim">/mo</span></span>
        </div>
        <button onClick={subscribe} disabled={busy}
          className="h-12 w-full rounded-xl bg-bone text-[15px] font-semibold text-coal transition-colors hover:bg-bone-soft disabled:opacity-60">
          {busy ? "Opening checkout…" : `Subscribe — ${yards} yard${yards === 1 ? "" : "s"}`}
        </button>
        {err ? <p className="text-center text-sm text-amber-400">{err}</p> : null}
        <p className="text-center text-xs text-ink-faint">
          Billed monthly, per active yard. Cancel anytime — your data stays exportable.
        </p>
      </div>
    </div>
  );
}
