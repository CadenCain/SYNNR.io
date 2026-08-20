"use client";

import { useState } from "react";
import { Link2, Copy, Check, MessageSquare } from "lucide-react";
import { createDocRequest } from "../doc-actions";

/**
 * "Send secure update link" — generates the tokened URL for this hand and
 * hands it to the manager two ways: copy, or a prefilled text message (sms:
 * opens the manager's own Messages app, so this works today with zero Twilio).
 */
export default function SendUpdateLink({ crewMemberId, crewName, crewPhone }: { crewMemberId: string; crewName: string; crewPhone: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true); setError(null);
    const res = await createDocRequest({ crewMemberId });
    setBusy(false);
    if (res.ok && res.url) setUrl(res.url);
    else setError(res.error ?? "couldn't create the link");
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const smsBody = url
    ? encodeURIComponent(`Hey ${crewName.split(" ")[0]} — your card's coming due. Snap a photo of the new one here (30 seconds): ${url}`)
    : "";

  if (!url) {
    return (
      <div className="flex flex-col gap-1.5">
        <button onClick={generate} disabled={busy}
          className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-2 px-4 text-sm font-medium text-ink hover:bg-elevated disabled:opacity-50">
          <Link2 className="h-4 w-4" /> {busy ? "Creating link…" : "Send secure update link"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line-2 bg-elevated p-3">
      <p className="text-xs text-ink-dim">
        Link for {crewName} — good for 7 days. They take a photo of the new card; it lands back here for review.
      </p>
      <code className="block truncate rounded-md border border-line bg-coal px-2.5 py-2 text-xs text-ink-dim">{url}</code>
      <div className="flex gap-2">
        <button onClick={copy}
          className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line-2 px-3 text-[13px] font-medium text-ink hover:bg-coal">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
        </button>
        {crewPhone && (
          <a href={`sms:${crewPhone}?&body=${smsBody}`}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-bone px-3 text-[13px] font-semibold text-coal hover:bg-bone-soft">
            <MessageSquare className="h-3.5 w-3.5" /> Text it to {crewName.split(" ")[0]}
          </a>
        )}
      </div>
    </div>
  );
}
