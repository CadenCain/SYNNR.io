"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetForm({ next = "" }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) { setErr("At least 8 characters."); return; }
    const sb = getBrowserSupabase();
    if (!sb) { setErr("Auth isn't configured."); return; }
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setErr(/session/i.test(error.message) ? "That reset link ran out. Send yourself a new one from Forgot password."
        : /different from the old/i.test(error.message) ? "Pick a password you haven't used here before." : error.message);
      setBusy(false);
      return;
    }
    router.replace(next || "/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">New password</span>
        <input name="password" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password"
          className="h-12 rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-bone"
          placeholder="At least 8 characters" />
      </label>
      <label className="-mt-2 flex items-center gap-2 text-sm text-ink-dim">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5 accent-bone" /> Show password
      </label>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <Button type="submit" disabled={busy} className="h-12 w-full text-base">{busy ? "Saving…" : "Set password and go to the trucks"}</Button>
    </form>
  );
}
