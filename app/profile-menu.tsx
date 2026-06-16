"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Signed-in account menu in the top nav: settings / billing / team / sign out. */
export default function ProfileMenu({ email, canManageTeam }: { email: string | null; canManageTeam: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = (email || "?").slice(0, 2).toUpperCase();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  async function signOut() {
    const supabase = getBrowserSupabase();
    try { await supabase?.auth.signOut(); } catch { /* ignore */ }
    window.location.href = "/";
  }

  return (
    <div className="profile-menu" ref={ref}>
      <button className="pm-avatar" onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open}>
        {initials}
      </button>
      {open ? (
        <div className="pm-dropdown" role="menu">
          <div className="pm-head"><span className="pm-email">{email ?? "Signed in"}</span></div>
          <a href="/dashboard" role="menuitem">Your apps</a>
          {canManageTeam ? <a href="/team" role="menuitem">Team &amp; seats</a> : null}
          <a href="/billing" role="menuitem">Billing</a>
          <a href="/account" role="menuitem">Account settings</a>
          <button className="pm-signout" onClick={signOut} role="menuitem">Sign out</button>
        </div>
      ) : null}
    </div>
  );
}
