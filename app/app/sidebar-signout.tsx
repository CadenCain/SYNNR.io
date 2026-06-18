"use client";

import { getBrowserSupabase } from "@/lib/supabase/client";

/** Sidebar sign-out — clears the session and returns home. */
export default function SidebarSignout() {
  async function signOut() {
    try { await getBrowserSupabase()?.auth.signOut(); } catch { /* ignore */ }
    window.location.href = "/";
  }
  return (
    <button className="as-nav as-signout" onClick={signOut} type="button">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
      Sign out
    </button>
  );
}
