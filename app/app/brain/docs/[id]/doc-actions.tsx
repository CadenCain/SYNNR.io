"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { DOC_KINDS } from "@/lib/saas/brain";
import { docFileUrl, removeDoc, updateDoc } from "../../actions";

const field = "h-11 w-full rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none transition-colors focus:border-ink-faint";
const quiet = "min-h-9 text-[13px] text-ink-faint underline-offset-4 transition-colors hover:underline";
const OFFLINE = "That didn't send. Check your signal and try again.";

/** A manager's handles on one document: its name and kind, who can see it, the file back, and taking it out. */
export default function DocActions({ docId, title, kind, managersOnly, hasFile, canChange, demo }: {
  docId: string; title: string; kind: string; managersOnly: boolean; hasFile: boolean; canChange: boolean; demo: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const r = await updateDoc(docId, { title: String(fd.get("title") ?? ""), kind: String(fd.get("kind") ?? ""), managersOnly: fd.get("mgr") === "on" });
      if (!r.ok) { setErr(r.error); return; }
      setEditing(false);
      router.refresh();
    } catch { setErr(OFFLINE); } finally { setBusy(false); }
  }

  async function file() {
    setErr("");
    try {
      const r = await docFileUrl(docId);
      if (!r.ok) { setErr(r.error); return; }
      window.location.assign(r.url);
    } catch { setErr(OFFLINE); }
  }

  async function remove() {
    if (!window.confirm(`Take "${title}" out of the brain? Its file goes with it, and nothing is answered from it again.`)) return;
    setErr("");
    try {
      const r = await removeDoc(docId);
      if (!r.ok) { setErr(r.error); return; }
      router.replace("/app/brain");
      router.refresh();
    } catch { setErr(OFFLINE); }
  }

  if (demo) return <p className="text-[13px] text-ink-faint">In your own company, a manager can rename a document, keep it to managers only, download the file, or take it out.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {canChange ? <button type="button" onClick={() => { setErr(""); setEditing((x) => !x); }} aria-expanded={editing} className={cn(quiet, "hover:text-ink", editing && "text-ink")}>Rename it, or change who sees it</button> : null}
        {hasFile ? <button type="button" onClick={file} className={cn(quiet, "hover:text-ink")}>Download the file</button> : null}
        <button type="button" onClick={remove} className={cn(quiet, "hover:text-red-400")}>Take it out</button>
      </div>
      {editing ? (
        <form onSubmit={save} className="mt-3 rounded-xl border border-line-2 bg-surface p-4">
          <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">What it&apos;s called. An answer names it by this.
            <input name="title" defaultValue={title} required maxLength={160} autoFocus className={field} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">What kind is it?
              <select name="kind" defaultValue={kind} className={field}>{DOC_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
            </label>
            <label className="flex h-11 items-center gap-2.5 text-[14px] text-ink-dim">
              <input name="mgr" type="checkbox" defaultChecked={managersOnly} className="h-5 w-5 accent-bone" /> Managers only
            </label>
          </div>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={busy} className="h-11 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setEditing(false)} className="h-11 rounded-lg border border-line-2 px-4 text-[14px] text-ink-dim transition-colors hover:text-ink">Cancel</button>
          </div>
        </form>
      ) : null}
      {err ? <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}
    </div>
  );
}
