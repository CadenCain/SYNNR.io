"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Inline account actions: change password (already authed → direct update) + sign out. */
export default function AccountClient() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; kind: "ok" | "err" } | null>(null);

  async function changePassword() {
    setMsg(null);
    if (password.length < 8) { setMsg({ t: "Use at least 8 characters.", kind: "err" }); return; }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (error) { setMsg({ t: error.message, kind: "err" }); return; }
      setPassword("");
      setMsg({ t: "Password updated.", kind: "ok" });
    } catch (e) {
      setBusy(false);
      setMsg({ t: e instanceof Error ? e.message : "Something went wrong.", kind: "err" });
    }
  }

  async function signOut() {
    const supabase = getBrowserSupabase();
    try { await supabase?.auth.signOut(); } catch { /* ignore */ }
    window.location.href = "/";
  }

  return (
    <div className="acct-actions">
      <div className="acct-block">
        <label htmlFor="acct-pass">Change password</label>
        <div className="acct-row">
          <input id="acct-pass" type="password" autoComplete="new-password" placeholder="New password (8+ chars)"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={changePassword} disabled={busy}>{busy ? "Saving…" : "Update"}</button>
        </div>
        {msg ? <p className={msg.kind === "ok" ? "wl-done" : "wl-err"}>{msg.t}</p> : null}
      </div>
      <button className="btn btn-ghost btn-sm acct-signout" onClick={signOut}>Sign out</button>
    </div>
  );
}
