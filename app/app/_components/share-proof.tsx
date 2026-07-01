"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { createReadinessProof } from "../_proof-actions";

/** One click → public proof link on the clipboard. */
export default function ShareProof({
  scope,
  yardId,
  unitId,
}: {
  scope: "company" | "yard" | "unit";
  yardId?: string;
  unitId?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "made">("idle");
  const [url, setUrl] = useState("");

  async function go() {
    setState("busy");
    const res = await createReadinessProof({ scope, yardId, unitId });
    if (!res.ok || !res.url) { setState("idle"); return; }
    setUrl(res.url);
    try {
      await navigator.clipboard.writeText(res.url);
      setState("copied");
    } catch {
      setState("made"); // clipboard blocked — show the link instead
    }
    setTimeout(() => setState("idle"), 4000);
  }

  return (
    <div className="flex items-center gap-2">
      {state === "made" && url ? (
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          className="h-9 w-56 rounded-lg border border-line-2 bg-coal px-2 text-xs text-ink-dim outline-none" />
      ) : null}
      <button onClick={go} disabled={state === "busy"}
        className="flex h-9 items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink disabled:opacity-50">
        {state === "copied" ? <><Check className="h-4 w-4 text-emerald-400" /> Link copied</> : <><Share2 className="h-4 w-4" /> {state === "busy" ? "Creating…" : "Share readiness proof"}</>}
      </button>
    </div>
  );
}
