"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const REASONS = ["Wrong cert", "Can't read it", "Date doesn't match the paper", "Wrong hand or wrong gear"];
const primary = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-bone px-4 text-sm font-semibold text-coal hover:bg-bone-soft disabled:opacity-50";
const secondary = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-2 px-4 text-sm font-medium text-ink hover:bg-elevated disabled:opacity-50";

/** Yes or no on one upload. Turning one down needs a reason the hand can act on. */
export default function ReviewButtons({ uploadId }: { uploadId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(action: "approve" | "reject") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/saas/certs/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId, action, note: action === "reject" ? [reason, note.trim()].filter(Boolean).join(". ") : "" }),
      });
      const r = (await res.json()) as { ok: boolean; message: string };
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    } catch {
      setMsg({ ok: false, text: "That didn't go through. Check your signal and try again." });
    } finally {
      setBusy(false);
    }
  }

  if (msg?.ok) return <p className="text-sm font-medium text-emerald-400">{msg.text}</p>;

  return (
    <div className="flex flex-col gap-3">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void send("approve")} className={primary}>
            <Check className="h-4 w-4" /> {busy ? "Saving…" : "Approve"}
          </button>
          <button type="button" disabled={busy} onClick={() => setMode("reject")} className={secondary}>
            <X className="h-4 w-4" /> Turn it down
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-dim">Why? The hand sees this in the feed.</span>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={cn("min-h-10 cursor-pointer rounded-lg border px-3 text-sm", reason === r ? "border-bone/60 bg-bone/10 text-bone" : "border-line-2 text-ink-dim hover:text-ink")}>
                {r}
              </button>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else (optional)" maxLength={200}
            className="h-11 w-full rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy || (!reason && !note.trim())} onClick={() => void send("reject")} className={primary}>
              {busy ? "Saving…" : "Turn it down"}
            </button>
            <button type="button" onClick={() => setMode("idle")} className={secondary}>Back</button>
          </div>
        </div>
      )}
      {msg && !msg.ok ? <p className="text-sm text-red-400">{msg.text}</p> : null}
    </div>
  );
}
