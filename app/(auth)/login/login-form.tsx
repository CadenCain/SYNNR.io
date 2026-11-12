"use client";

import { safeNext } from "@/lib/saas/safe-next";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Forgot password keeps where they were headed (an invite, a page) through the reset.
  const headed = (() => { const inv = params.get("invite"); const n = params.get("next") ?? (inv ? `/invite/${inv}` : ""); return safeNext(n); })();
  const forgotHref = headed ? `/forgot?next=${encodeURIComponent(headed)}` : "/forgot";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const sb = getBrowserSupabase();
    if (!sb) {
      setErr("Auth isn't configured.");
      return;
    }
    setBusy(true);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setErr(error.message.replace(/invalid login credentials/i, "Wrong email or password."));
      setBusy(false);
      return;
    }
    // The /app gate routes to /onboarding if they have no company yet.
    const nextPath = (() => { const inv = params.get("invite"); const n = params.get("next") ?? (inv ? `/invite/${inv}` : ""); return safeNext(n); })();
    router.replace(nextPath || "/app");
    router.refresh();
  }

  return (
    // method="post" matters before the page's script loads: without it a quick tap
    // (or a password manager) would send the form as a plain link, with the
    // email and password in the address bar and the browser's history.
    <form onSubmit={onSubmit} method="post" className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint"
          placeholder="you@shop.com"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint"
          placeholder="••••••••"
        />
      </label>
      {err ? <p role="alert" className="text-sm text-red-400">{err}</p> : null}
      <Button type="submit" disabled={busy} className="h-11 w-full md:h-11 md:text-sm">
        {busy ? "Logging in…" : "Log in"}
      </Button>
      <a href={forgotHref} className="inline-flex min-h-10 items-center justify-center text-[13px] text-ink-faint transition-colors hover:text-ink">Forgot password?</a>
    </form>
  );
}
