"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp, ArrowRight, ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { sourceWhere, type Answer, type Source } from "@/lib/saas/brain";
import { fmtWhen } from "@/lib/saas/format";
import { ask } from "./ask-actions";

/** A question asked before, with what came back, as it was shown then. */
export type Before = { id: string; mode: "ask" | "job"; question: string; answer: Answer; at: string; by: string | null };
type Turn = { id: number; mode: "ask" | "job"; question: string; answer: Answer | null; error: string | null };

const sourceHref = (s: Source) => s.from === "list" ? "/app/brain/lists" : `/app/brain/docs/${s.id}${s.idx === null ? "" : `#p${s.idx}`}`;

/**
 * The Ask screen: one bar. A question is answered from the shop's own
 * documents and job lists and nothing else. With the written answer on, each
 * part of it carries the number of the passage it came from; without it, the
 * passages themselves are shown, word for word. When the documents have
 * nothing on it, it says so. A job pasted in the way dispatch sent it gets
 * the same treatment: what the shop's own documents say about that job.
 */
export default function Ask({ firstName, companyName, manager, writable, demo, written, docs, lists, before, examples, hello }: {
  firstName: string; companyName: string; manager: boolean; writable: boolean; demo: boolean;
  /** Whether answers are written from the passages, or the passages are shown as they are. */
  written: boolean; docs: number; lists: number; before: Before[]; examples: string[]; hello: "welcome" | "joined" | null;
}) {
  const [q, setQ] = useState("");
  const [job, setJob] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const empty = docs === 0 && lists === 0;

  // The box grows with what's typed, up to a point.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, job ? 120 : 0), 260)}px`;
  }, [q, job]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns]);
  // At a desk the cursor is in the bar, ready. On a phone it waits for a tap,
  // so the keyboard doesn't jump up over the page or over an answer.
  const started = turns.length > 0;
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) area.current?.focus();
  }, [started]);

  async function send(e?: FormEvent, text = q) {
    e?.preventDefault();
    const question = text.trim();
    if (!question || busy) return;
    const id = ++seq.current;
    const mode = job ? "job" as const : "ask" as const;
    setTurns((t) => [...t, { id, mode, question, answer: null, error: null }]);
    // A pasted job is a one-off: the bar goes back to a question.
    setQ(""); setJob(false); setBusy(true);
    let r: Awaited<ReturnType<typeof ask>>;
    try {
      r = await ask({ question, mode });
    } catch (err) {
      // The framework's own signals (a redirect to log in again) pass through.
      if (typeof (err as { digest?: unknown })?.digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
      r = { ok: false, error: "That didn't send. Check your signal and try again." };
    }
    setBusy(false);
    setTurns((t) => t.map((x) => x.id === id ? { ...x, answer: r.ok ? r.answer : null, error: r.ok ? null : r.error } : x));
    if (!r.ok) { setQ(question); setJob(mode === "job"); }
  }
  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    // A pasted job has lines in it: Enter is a new line there.
    if (e.key === "Enter" && !e.shiftKey && !job && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); }
  }
  const again = (b: Before) => setTurns((t) => [...t, { id: ++seq.current, mode: b.mode, question: b.question, answer: b.answer, error: null }]);

  const bar = (
    <form onSubmit={send}
      className="rounded-xl border border-line-2 bg-surface shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] transition-colors focus-within:border-[#3b3e44]">
      <textarea ref={area} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} rows={1} disabled={!writable}
        maxLength={job ? 6000 : 1500}
        placeholder={!writable ? "Asking is paused with the subscription" : job ? "Paste the job the way dispatch sent it" : `Ask ${companyName}'s brain`}
        aria-label={job ? "The job, as dispatch sent it" : "Ask SYNNR"}
        className="block w-full resize-none bg-transparent px-4 pb-2 pt-4 text-[16px] leading-6 text-ink outline-none placeholder:text-ink-faint md:text-[15px]" />
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <button type="button" onClick={() => { setJob((j) => !j); area.current?.focus(); }} aria-pressed={job}
          className={cn("flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors hover:bg-elevated", job ? "bg-elevated text-ink" : "text-ink-faint hover:text-ink")}>
          <ClipboardList className="h-4 w-4" /> {job ? "Pasting a job" : "Paste a job"}
        </button>
        <button type="submit" disabled={!q.trim() || busy || !writable} aria-label={job ? "Read the job" : "Ask"}
          className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-coal transition-colors hover:bg-white disabled:bg-elevated disabled:text-ink-faint">
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </form>
  );

  if (started) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6 pt-8 md:px-0">
          <div className="flex flex-col gap-7">
            {turns.map((t) => (
              <div key={t.id} className="flex flex-col gap-4">
                <div className="ml-auto max-w-[88%] whitespace-pre-wrap break-words rounded-xl bg-elevated px-4 py-3 text-[15px] leading-6 text-ink">
                  {t.mode === "job" ? <div className="mb-1 text-[12px] text-ink-faint">A job, from dispatch</div> : null}
                  {t.question}
                </div>
                <div className="flex gap-3">
                  <span aria-hidden className={cn("mt-2.5 h-2 w-2 shrink-0 rounded-[1px] bg-bone", !t.answer && !t.error && "animate-pulse")} />
                  <div className="min-w-0 flex-1">
                    {t.answer ? <AnswerView answer={t.answer} manager={manager} demo={demo} />
                      : t.error ? <p role="alert" className="text-[15px] leading-7 text-red-300">{t.error}</p>
                        : <p className="text-[15px] leading-7 text-ink-dim" role="status">Reading {companyName}&apos;s documents…</p>}
                  </div>
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
    <div className="flex flex-1 flex-col justify-center px-4 py-10 md:px-0">
      <div className="mx-auto w-full max-w-2xl">
        {hello ? (
          <p className="mb-6 border-l-2 border-bone pl-3 text-[13px] leading-relaxed text-ink-dim">
            {hello === "welcome" ? "You're in. " : `You're on the crew at ${companyName}. `}
            {manager ? <>Start by putting <Link href="/app/brain" className="text-ink underline underline-offset-4 hover:text-white">your documents</Link> in the brain.</> : "Ask it what you'd ask the office."}
          </p>
        ) : null}
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink md:text-[34px]">
          What do you need{firstName ? `, ${firstName}` : ""}?
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-dim">
          {empty
            ? manager ? "The brain is empty. Put your documents in, and anyone on the crew can ask it what they'd ask the office."
              : "Nothing has been put in the brain yet. Once your manager loads the shop's documents, you can ask it what you'd ask the office."
            : <>It answers from {demo ? "the sample shop's" : `${companyName}'s`} own documents{lists ? " and job lists" : ""}, and shows you the passage. If it isn&apos;t in there, it says so.</>}
        </p>
        {empty && manager ? (
          <Link href="/app/brain" className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-ink px-4 text-[14px] font-medium text-coal transition-colors hover:bg-white">
            Put your documents in <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
        <div className="mt-8">{bar}</div>
        {!written && !empty ? (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
            Right now it shows you the passages from the documents, word for word. Writing the answer out from them is being turned on.
          </p>
        ) : null}

        {!empty ? (
          <>
            <p className="mt-8 text-[13px] text-ink-faint">{demo ? "Try one. The documents are samples, and everything in them is made up." : "The kind of thing to ask"}</p>
            <div className="mt-2 border-t border-line">
              {examples.map((ex) => (
                <button key={ex} type="button" onClick={() => { if (demo) void send(undefined, ex); else { setQ(ex); area.current?.focus(); } }} disabled={busy}
                  className="group flex w-full items-center justify-between gap-4 border-b border-line py-3.5 text-left text-[14px] text-ink-dim transition-colors hover:text-ink">
                  <span>{ex}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              ))}
            </div>
          </>
        ) : null}

        {before.length ? (
          <>
            <p className="mt-9 text-[13px] text-ink-faint">Asked before</p>
            <div className="mt-2 border-t border-line">
              {before.map((b) => (
                <button key={b.id} type="button" onClick={() => again(b)}
                  className="flex w-full items-baseline justify-between gap-4 border-b border-line py-3 text-left transition-colors hover:text-ink">
                  <span className="min-w-0 truncate text-[14px] text-ink-dim">{b.mode === "job" ? "Job: " : ""}{b.question.replace(/\s+/g, " ")}</span>
                  <span className="shrink-0 text-[12px] text-ink-faint">{b.by ? `${b.by}, ` : ""}{fmtWhen(b.at)}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/** One answer: what it says, then the passages it came from, each a tap away from its document. */
function AnswerView({ answer, manager, demo }: { answer: Answer; manager: boolean; demo: boolean }) {
  // With no written answer, the passages are the answer: they start open.
  const [open, setOpen] = useState<Set<number>>(() => new Set(answer.how === "passages" ? answer.sources.map((s) => s.n) : []));
  const list = useRef<HTMLDivElement>(null);
  const toggle = (n: number) => setOpen((o) => { const next = new Set(o); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  const show = (n: number) => {
    setOpen((o) => new Set(o).add(n));
    list.current?.querySelector(`[data-source="${n}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const cited = new Set(answer.parts.flatMap((p) => p.cites));
  const emptyBrain = answer.how === "none" && answer.sources.length === 0 && /nothing in the brain yet/i.test(answer.parts[0]?.text ?? "");

  return (
    <div className="text-[15px] leading-7 text-ink">
      {answer.how === "passages" ? (
        <p className="text-ink-dim">Here&apos;s what the documents say, word for word.</p>
      ) : (
        <p className="whitespace-pre-wrap break-words">
          {answer.parts.map((p, i) => (
            <span key={i}>
              {p.text}
              {p.cites.map((n) => (
                <button key={n} type="button" onClick={() => show(n)} aria-label={`Show passage ${n}`}
                  className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded bg-elevated px-1 align-middle font-mono text-[11px] leading-none text-ink-dim transition-colors hover:bg-line-2 hover:text-ink">{n}</button>
              ))}
            </span>
          ))}
        </p>
      )}
      {answer.note ? <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">{answer.note}</p> : null}
      {emptyBrain && manager && !demo ? (
        <Link href="/app/brain" className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] font-medium text-ink-dim underline-offset-4 hover:text-ink hover:underline">
          Put your documents in <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}

      {answer.sources.length ? (
        <div ref={list} className="mt-4">
          <div className="text-[12px] text-ink-faint">{answer.how === "ai" ? "Where it came from" : answer.how === "none" ? "The closest passages" : `From ${demo ? "the sample" : "your"} documents`}</div>
          <ul className="mt-1.5 overflow-hidden rounded-xl border border-line">
            {answer.sources.map((s) => {
              const isOpen = open.has(s.n);
              const where = sourceWhere(s);
              return (
                <li key={s.n} data-source={s.n} className="border-b border-line bg-surface last:border-b-0">
                  <button type="button" onClick={() => toggle(s.n)} aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated">
                    <span className={cn("mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 font-mono text-[11px]", answer.how === "ai" && cited.has(s.n) ? "bg-bone text-coal" : "bg-elevated text-ink-dim")}>{s.n}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] leading-snug text-ink">{s.title}</span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">{[s.type, where].filter(Boolean).join(" · ")}</span>
                    </span>
                    <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen ? (
                    <div className="px-4 pb-4 pl-12">
                      <p className="whitespace-pre-wrap break-words border-l-2 border-line-2 pl-3 text-[14px] leading-relaxed text-ink-dim">{s.body}</p>
                      <Link href={sourceHref(s)} className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-dim underline-offset-4 hover:text-ink hover:underline">
                        {s.from === "list" ? "Open the job lists" : "Open the document"} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
