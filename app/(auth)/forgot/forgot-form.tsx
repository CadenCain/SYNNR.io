"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const sb = getBrowserSupabase();
    if (!sb) { setErr("Auth isn't configured."); return; }
    setBusy(true);
    const origin = window.location.origin;
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset`,
    });
    setBusy(false);
    // Don't reveal whether the email exists.
    setSent(true);
    if (error) console.error(error.message);
  }

  if (sent) {
    return (
      <p className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-dim">
        If that email has an account, a reset link is on its way. Open it on this device to set a new password.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Email</span>
        <input name="email" type="email" required autoComplete="email"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]"
          placeholder="you@shop.com" />
      </label>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}
