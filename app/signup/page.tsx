"use client";

import "../login/login.css";
import { useState } from "react";
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

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; kind: "err" | "ok" } | null>(null);

  const supabase = getBrowserSupabase();

  const friendly = (m: string) =>
    /failed to fetch|network|load failed/i.test(m)
      ? "Couldn't reach SYNNR — check your connection and try again."
      : /already registered|already exists/i.test(m)
      ? "An account with that email already exists — sign in instead."
      : m;

  async function signUp() {
    setMsg(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setMsg({ t: "Enter a valid email.", kind: "err" }); return; }
    if (password.length < 8) { setMsg({ t: "Use a password of at least 8 characters.", kind: "err" }); return; }
    if (!supabase) { setMsg({ t: "Sign-up isn't enabled yet — try again shortly.", kind: "err" }); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget())}` },
      });
      if (error) { setBusy(false); setMsg({ t: friendly(error.message), kind: "err" }); return; }
      // If email confirmation is off, we get a session immediately → go straight in.
      if (data.session) {
        window.location.href = `/auth/ensure?next=${encodeURIComponent(nextTarget())}`;
        return;
      }
      setBusy(false);
      setMsg({ t: "Account created — check your email to confirm, then sign in.", kind: "ok" });
    } catch (e) {
      setBusy(false);
      setMsg({ t: friendly(e instanceof Error ? e.message : "Something went wrong."), kind: "err" });
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="brand"><span className="mk">{MARK}</span><b>SYNNR</b></div>
        <h1>Create your account</h1>
        <p className="sub">One account for every SYNNR app. Start a free trial in minutes.</p>

        <label htmlFor="su-email">Email</label>
        <input id="su-email" type="email" autoComplete="email" placeholder="you@company.com"
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <label htmlFor="su-pass">Password</label>
        <input id="su-pass" type="password" autoComplete="new-password" placeholder="At least 8 characters"
          value={password} onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && signUp()} />

        <button className="btn" onClick={signUp} disabled={busy}>
          {busy ? <span className="spin" /> : null}{busy ? "Creating…" : "Create account"}
        </button>

        {msg ? <div className={`msg ${msg.kind}`}>{msg.t}</div> : <div className="msg" />}

        <div className="foot">
          Already have an account? <a href="/login">Sign in</a><br />
          By creating an account you agree to SYNNR&rsquo;s <a href="/legal/terms">Terms</a> and{" "}
          <a href="/legal/privacy">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
