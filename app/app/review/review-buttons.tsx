"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const REASONS = ["Wrong cert", "Can't read it", "Date doesn't match the paper", "Wrong hand or wrong gear"];
const primary = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-bone px-4 text-sm font-semibold text-coal hover:bg-bone-soft disabled:opacity-50";
const secondary = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-2 px-4 text-sm font-medium text-ink hover:bg-elevated disabled:opacity-50";

/**
 * Yes or no on one upload. Turning one down needs a reason the hand can act
 * on. Approving names the date it writes. When the date typed in isn't on
 * the photo, the manager picks a date read off the paper, or says they see
 * the typed one on it themselves.
 */
export default function ReviewButtons({ uploadId, goodTo, dateOnPaper = true, paperDates = [], inspected = null }: {
  uploadId: string;
  /** The date typed in, formatted. Null for retest paper (cert on the way). */
  goodTo?: string | null;
  /** False when the software couldn't find the typed date on the photo. */
  dateOnPaper?: boolean;
  /** Future dates read off the photo, other than the typed one. */
  paperDates?: { iso: string; label: string }[];
  /** A yearly inspection: the inspection day (a year before goodTo), formatted. That's what the paper shows. */
  inspected?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(action: "approve" | "reject", pick: { expiration?: string; typedOk?: boolean } = {}) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/saas/certs/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          upload_id: uploadId, action,
          note: action === "reject" ? [reason, note.trim()].filter(Boolean).join(". ") : "",
          ...(pick.expiration ? { expiration: pick.expiration } : {}),
          ...(pick.typedOk ? { typed_ok: true } : {}),
        }),
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

  const turnDown = (
    <button type="button" disabled={busy} onClick={() => setMode("reject")} className={secondary}>
      <X className="h-4 w-4" /> Turn it down
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {mode === "idle" ? (
        goodTo && !dateOnPaper ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm text-ink-dim">The software couldn&apos;t find their date on the photo. Approve with the date the paper shows.</span>
            <div className="flex flex-wrap gap-2">
              {paperDates.map((d) => (
                <button key={d.iso} type="button" disabled={busy} onClick={() => void send("approve", { expiration: d.iso })} className={primary}>
                  <Check className="h-4 w-4" /> {busy ? "Saving…" : `Use ${d.label} from the paper`}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => void send("approve", { typedOk: true })} className={secondary}>
                {busy ? "Saving…" : inspected ? `I see the inspection date ${inspected} on the paper. Good to ${goodTo}` : `I see ${goodTo} on the paper. Use it`}
              </button>
              {turnDown}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void send("approve")} className={primary}>
              <Check className="h-4 w-4" /> {busy ? "Saving…" : goodTo ? `Approve, good to ${goodTo}` : "Approve"}
            </button>
            {turnDown}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-dim">Why? It shows on the truck or piece page, so whoever sent it knows what to fix.</span>
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
