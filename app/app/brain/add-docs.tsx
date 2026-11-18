"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DOC_KINDS, fileKind, MAX_FILE_BYTES, type DocKind } from "@/lib/saas/brain";
import { addNote, readDoc, startUpload } from "./actions";

type Row = { key: number; name: string; state: "sending" | "reading" | "ready" | "failed"; detail: string };

const field = "h-11 w-full rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint";
const OFFLINE = "That didn't send. Check your signal and try again.";

/**
 * Putting documents in. Pick what kind they are, choose the files, and each
 * one is sent, read, and cut into passages while you watch: it says how many
 * it got, or why it couldn't read that one. Or type in what nobody ever
 * wrote down. A manager's screen; the crew never sees it.
 */
export default function AddDocs() {
  const router = useRouter();
  const [mode, setMode] = useState<"files" | "note" | null>(null);
  const [kind, setKind] = useState<DocKind>("procedure");
  const [mgr, setMgr] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  /** One file at a time: send it straight to storage, then have the server read it. */
  async function load(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true); setErr("");
    const sb = getBrowserSupabase();
    for (const file of files) {
      const key = ++seq.current;
      setRows((rs) => [...rs, { key, name: file.name, state: "sending", detail: "Sending…" }]);
      const can = fileKind(file.name);
      if (!can.ok) { set(key, { state: "failed", detail: can.problem }); continue; }
      if (file.size > MAX_FILE_BYTES) { set(key, { state: "failed", detail: "That file is over 25 MB. Split it, or load the part that matters." }); continue; }
      try {
        const started = await startUpload({ name: file.name, size: file.size, kind, managersOnly: mgr });
        if (!started.ok) { set(key, { state: "failed", detail: started.error }); continue; }
        const up = sb ? await sb.storage.from("brain").uploadToSignedUrl(started.path, started.token, file, { contentType: started.mime }) : { error: new Error("off") };
        if (up.error) { set(key, { state: "failed", detail: "The file didn't finish sending. Take it out of the list below and load it again." }); continue; }
        set(key, { state: "reading", detail: "Reading it…" });
        const read = await readDoc(started.docId);
        if (!read.ok) set(key, { state: "failed", detail: read.error });
        else if (read.status === "failed") set(key, { state: "failed", detail: read.problem ?? "It couldn't be read." });
        else set(key, { state: "ready", detail: `Read. ${read.passages} ${read.passages === 1 ? "passage" : "passages"} to answer from.` });
      } catch {
        set(key, { state: "failed", detail: OFFLINE });
      }
    }
    setBusy(false);
    router.refresh();
  }

  async function note(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true); setErr("");
    try {
      const r = await addNote({ title: String(fd.get("title") ?? ""), text: String(fd.get("text") ?? ""), kind, managersOnly: mgr });
      if (!r.ok) { setErr(r.error); return; }
      form.reset(); setMode(null);
      router.refresh();
    } catch {
      setErr(OFFLINE);
    } finally {
      setBusy(false);
    }
  }

  const pick = (m: "files" | "note", k: DocKind) => { setErr(""); setKind(k); setMode((cur) => (cur === m ? null : m)); };
  const options = (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">What kind is it?
        <select value={kind} onChange={(e) => setKind(e.target.value as DocKind)} className={field}>
          {DOC_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}: {k.hint}</option>)}
        </select>
      </label>
      <label className="flex h-11 items-center gap-2.5 text-[14px] text-ink-dim">
        <input type="checkbox" checked={mgr} onChange={(e) => setMgr(e.target.checked)} className="h-5 w-5 accent-bone" /> Managers only
      </label>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => pick("files", "procedure")} aria-expanded={mode === "files"}
          className={cn("flex h-11 items-center gap-2 rounded-lg px-4 text-[14px] font-medium transition-colors", mode === "files" ? "bg-white text-coal" : "bg-ink text-coal hover:bg-white")}>
          <FileUp className="h-4 w-4" /> Load documents
        </button>
        <button type="button" onClick={() => pick("note", "note")} aria-expanded={mode === "note"}
          className={cn("flex h-11 items-center gap-2 rounded-lg border px-4 text-[14px] transition-colors", mode === "note" ? "border-ink text-ink" : "border-line-2 text-ink hover:bg-elevated")}>
          <PencilLine className="h-4 w-4" /> Type a note
        </button>
      </div>

      {mode === "files" ? (
        <div className="mt-4 rounded-xl border border-line-2 bg-surface p-4 sm:p-5">
          {options}
          <input ref={input} type="file" multiple accept=".pdf,.docx,.txt,.md,.csv" className="sr-only" tabIndex={-1} aria-label="Documents to load"
            onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void load(files); }} />
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="mt-4 flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-2 px-4 py-5 text-center transition-colors hover:border-ink-faint hover:bg-elevated disabled:opacity-60">
            <span className="text-[15px] text-ink">{busy ? "Working on it…" : "Choose the files"}</span>
            <span className="text-[13px] text-ink-faint">PDF, Word (.docx), or plain text. Several at once is fine. Up to 25 MB each.</span>
          </button>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
            A managers-only document is never searched for a hand&apos;s question, and never shown to one. A scan (pictures of pages) can&apos;t be read yet: type the part that matters in as a note.
          </p>
        </div>
      ) : null}

      {mode === "note" ? (
        <form onSubmit={note} className="mt-4 rounded-xl border border-line-2 bg-surface p-4 sm:p-5">
          {options}
          <label className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-dim">What&apos;s it called?
            <input name="title" required maxLength={160} placeholder="Like: Things nobody wrote down" className={field} />
          </label>
          <label className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink-dim">What should the crew know?
            <textarea name="text" required rows={7} maxLength={200000} placeholder="Type it the way you'd tell a new hand. Or paste it in from anywhere."
              className="w-full rounded-lg border border-line-2 bg-coal px-3 py-3 text-[15px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint" />
          </label>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={busy} className="h-11 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60">{busy ? "Saving…" : "Put it in the brain"}</button>
            <button type="button" onClick={() => setMode(null)} className="h-11 rounded-lg border border-line-2 px-4 text-[14px] text-ink-dim transition-colors hover:text-ink">Cancel</button>
          </div>
        </form>
      ) : null}

      {err ? <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      {rows.length ? (
        <ul className="mt-4 overflow-hidden rounded-xl border border-line" aria-live="polite">
          {rows.map((r) => (
            <li key={r.key} className="flex items-start gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0">
              <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", r.state === "ready" ? "bg-emerald-400" : r.state === "failed" ? "bg-red-400" : "animate-pulse bg-bone")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-ink">{r.name}</span>
                <span className={cn("mt-0.5 block text-[13px] leading-snug", r.state === "failed" ? "text-red-300" : "text-ink-faint")}>{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
