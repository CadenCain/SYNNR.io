"use client";

import { useState, type FormEvent } from "react";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

const field = "h-12 w-full rounded-lg border border-line-2 bg-coal px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint";

/** Ask for access: a name, a company, and a number to call. Nothing else is needed. */
export default function AccessForm() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy"); setErr("");
    try {
      const r = await fetch("/api/access", { method: "POST", body: new FormData(e.currentTarget) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) { setState("done"); return; }
      setErr(d.error || "That didn't send. Try again.");
    } catch {
      setErr("That didn't send. Check your signal and try again.");
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div role="status" className="rounded-xl border border-line-2 bg-surface px-6 py-8">
        <p className="text-[17px] font-medium text-ink">Got it.</p>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-dim">Caden will call you. If you&apos;d rather not wait, call or text <a href={OWNER_PHONE_TEL} className="text-ink underline underline-offset-4">{OWNER_PHONE}</a>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">Your name
          <input name="name" required maxLength={120} autoComplete="name" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">Company
          <input name="company" required maxLength={160} autoComplete="organization" className={field} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">Cell
          <input name="phone" type="tel" required maxLength={40} autoComplete="tel" inputMode="tel" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">What you run <span className="sr-only">(optional)</span>
          <input name="runs" maxLength={200} placeholder="Wireline, 6 trucks" className={field} />
        </label>
      </div>
      {/* People never see this one. Only a bot fills it in. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {err ? <p role="alert" className="text-[14px] text-red-400">{err}</p> : null}
      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={state === "busy"}
          className="h-12 rounded-lg bg-ink px-6 text-[15px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60">
          {state === "busy" ? "Sending…" : "Request access"}
        </button>
        <span className="text-[13px] text-ink-faint">No card. Caden calls you back himself.</span>
      </div>
    </form>
  );
}
