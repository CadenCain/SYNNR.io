"use client";

import "./login.css";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

function nextTarget() {
  if (typeof window === "undefined") return "/dashboard";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") ? n : "/dashboard";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; kind: "err" | "ok" } | null>(null);

  const supabase = getBrowserSupabase();

  const friendly = (m: string) =>
    /failed to fetch|network|load failed/i.test(m)
      ? "Couldn't reach SYNNR — check your connection and try again."
      : /invalid login credentials/i.test(m)
      ? "Wrong email or password."
      : /code (challenge|verifier)|otp_expired|expired|invalid|already/i.test(m)
      ? "That sign-in link couldn't be used — it was opened in a different browser, already clicked, or expired. Sign in with your password below, or request a new link."
      : m;

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err) setMsg({ t: friendly(err), kind: "err" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn() {
    setMsg(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setMsg({ t: "Enter a valid email.", kind: "err" }); return; }
    if (!password) { setMsg({ t: "Enter your password.", kind: "err" }); return; }
    if (!supabase) { setMsg({ t: "Sign-in isn't enabled yet — try again shortly.", kind: "err" }); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setBusy(false); setMsg({ t: friendly(error.message), kind: "err" }); return; }
      window.location.href = `/auth/ensure?next=${encodeURIComponent(nextTarget())}`;
    } catch (e) {
      setBusy(false);
      setMsg({ t: friendly(e instanceof Error ? e.message : "Something went wrong."), kind: "err" });
    }
  }

  async function forgot() {
    setMsg(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setMsg({ t: "Enter your email first, then tap reset.", kind: "err" }); return; }
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      setBusy(false);
      setMsg(error ? { t: friendly(error.message), kind: "err" } : { t: "Password reset email sent — follow the link to set a new password.", kind: "ok" });
    } catch (e) {
      setBusy(false);
      setMsg({ t: friendly(e instanceof Error ? e.message : "Something went wrong."), kind: "err" });
    }
  }

  async function magicLink() {
    setMsg(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setMsg({ t: "Enter your email first.", kind: "err" }); return; }
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget())}` },
      });
      setBusy(false);
      setMsg(error ? { t: friendly(error.message), kind: "err" } : { t: "Magic sign-in link sent — check your email.", kind: "ok" });
    } catch (e) {
      setBusy(false);
      setMsg({ t: friendly(e instanceof Error ? e.message : "Something went wrong."), kind: "err" });
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="brand"><span className="mk">{MARK}</span><b>SYNNR</b></div>
        <h1>Sign in to SYNNR</h1>
        <p className="sub">Welcome back. Sign in to your apps.</p>

        <label htmlFor="auth-email">Email</label>
        <input id="auth-email" type="email" autoComplete="email" placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="auth-pass">Password</label>
        <input id="auth-pass" type="password" autoComplete="current-password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && signIn()} />

        <button className="btn" onClick={signIn} disabled={busy}>
          {busy ? <span className="spin" /> : null}{busy ? "Signing in…" : "Sign in"}
        </button>

        {msg ? <div className={`msg ${msg.kind}`}>{msg.t}</div> : <div className="msg" />}

        <div className="alt">
          <button onClick={forgot}>Forgot password?</button>
          <span> · </span>
          <button onClick={magicLink}>Email me a link</button>
        </div>

        <div className="foot">
          New to SYNNR? <a href="/signup">Create an account</a><br />
          By continuing you agree to SYNNR&rsquo;s <a href="/legal/terms">Terms</a> and{" "}
          <a href="/legal/privacy">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
