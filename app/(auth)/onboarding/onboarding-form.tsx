"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampYards, planLine, MAX_YARDS } from "@/lib/saas/plan";

const field = "h-12 w-full rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-[#1d4ed8]";

/** Getting started, step 2: the company and its yards. The price adds up as they go, then it's straight to Stripe. */
export default function OnboardingForm({ action, defaults, error }: {
  action: (fd: FormData) => void;
  defaults: { companyName: string; phone: string; yards: number; firstYard: string; ref: string };
  error?: string;
}) {
  const [yards, setYards] = useState(clampYards(defaults.yards));
  const [busy, setBusy] = useState(false);
  const step = (d: number) => setYards((y) => clampYards(y + d));
  return (
    <form action={action} onSubmit={() => setBusy(true)} className="flex flex-col gap-4">
      <input type="hidden" name="ref" value={defaults.ref} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Company name</span>
        <input name="name" required maxLength={120} autoFocus defaultValue={defaults.companyName} autoComplete="organization" className={field} placeholder="Ace Coil Tubing" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Phone</span>
        <input name="contact_phone" type="tel" required maxLength={40} defaultValue={defaults.phone} autoComplete="tel" className={field} placeholder="(432) 555-0100" />
      </label>

      <div className="flex flex-col gap-3 rounded-xl border border-line-2 bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-ink">Number of yards</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} disabled={yards <= 1} aria-label="Fewer yards"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30"><Minus className="h-5 w-5" /></button>
            <input name="yards" value={yards} inputMode="numeric" aria-label="Number of yards" required
              onChange={(e) => setYards(clampYards(e.target.value.replace(/\D/g, "") || 1))}
              className="h-12 w-14 rounded-lg border border-line-2 bg-coal text-center text-xl font-semibold tabular-nums text-ink outline-none focus:border-[#1d4ed8]" />
            <button type="button" onClick={() => step(1)} disabled={yards >= MAX_YARDS} aria-label="More yards"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30"><Plus className="h-5 w-5" /></button>
          </div>
        </div>
        <p className="rounded-lg bg-elevated px-3 py-2.5 text-center text-base font-semibold tabular-nums text-ink" aria-live="polite">
          {planLine(yards)}. Cancel anytime.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Primary yard name or city <span className="text-ink-faint">(optional)</span></span>
        <input name="first_yard" maxLength={80} defaultValue={defaults.firstYard} className={field} placeholder="Odessa Yard" />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-[#1d4ed8] text-base font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
        {busy ? "Opening secure checkout…" : "Continue to payment"}
      </button>
      <p className="text-center text-xs text-ink-faint">You&apos;ll pay by card on Stripe&apos;s secure page, then you&apos;re in, with your yards already set up.</p>
    </form>
  );
}
