"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, Paperclip, ArrowRight, X } from "lucide-react";

type Turn = { id: number; who: "you" | "synnr"; text: string; file?: string | null };

const EXAMPLES = [
  "What do I need to set a packer in 5-1/2 casing?",
  "What goes out on a pipe recovery job?",
  "What do we charge for a bond log to 8,000 ft?",
  "What does the MSA say about standby time?",
];

/**
 * The Ask screen: one bar. Asking isn't built yet, and the screen says so
 * up front and again when someone asks, with the way to what does work
 * today (a job). It never tells anyone to load something there's no way to
 * load.
 */
export default function Ask({ firstName, companyName }: { firstName: string; companyName: string }) {
  const [q, setQ] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  // The box grows with what's typed, up to a point.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [q]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  // At a desk the cursor is in the bar, ready. On a phone it waits for a tap,
  // so the keyboard doesn't jump up over the page or over an answer.
  const started = turns.length > 0;
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) area.current?.focus();
  }, [started]);
  function send(e?: FormEvent) {
    e?.preventDefault();
    const text = q.trim();
    if (!text && !file) return;
    const you: Turn = { id: ++seq.current, who: "you", text, file: file?.name ?? null };
    const reply: Turn = {
      id: ++seq.current, who: "synnr",
      text: `I can't answer questions about ${companyName} yet. That part is being built, and I won't guess. What works today: start a job, and I build its list from your shop's job lists, keep the photo proof, and show your manager what's still owed after the job.`,
    };
    setTurns((t) => [...t, you, reply]);
    setQ(""); setFile(null);
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  }

  const bar = (
    <form onSubmit={send}
      className="rounded-xl border border-line-2 bg-surface shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] transition-colors focus-within:border-[#3b3e44]">
      {file ? (
        <div className="flex items-center gap-2 px-4 pt-3 text-[13px] text-ink-dim">
          <Paperclip className="h-3.5 w-3.5" />
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remove the file" className="rounded p-0.5 text-ink-faint hover:text-ink"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}
      <textarea ref={area} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} rows={1}
        placeholder="Ask SYNNR anything" aria-label="Ask SYNNR"
        className="block w-full resize-none bg-transparent px-4 pb-2 pt-4 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-faint" />
      <div className="flex items-center justify-between px-2 pb-2">
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-faint transition-colors hover:bg-elevated hover:text-ink">
          <input type="file" accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx" className="sr-only"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          <Paperclip className="h-4 w-4" /> Photo or file
        </label>
        <button type="submit" disabled={!q.trim() && !file} aria-label="Send"
          className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-coal transition-colors hover:bg-white disabled:bg-elevated disabled:text-ink-faint">
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );

  if (started) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6 pt-8 md:px-0">
          <div className="flex flex-col gap-6">
            {turns.map((t) => t.who === "you" ? (
              <div key={t.id} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-xl bg-elevated px-4 py-3 text-[15px] leading-6 text-ink">
                {t.file ? <div className="mb-1 flex items-center gap-1.5 text-[13px] text-ink-dim"><Paperclip className="h-3.5 w-3.5" /> {t.file}</div> : null}
                {t.text}
              </div>
            ) : (
              <div key={t.id} className="flex gap-3">
                <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-[1px] bg-bone" />
                <div className="min-w-0 text-[15px] leading-7 text-ink">
                  <p>{t.text}</p>
                  <Link href="/app/jobs/new" className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] font-medium text-ink-dim underline-offset-4 hover:text-ink hover:underline">
                    Start a job <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
            <div ref={end} className="scroll-mb-40" />
          </div>
        </div>
        <div className="sticky bottom-0 bg-coal px-4 pb-5 pt-3 md:px-0">
          <div className="mx-auto w-full max-w-2xl">{bar}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-4 py-12 md:px-0">
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[34px]">
          What do you need{firstName ? `, ${firstName}` : ""}?
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-dim">
          Asking is being built, so it can&apos;t answer yet. Today SYNNR runs your jobs: the list, the photo proof, and what&apos;s still owed after.
        </p>
        <div className="mt-8">{bar}</div>
        <p className="mt-8 text-[13px] text-ink-faint">What you&apos;ll be able to ask</p>
        <div className="mt-2 border-t border-line">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setQ(ex); area.current?.focus(); }}
              className="group flex w-full items-center justify-between gap-4 border-b border-line py-3.5 text-left text-[14px] text-ink-dim transition-colors hover:text-ink">
              <span>{ex}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-ink" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
