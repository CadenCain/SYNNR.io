"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Inline account actions: change password (already authed → direct update) + sign out. */
export default function AccountClient({ isOwner = false }: { isOwner?: boolean }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; kind: "ok" | "err" } | null>(null);
  const [showDanger, setShowDanger] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  async function deleteWorkspace() {
    setDelErr("");
    if (confirmText.trim().toUpperCase() !== "DELETE") { setDelErr("Type DELETE to confirm."); return; }
    setDelBusy(true);
    try {
      const r = await fetch("/api/account/delete-workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: confirmText }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setDelErr(d.error || "Couldn't delete the workspace."); setDelBusy(false); return; }
      const supabase = getBrowserSupabase();
      try { await supabase?.auth.signOut(); } catch { /* ignore */ }
      window.location.href = "/?deleted=1";
    } catch {
      setDelErr("Couldn't reach the server — try again.");
      setDelBusy(false);
    }
  }

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

      {isOwner ? (
        <div className="acct-danger">
          {!showDanger ? (
            <button className="acct-danger-toggle" onClick={() => setShowDanger(true)}>Delete workspace…</button>
          ) : (
            <div className="acct-danger-open">
              <b>Delete this workspace</b>
              <p>
                Permanently erases every saved tally, usage record, seat, and invite for your whole
                team, and cancels your subscription. This can&apos;t be undone.
              </p>
              <div className="acct-row">
                <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                  placeholder='Type DELETE to confirm' aria-label="Type DELETE to confirm" />
                <button className="btn btn-sm acct-delete-btn" onClick={deleteWorkspace} disabled={delBusy}>
                  {delBusy ? "Deleting…" : "Delete forever"}
                </button>
              </div>
              {delErr ? <p className="wl-err">{delErr}</p> : null}
              <button className="acct-danger-cancel" onClick={() => { setShowDanger(false); setConfirmText(""); setDelErr(""); }}>Cancel</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
