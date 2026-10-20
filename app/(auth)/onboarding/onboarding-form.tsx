"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { clampYards, planLine, MAX_YARDS } from "@/lib/saas/plan";

const field = "h-12 w-full rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-[#1d4ed8]";
const HEARD = ["A call or text from Caden", "LinkedIn", "Collide", "Another shop", "Google", "Other"];

/** Step 2 of getting started: the shop, who to call, and how many yards. The price adds up as they go. */
export default function OnboardingForm({ action, defaults, error }: {
  action: (fd: FormData) => void;
  defaults: { contactName: string; email: string; ref: string };
  error?: string;
}) {
  const [yards, setYards] = useState(1);
  const [busy, setBusy] = useState(false);
  const step = (d: number) => setYards((y) => clampYards(y + d));
  return (
    <form action={action} onSubmit={() => setBusy(true)} className="flex flex-col gap-4">
      <input type="hidden" name="ref" value={defaults.ref} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Company name</span>
        <input name="name" required maxLength={120} autoFocus className={field} placeholder="Ace Coil Tubing" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Your name</span>
        <input name="contact_name" required maxLength={120} defaultValue={defaults.contactName} autoComplete="name" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Email for receipts</span>
        <input name="contact_email" type="email" required maxLength={200} defaultValue={defaults.email} autoComplete="email" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Cell phone</span>
        <input name="contact_phone" type="tel" required maxLength={40} autoComplete="tel" className={field} placeholder="(432) 555-0100" />
      </label>

      <div className="flex flex-col gap-2 rounded-xl border border-line-2 bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-ink">How many yards?</div>
            <div className="text-xs text-ink-faint">Each yard is $500 a month, whole crew included.</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} disabled={yards <= 1} aria-label="Fewer yards"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30"><Minus className="h-5 w-5" /></button>
            <input name="yards" value={yards} inputMode="numeric" aria-label="Yards"
              onChange={(e) => setYards(clampYards(e.target.value.replace(/\D/g, "") || 1))}
              className="h-12 w-14 rounded-lg border border-line-2 bg-coal text-center text-xl font-semibold tabular-nums text-ink outline-none focus:border-[#1d4ed8]" />
            <button type="button" onClick={() => step(1)} disabled={yards >= MAX_YARDS} aria-label="More yards"
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-line-2 text-ink hover:bg-elevated disabled:opacity-30"><Plus className="h-5 w-5" /></button>
          </div>
        </div>
        <p className="rounded-lg bg-elevated px-3 py-2.5 text-center text-base font-semibold tabular-nums text-ink" aria-live="polite">{planLine(yards)}</p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">How did you hear about RollReady? <span className="text-ink-faint">(optional)</span></span>
        <select name="heard_about" defaultValue="" className={field}>
          <option value="">Pick one</option>
          {HEARD.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Anything we should know? <span className="text-ink-faint">(optional)</span></span>
        <textarea name="notes" rows={3} maxLength={1000} className="w-full rounded-lg border border-line-2 bg-surface px-3 py-2 text-base text-ink outline-none focus:border-[#1d4ed8]"
          placeholder="Your testing company, how many trucks, anything that goes wrong at load-out" />
      </label>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-[#1d4ed8] text-base font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
        {busy ? "Saving…" : "Continue to payment"}
      </button>
      <p className="text-center text-xs text-ink-faint">Next you&apos;ll see the total and pay by card on Stripe&apos;s secure page. Cancel anytime.</p>
    </form>
  );
}
