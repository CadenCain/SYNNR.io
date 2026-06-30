"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ResetForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

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
      setErr(error.message.includes("session") ? "Reset link expired — request a new one." : error.message);
      setBusy(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-ink">New password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password"
          className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]"
          placeholder="At least 8 characters" />
      </label>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Set password"}</Button>
    </form>
  );
}
