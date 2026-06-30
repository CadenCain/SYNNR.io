"use client";

import "../../login/login.css";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

/**
 * Set-a-new-password screen. Reached from the password-reset email, which lands
 * here with a recovery session already established (via /auth/callback). The
 * user sets a new password (updateUser) and is signed in.
 */
export default function ResetPage() {
  const supabase = getBrowserSupabase();
  const [ready, setReady] = useState<"checking" | "ok" | "nosession">("checking");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; kind: "err" | "ok" } | null>(null);

  useEffect(() => {
    if (!supabase) { setReady("nosession"); return; }
    supabase.auth.getUser().then(({ data }) => setReady(data.user ? "ok" : "nosession"));
  }, [supabase]);

  async function save() {
    setMsg(null);
    if (password.length < 8) { setMsg({ t: "Use at least 8 characters.", kind: "err" }); return; }
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setBusy(false); setMsg({ t: error.message, kind: "err" }); return; }
      setMsg({ t: "Password updated — taking you in…", kind: "ok" });
      window.location.href = "/auth/ensure?next=/dashboard";
    } catch (e) {
      setBusy(false);
      setMsg({ t: e instanceof Error ? e.message : "Something went wrong.", kind: "err" });
    }
  }

  return (
    <div className="auth">
      <div className="card">
        <div className="brand"><span className="mk">{MARK}</span><b>SYNNR</b></div>

        {ready === "checking" ? (
          <>
            <h1>One sec…</h1>
            <p className="sub">Checking your reset link.</p>
          </>
        ) : ready === "nosession" ? (
          <>
            <h1>Reset link expired</h1>
            <p className="sub">This password-reset link is invalid, already used, or was opened in a different browser. Request a fresh one.</p>
            <a className="btn" href="/login">Back to sign in</a>
          </>
        ) : (
          <>
            <h1>Set a new password</h1>
            <p className="sub">Pick a new password for your SYNNR account.</p>
            <label htmlFor="np">New password</label>
            <input id="np" type="password" autoComplete="new-password" placeholder="At least 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()} />
            <button className="btn" onClick={save} disabled={busy}>
              {busy ? <span className="spin" /> : null}{busy ? "Saving…" : "Update password"}
            </button>
          </>
        )}

        {msg ? <div className={`msg ${msg.kind}`}>{msg.t}</div> : <div className="msg" />}
      </div>
    </div>
  );
}
