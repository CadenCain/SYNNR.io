"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { requestReset } from "./actions";

export default function ForgotForm({ next = "" }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setBusy(true);
    try {
      await requestReset(email, next);
      setSent(email);
    } catch {
      setErr("Couldn't send it. Check your signal and try again.");
    }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 text-sm text-ink-dim">
        <p>If <span className="font-medium text-ink">{sent}</span> has a SYNNR login, a reset link is on its way. Open it on any phone or computer.</p>
        <p>Nothing after a few minutes? Check spam, or ask your manager to send one from Settings, Team.</p>
        <button type="button" onClick={() => setSent("")} className="flex min-h-10 items-center self-start text-sm font-medium text-ink underline underline-offset-4">Try a different email</button>
      </div>
    );
  }

  return (
    // method="post" matters before the page's script loads: without it a quick tap
    // (or a password manager) would send the form as a plain link, with the
    // email and password in the address bar and the browser's history.
    <form onSubmit={onSubmit} method="post" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" autoCapitalize="none"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint"
          placeholder="you@email.com" />
      </label>
      {err ? <p role="alert" className="text-sm text-red-400">{err}</p> : null}
      <Button type="submit" disabled={busy} className="h-11 w-full md:h-11 md:text-sm">{busy ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}
