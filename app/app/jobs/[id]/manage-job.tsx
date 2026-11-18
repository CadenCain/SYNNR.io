"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { CLOSE_REASONS } from "@/lib/saas/jobs";
import { closeJob, deleteJob, fixJob } from "../actions";
import { safe } from "./safe";

const field = "h-11 w-full rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint";
const quiet = "text-[13px] text-ink-faint underline-offset-4 transition-colors hover:underline";

/**
 * The manager's call on a job, at the bottom of it. Fix what was typed in
 * wrong (the truck, the kind of job), close the job out when it's over
 * (the customer cancelled, it was started by mistake), or delete it. A hand
 * never sees this. Fixing and closing keep the record: what the job said
 * before, who changed it, and why it was closed all stay on it.
 */
export default function ManageJob({ jobId, truck, jobType, kinds, trucks, closed }: {
  jobId: string; truck: string; jobType: string;
  /** The shop's own job lists and trucks, to pick from instead of typing it wrong a second time. */
  kinds: string[]; trucks: string[]; closed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"fix" | "close" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [why, setWhy] = useState("");

  const show = (which: "fix" | "close") => { setErr(""); setWhy(""); setOpen((o) => (o === which ? null : which)); };

  async function fix(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    const r = await safe(() => fixJob(jobId, { truck: String(fd.get("truck") ?? ""), jobType: String(fd.get("jobType") ?? "") }));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setOpen(null);
    router.refresh();
  }

  async function close(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || !why.trim()) return;
    setBusy(true); setErr("");
    const r = await safe(() => closeJob(jobId, why));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setOpen(null); setWhy("");
    router.refresh();
  }

  async function del() {
    if (!window.confirm("Delete this job? Its list, its photos, and who loaded what go with it.")) return;
    setErr("");
    const r = await safe(() => deleteJob(jobId));
    if (!r.ok) { setErr(r.error); return; }
    router.replace("/app/jobs");
    router.refresh();
  }

  return (
    <section className="border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <button type="button" onClick={() => show("fix")} aria-expanded={open === "fix"} className={cn(quiet, "min-h-9 hover:text-ink", open === "fix" && "text-ink")}>Fix the truck or the kind of job</button>
        {closed ? null : (
          <button type="button" onClick={() => show("close")} aria-expanded={open === "close"} className={cn(quiet, "min-h-9 hover:text-ink", open === "close" && "text-ink")}>Close this job out</button>
        )}
        <button type="button" onClick={del} className={cn(quiet, "min-h-9 hover:text-red-400")}>Delete this job</button>
      </div>

      {open === "fix" ? (
        <form onSubmit={fix} className="mt-3 rounded-xl border border-line-2 bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">Truck
              <input name="truck" defaultValue={truck} list="synnr-fix-trucks" maxLength={40} placeholder="Truck or unit number" autoFocus className={field} />
              <datalist id="synnr-fix-trucks">{trucks.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-ink-dim">Kind of job
              <input name="jobType" defaultValue={jobType} list="synnr-fix-kinds" required maxLength={80} className={field} />
              <datalist id="synnr-fix-kinds">{kinds.map((k) => <option key={k} value={k} />)}</datalist>
            </label>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">The list and the photos stay as they are. The job keeps a note of what it said before, and that you changed it.</p>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={busy} className="h-11 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setOpen(null)} className="h-11 rounded-lg border border-line-2 px-4 text-[14px] text-ink-dim transition-colors hover:text-ink">Cancel</button>
          </div>
        </form>
      ) : null}

      {open === "close" ? (
        <form onSubmit={close} className="mt-3 rounded-xl border border-line-2 bg-surface p-4">
          <label htmlFor="synnr-close-why" className="block text-[14px] text-ink">Why is it being closed out?</label>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {CLOSE_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setWhy(r)} aria-pressed={why === r}
                className={cn("h-9 rounded-full border px-3.5 text-[13px] transition-colors", why === r ? "border-ink text-ink" : "border-line-2 text-ink-dim hover:text-ink")}>{r}</button>
            ))}
          </div>
          <input id="synnr-close-why" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} placeholder="Or say it in your own words" className={cn(field, "mt-3")} />
          <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">A closed job owes nothing: it comes off Needs a look and out of the morning email. Its list and photos stay, and you can open it back up.</p>
          <div className="mt-3 flex gap-3">
            <button type="submit" disabled={busy || !why.trim()} className="h-11 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60">{busy ? "Closing…" : "Close it out"}</button>
            <button type="button" onClick={() => setOpen(null)} className="h-11 rounded-lg border border-line-2 px-4 text-[14px] text-ink-dim transition-colors hover:text-ink">Cancel</button>
          </div>
        </form>
      ) : null}

      {err ? <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}
    </section>
  );
}
