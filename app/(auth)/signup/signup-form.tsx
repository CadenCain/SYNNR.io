"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const cookieRef = typeof document !== "undefined"
    ? (document.cookie.match(/(?:^|; )synnr_ref=([^;]*)/)?.[1] ?? "")
    : "";
  const ref = (params.get("ref") || decodeURIComponent(cookieRef) || "").slice(0, 60); // referral source, e.g. ?ref=cody
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const fullName = String(fd.get("fullName") ?? "").trim();

    setBusy(true);
    // 1) Create the (pre-confirmed) user server-side — works without email delivery.
    const res = await fetch("/api/saas/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, fullName }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong." }));
    if (!res.ok || !data.ok) {
      setErr(data.error || "Couldn't create your account.");
      setBusy(false);
      return;
    }
    // 2) Sign in with the same password to establish the session.
    const sb = getBrowserSupabase();
    if (!sb) {
      setErr("Auth isn't configured.");
      setBusy(false);
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setErr("Account created — please log in.");
      setBusy(false);
      router.replace("/login");
      return;
    }
    // An INVITED user carries ?next=/invite/<token> — sending them to
    // onboarding would have them create their own separate company instead
    // of joining the one that invited them. That exact bug shipped once.
    const nextPath = (() => { const n = params.get("next") ?? ""; return n.startsWith("/") && !n.startsWith("//") ? n : ""; })();
    router.replace(nextPath || (ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : "/onboarding"));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Your name</span>
        <input
          name="fullName"
          type="text"
          autoComplete="name"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]"
          placeholder="John Smith"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]"
          placeholder="you@shop.com"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]"
          placeholder="At least 8 characters"
        />
      </label>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <p className="text-xs text-ink-faint">
        By creating an account you agree to the{" "}
        <a href="/legal/terms" className="underline hover:text-ink" target="_blank">Terms of Service</a> and{" "}
        <a href="/legal/privacy" className="underline hover:text-ink" target="_blank">Privacy Policy</a>.
      </p>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-xs text-ink-dim">Card required at the next step · billed monthly · cancel anytime.</p>
    </form>
  );
}
