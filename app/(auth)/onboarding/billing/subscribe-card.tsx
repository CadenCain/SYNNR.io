"use client";

import { useState } from "react";
import { Minus, Plus, Check } from "lucide-react";
import { clampYards, planLine, monthlyDollars, money, MAX_YARDS, PER_YARD_DOLLARS } from "@/lib/saas/plan";

/**
 * The last step before Stripe: the total, in plain math, with the yard count
 * still adjustable. Stripe's page charges exactly this.
 */
const INCLUDED = [
  "Load-out scans with a hard NOT READY on anything missing, out of test, or red-tagged",
  "Packages, truck kits, and a locked record with a proof link for every load-out",
  "Every yard on one screen, and every scan with a name on it",
  "Your whole crew, each with their own login. Never per-seat.",
];

export default function SubscribeCard({ initialYards, canPay }: { initialYards: number; canPay: boolean }) {
  const [yards, setYards] = useState(clampYards(initialYards));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function pay() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/saas/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity: yards }),
      });
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      setErr(d.error || "Something went wrong. Try again.");
    } catch {
      setErr("Couldn't reach billing. Check your signal and try again.");
    }
    setBusy(false);
  }
  const step = (d: number) => setYards((y) => clampYards(y + d));

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line bg-elevated/60 p-5">
        <div className="text-sm text-ink-dim">RollReady Yard</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight text-ink">{money(monthlyDollars(yards))}</span>
          <span className="text-sm text-ink-dim">a month</span>
        </div>
        <p className="mt-1 text-sm font-medium tabular-nums text-ink">{planLine(yards)}</p>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line-2 bg-coal p-4">
          <div>
            <div className="text-sm font-medium text-ink">Yards</div>
            <div className="text-xs text-ink-faint">{money(PER_YARD_DOLLARS)} each. Add or remove yards later from Settings.</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} disabled={yards <= 1} aria-label="Fewer yards"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30"><Minus className="h-5 w-5" /></button>
            <span className="w-8 text-center text-xl font-semibold tabular-nums">{yards}</span>
            <button type="button" onClick={() => step(1)} disabled={yards >= MAX_YARDS} aria-label="More yards"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30"><Plus className="h-5 w-5" /></button>
          </div>
        </div>

        <ul className="flex flex-col gap-2.5 text-sm text-ink-dim">
          {INCLUDED.map((f) => (
            <li key={f} className="flex items-start gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}</li>
          ))}
        </ul>

        {canPay ? (
          <button onClick={pay} disabled={busy}
            className="h-12 w-full rounded-lg bg-[#1d4ed8] text-base font-semibold text-white transition-colors hover:bg-[#1e40af] disabled:opacity-60">
            {busy ? "Opening Stripe…" : `Pay ${money(monthlyDollars(yards))}/month by card`}
          </button>
        ) : (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-300">Only the account owner can start the subscription. Ask them to log in and finish this step.</p>
        )}
        {err ? <p className="text-center text-sm text-amber-400">{err}</p> : null}
        <p className="text-center text-xs text-ink-faint">
          Charged today, then every month. No contract, cancel anytime, and your records stay yours to export.
        </p>
      </div>
    </div>
  );
}
