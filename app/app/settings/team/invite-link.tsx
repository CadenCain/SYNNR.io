"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url}
        className="h-9 flex-1 rounded-lg border border-line-2 bg-coal px-3 text-xs text-ink-dim outline-none" />
      <button
        onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] text-ink hover:bg-elevated"
      >
        {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy</>}
      </button>
    </div>
  );
}
