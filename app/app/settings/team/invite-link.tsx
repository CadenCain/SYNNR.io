"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

/**
 * A crew invite link, ready to send. On a phone, "Send it" opens the share
 * sheet (Messages, WhatsApp, email). The hand taps the link, makes a login in
 * one form, and lands on the trucks.
 */
export default function InviteLink({ url, company }: { url: string; company?: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const text = `Join ${company ?? "our crew"} on RollReady. Tap the link and make your login: ${url}`;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input readOnly value={url} aria-label="Invite link"
        className="h-11 w-full min-w-0 flex-1 rounded-lg border border-line-2 bg-coal px-3 text-xs text-ink-dim outline-none" />
      <div className="flex gap-2">
        {canShare ? (
          <button type="button" onClick={() => { navigator.share({ text }).catch(() => {}); }}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1d4ed8] px-4 text-sm font-semibold text-white hover:bg-[#1e40af] sm:flex-none">
            <Share2 className="h-4 w-4" /> Send it
          </button>
        ) : null}
        <button type="button"
          onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ } }}
          className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line-2 px-4 text-sm text-ink hover:bg-elevated sm:flex-none">
          {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
        </button>
      </div>
    </div>
  );
}
