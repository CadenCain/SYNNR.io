"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Nfc, Check, Copy, Lock } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Put a piece's tag link on an NFC tag, so tapping a phone to the iron opens
 * the same page the QR code does. NFC tags outlast printed stickers: they
 * survive mud, paint, and blasting, and can be epoxied into the iron.
 *
 * Writing from a web page works in Chrome on Android (Web NFC). iPhones and
 * computers can't write from a page, so they get the link and steps for a
 * free app instead. Every phone can READ the tag; that part needs nothing.
 *
 * Nothing here touches the server: the tag just holds the link.
 */

// Web NFC isn't in TypeScript's DOM types yet.
interface NdefWriter {
  write(message: { records: { recordType: string; data: string }[] }, options?: { signal?: AbortSignal; overwrite?: boolean }): Promise<void>;
  makeReadOnly(options?: { signal?: AbortSignal }): Promise<void>;
}
type NdefCtor = new () => NdefWriter;
const ndefCtor = (): NdefCtor | null =>
  typeof window !== "undefined" && "NDEFReader" in window ? (window as unknown as { NDEFReader: NdefCtor }).NDEFReader : null;

const noSubscribe = () => () => {};
/** True only in a browser that can write tags (Chrome on Android). Null on the server, which can't know what phone this is. */
export function useCanWriteNfc(): boolean | null {
  return useSyncExternalStore(noSubscribe, () => ndefCtor() !== null, () => null);
}

function plainError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "The phone said no to NFC. Allow it for this site in Chrome's settings, then try again.";
  if (name === "NotSupportedError") return "This phone's NFC is off or missing. Turn NFC on in the phone's settings.";
  if (name === "NetworkError") return "The tag moved away before it finished. Hold it still against the back of the phone and try again.";
  if (name === "AbortError") return "Stopped.";
  if (name === "InvalidStateError") return "That tag is locked and can't be changed. Use a new tag.";
  return "That didn't work. Try again, or use a different tag.";
}

type Phase = "idle" | "waiting" | "written" | "locking" | "locked" | "error";

/** One Write button for one piece. `compact` is the small version for the tag sheet. */
export function NfcWriteButton({ url, compact = false }: { url: string; compact?: boolean }) {
  const can = useCanWriteNfc();
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [confirmLock, setConfirmLock] = useState(false);
  const abort = useRef<AbortController | null>(null);

  if (!can) return null;

  async function write() {
    const Ctor = ndefCtor();
    if (!Ctor) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setErr(""); setConfirmLock(false); setPhase("waiting");
    try {
      await new Ctor().write({ records: [{ recordType: "url", data: url }] }, { signal: ac.signal, overwrite: true });
      setPhase("written");
    } catch (e) {
      setErr(plainError(e)); setPhase(e instanceof DOMException && e.name === "AbortError" ? "idle" : "error");
    }
  }

  async function lock() {
    const Ctor = ndefCtor();
    if (!Ctor) return;
    const ac = new AbortController();
    abort.current = ac;
    setErr(""); setPhase("locking");
    try {
      await new Ctor().makeReadOnly({ signal: ac.signal });
      setPhase("locked");
    } catch (e) {
      setErr(plainError(e)); setPhase("written");
    }
  }

  const cancel = () => { abort.current?.abort(); setPhase("idle"); };

  if (compact) {
    return (
      <span className="no-print inline-flex flex-col gap-1">
        {phase === "waiting" ? (
          <button type="button" onClick={cancel} className="inline-flex items-center gap-1 text-[12px] font-medium text-bone">
            <Nfc className="h-3.5 w-3.5 animate-pulse" /> Hold the tag to your phone… (cancel)
          </button>
        ) : phase === "written" || phase === "locked" ? (
          <button type="button" onClick={write} className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-400">
            <Check className="h-3.5 w-3.5" /> NFC tag written
          </button>
        ) : (
          <button type="button" onClick={write} className="inline-flex items-center gap-1 text-[12px] font-medium text-bone hover:underline">
            <Nfc className="h-3.5 w-3.5" /> Write NFC tag
          </button>
        )}
        {phase === "error" ? <span className="text-[11px] text-red-400">{err}</span> : null}
      </span>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-2 text-center">
      {phase === "idle" || phase === "error" ? (
        <button type="button" onClick={write} className={buttonClass("outline", "sm")}>
          <Nfc className="h-4 w-4" /> Write NFC tag
        </button>
      ) : phase === "waiting" ? (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-bone"><Nfc className="h-4 w-4 animate-pulse" /> Hold the tag to the back of your phone</span>
          <button type="button" onClick={cancel} className="text-xs text-ink-faint underline underline-offset-2">Cancel</button>
        </div>
      ) : phase === "locking" ? (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-bone"><Lock className="h-4 w-4 animate-pulse" /> Hold the same tag to lock it</span>
          <button type="button" onClick={cancel} className="text-xs text-ink-faint underline underline-offset-2">Cancel</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400">
            <Check className="h-4 w-4" /> {phase === "locked" ? "Written and locked" : "Written. Tap the tag with your phone to test it."}
          </span>
          {phase === "written" && !confirmLock ? (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
              <button type="button" onClick={() => setConfirmLock(true)} className="text-ink-dim underline underline-offset-2">Lock it so nobody can change it</button>
              <button type="button" onClick={write} className="text-ink-dim underline underline-offset-2">Write another</button>
            </div>
          ) : null}
          {phase === "written" && confirmLock ? (
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
              <span>Locking is for good. The tag can never be rewritten, even by you. Only lock it once you&apos;ve tested it.</span>
              <span className="flex gap-3">
                <button type="button" onClick={lock} className="font-semibold underline underline-offset-2">Lock it</button>
                <button type="button" onClick={() => setConfirmLock(false)} className="underline underline-offset-2">Not yet</button>
              </span>
            </div>
          ) : null}
        </div>
      )}
      {err && phase !== "waiting" ? <p className="text-xs text-red-400">{err}</p> : null}
    </div>
  );
}

/** On the tag sheet, where writing works: how to do a stack of tags. */
export function NfcSheetHint() {
  const can = useCanWriteNfc();
  if (!can) return null;
  return (
    <p className="no-print rounded-lg border border-bone/30 bg-bone/5 px-3 py-2 text-sm text-ink-dim">
      <Nfc className="mr-1.5 inline h-4 w-4 text-bone" />
      Writing NFC tags: tap <b>Write NFC tag</b> on a piece, hold that piece&apos;s tag to the back of your phone, then do the next one.
      Use on-metal tags; a regular sticker won&apos;t read on steel.
    </p>
  );
}

/**
 * For phones and computers that can't write from a page: the link to put on
 * the tag, a copy button, and the steps. Hidden where the Write button works.
 */
export function NfcHowTo({ url, className }: { url?: string; className?: string }) {
  const can = useCanWriteNfc();
  const [copied, setCopied] = useState(false);
  if (can !== false) return null;
  async function copy() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* shown below */ }
  }
  return (
    <details className={cn("no-print w-full rounded-lg border border-line bg-coal/60 px-3 py-2 text-left text-xs text-ink-dim", className)}>
      <summary className="cursor-pointer font-medium text-ink">Using NFC tags instead?</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p>Any phone can read an NFC tag: just hold it to the tag. To write one:</p>
        <ul className="flex list-disc flex-col gap-1 pl-4">
          <li><b>Android:</b> open this page in Chrome and a Write NFC tag button shows up.</li>
          <li><b>iPhone:</b> in the free NFC Tools app, tap Write, Add a record, URL, paste the link{url ? " below" : " from the piece's page"}, then Write and hold the tag.</li>
        </ul>
        <p>Use on-metal NFC tags (NTAG213 or 215, sold as &quot;anti-metal&quot;). A regular sticker won&apos;t read on steel.</p>
        {url ? (
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-line bg-surface px-2 py-1 text-[11px] text-ink">{url}</code>
            <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded border border-line-2 px-2 py-1 text-ink hover:bg-elevated">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
