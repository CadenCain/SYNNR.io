"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

/** A load-out's proof link, always on screen, with copy and share. */
export default function ProofLink({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setErr(""); }
    catch { setErr("Couldn't copy. Press and hold the link to copy it."); }
  }
  async function share() {
    try { await navigator.share({ title, url }); }
    catch { /* closed the share sheet */ }
  }
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="flex flex-col gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="break-all rounded-lg border border-line-2 bg-coal px-3 py-2.5 text-sm text-ink hover:border-bone">{url}</a>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClass("outline", "lg")}>
          {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />} {copied ? "Copied" : "Copy link"}
        </button>
        {canShare ? (
          <button type="button" onClick={share} className={buttonClass("outline", "lg")}><Share2 className="h-5 w-5" /> Send it</button>
        ) : null}
      </div>
      {err ? <p className="text-sm text-amber-400">{err}</p> : null}
    </div>
  );
}
