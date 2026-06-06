"use client";

import "./login.css";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

function nextTarget() {
  if (typeof window === "undefined") return "/onboarding";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") ? n : "/onboarding";
}

export default function LoginPage() {
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; kind: "err" | "ok" } | null>(null);

  const supabase = getBrowserSupabase();

  async function sendCode() {
    setMsg(null);
    if (!/\S+@\S+\.\S+/.test(email)) {
      setMsg({ t: "Enter a valid work email.", kind: "err" });
      return;
    }
    if (!supabase) {
      setMsg({ t: "Auth isn't configured yet (missing Supabase env).", kind: "err" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setMsg({ t: error.message, kind: "err" });
      return;
    }
    setStage("code");
    setMsg({ t: "We emailed you a 6-digit code. Enter it below.", kind: "ok" });
  }

  async function verify() {
    setMsg(null);
    if (!supabase) return;
    if (code.replace(/\D/g, "").length < 6) {
      setMsg({ t: "Enter the 6-digit code.", kind: "err" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ""),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setMsg({ t: error.message, kind: "err" });
      return;
    }
    window.location.href = nextTarget();
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="brand"><span className="mk">{MARK}</span><b>SYNNR</b></div>

        {stage === "email" ? (
          <>
            <h1>Sign in to SYNNR</h1>
            <p className="sub">Use your work email — we&rsquo;ll send a one-time code. No password to remember.</p>
            <label htmlFor="auth-email">Work email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="ray@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendCode()}
            />
            <button className="btn" onClick={sendCode} disabled={busy}>
              {busy ? <span className="spin" /> : null}
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <h1>Check your email</h1>
            <p className="sub">Enter the 6-digit code we sent to <b>{email}</b>.</p>
            <label htmlFor="auth-code">Verification code</label>
            <input
              id="auth-code"
              className="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
            />
            <button className="btn" onClick={verify} disabled={busy}>
              {busy ? <span className="spin" /> : null}
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <div className="alt">
              <button onClick={() => { setStage("email"); setCode(""); setMsg(null); }}>
                Use a different email
              </button>
            </div>
          </>
        )}

        {msg ? <div className={`msg ${msg.kind}`}>{msg.t}</div> : <div className="msg" />}

        <div className="foot">
          By continuing you agree to SYNNR&rsquo;s <a href="/legal/terms">Terms</a> and{" "}
          <a href="/legal/privacy">Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}
