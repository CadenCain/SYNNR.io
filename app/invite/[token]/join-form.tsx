"use client";

import { useState } from "react";

const field = "h-12 w-full rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-[#1d4ed8]";

/** One form on the phone: your name, email, a password, and you're on the crew. */
export default function JoinForm({ action, token, error }: { action: (fd: FormData) => void; token: string; error?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <form action={action} onSubmit={() => setBusy(true)} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Your name</span>
        <input name="full_name" required maxLength={120} autoComplete="name" className={field} placeholder="First and last" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" className={field} placeholder="you@email.com" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} placeholder="At least 8 characters" />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-[#1d4ed8] text-base font-semibold text-white hover:bg-[#1e40af] disabled:opacity-60">
        {busy ? "Joining…" : "Join the crew"}
      </button>
      <p className="text-xs text-ink-faint">Your name goes on every scan you make. By joining you agree to the <a href="/legal/terms" className="underline">Terms</a> and <a href="/legal/privacy" className="underline">Privacy Policy</a>.</p>
    </form>
  );
}
