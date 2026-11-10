"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, X } from "lucide-react";
import { shrinkPhoto } from "@/lib/shrink-photo";
import type { Callout, JobDetails } from "@/lib/saas/jobs";
import { createJob } from "../actions";

type Read = {
  job_type: string; matched_list: string | null; truck: string | null; start: string | null; client: string | null; well: string | null;
  tubing: string | null; casing: string | null; wellhead: string | null; pressure_control: string | null; assets: string[];
  remarks: string | null; callouts: Callout[];
};

const field = "h-12 w-full rounded-lg border border-line-2 bg-coal px-3.5 text-[16px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint";
const label = "flex flex-col gap-1.5 text-[13px] text-ink-dim";

/**
 * Start a job. Send a photo of the dispatch and SYNNR fills this in, or fill
 * it in by hand. Either way the hand sees what the job is before the list is
 * built, and can fix anything SYNNR read wrong.
 */
export default function NewJob({ ai, lists, trucks }: { ai: boolean; lists: { id: string; name: string; count: number }[]; trucks: string[] }) {
  const router = useRouter();
  const [jobType, setJobType] = useState("");
  const [truck, setTruck] = useState("");
  const [remarks, setRemarks] = useState("");
  const [details, setDetails] = useState<JobDetails | null>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [source, setSource] = useState<"photo" | "typed">("typed");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [readNote, setReadNote] = useState("");
  const photo = useRef<HTMLInputElement>(null);

  const list = lists.find((l) => l.name.trim().toLowerCase() === jobType.trim().toLowerCase())
    ?? (jobType.trim().length >= 4 ? lists.find((l) => jobType.toLowerCase().includes(l.name.toLowerCase()) || l.name.toLowerCase().includes(jobType.trim().toLowerCase())) : undefined);

  async function read(body: FormData) {
    setReading(true); setErr(""); setReadNote("");
    try {
      const r = await fetch("/api/synnr/read-dispatch", { method: "POST", body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setErr(d.error || "SYNNR couldn't read that. Type the job in instead."); return; }
      const got = d.read as Read;
      setJobType(got.matched_list || got.job_type || "");
      setTruck(got.truck ?? "");
      setRemarks(got.remarks ?? "");
      setDetails({ client: got.client, well: got.well, start: got.start, tubing: got.tubing, casing: got.casing, wellhead: got.wellhead, pressure_control: got.pressure_control, assets: got.assets });
      setCallouts(got.callouts ?? []);
      setSource("photo");
      setReadNote("Read it. Check it over, fix anything that's off, then build the list.");
    } catch {
      setErr("That didn't send. Check your signal and try again.");
    } finally {
      setReading(false);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    // A PDF goes as-is; a phone photo is several megabytes, so shrink it to send on one bar.
    body.set("photo", file.type === "application/pdf" ? file : await shrinkPhoto(file).catch(() => file));
    await read(body);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!jobType.trim()) { setErr("Say what kind of job it is."); return; }
    setSaving(true); setErr("");
    const r = await createJob({ jobType, truck, remarks, details, callouts, source, listId: list?.id ?? null });
    if (!r.ok) { setErr(r.error); setSaving(false); return; }
    router.push(`/app/jobs/${r.id}`);
  }

  const facts: [string, string][] = details
    ? ([["Start", details.start], ["Client", details.client], ["Well", details.well], ["Tubing", details.tubing], ["Casing", details.casing], ["Wellhead", details.wellhead], ["Pressure control", details.pressure_control],
        ...(details.assets ?? []).map((a) => ["Also assigned", a] as [string, string])] as [string, string | null | undefined][])
        .filter((f): f is [string, string] => Boolean(f[1]))
    : [];

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Let SYNNR read it */}
      <div className="rounded-2xl border border-line-2 bg-[#0b0c0e] p-5 sm:p-6">
        {ai ? (
          <>
            <input ref={photo} type="file" accept="image/*,application/pdf" className="sr-only" aria-label="Photo or PDF of the dispatch"
              onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" onClick={() => photo.current?.click()} disabled={reading}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-ink text-[16px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60">
              <Camera className="h-5 w-5" /> {reading ? "Reading the dispatch…" : "Photo or PDF of the dispatch"}
            </button>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">A screenshot or the Aradia PDF works. SYNNR reads the job and what it says to bring. The file isn&apos;t kept, and names and phone numbers are left out.</p>
          </>
        ) : (
          <p className="text-[14px] leading-relaxed text-ink-dim">
            Reading a photo of the dispatch isn&apos;t turned on for this account yet. Type the job in below and SYNNR builds the list from your shop&apos;s job lists.
          </p>
        )}
        {readNote ? <p role="status" className="mt-4 border-l-2 border-emerald-400 pl-3 text-[14px] text-ink">{readNote}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Kind of job
          <input value={jobType} onChange={(e) => setJobType(e.target.value)} list="synnr-job-lists" required maxLength={80} placeholder="Pipe recovery" className={field} />
          <datalist id="synnr-job-lists">{lists.map((l) => <option key={l.id} value={l.name} />)}</datalist>
        </label>
        <label className={label}>Truck
          <input value={truck} onChange={(e) => setTruck(e.target.value)} list="synnr-trucks" maxLength={40} placeholder="WL-07" className={field} />
          <datalist id="synnr-trucks">{trucks.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
      </div>

      <label className={label}>Remarks from the dispatch
        <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={2000} rows={3} placeholder="Anything it says about the hole or what to bring"
          className="w-full rounded-lg border border-line-2 bg-coal px-3.5 py-3 text-[16px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink-faint" />
      </label>

      {callouts.length ? (
        <div>
          <div className="text-[13px] text-ink-dim">The dispatch says to bring</div>
          <ul className="mt-2 overflow-hidden rounded-xl border border-line">
            {callouts.map((c, i) => (
              <li key={`${c.item}-${i}`} className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] text-ink">{c.item}{c.qty > 1 ? <span className="text-ink-faint"> × {c.qty}</span> : null}</span>
                  {c.why ? <span className="mt-0.5 block text-[13px] text-ink-dim">{c.why}</span> : null}
                </span>
                <span className="shrink-0 text-[12px] text-bone">Critical</span>
                <button type="button" onClick={() => setCallouts((cs) => cs.filter((_, j) => j !== i))} aria-label={`Leave ${c.item} off`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-elevated hover:text-ink"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.length ? (
        <dl className="overflow-hidden rounded-xl border border-line">
          {facts.map(([k, v], i) => (
            <div key={`${k}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-line bg-surface px-4 py-2.5 text-[14px] last:border-b-0">
              <dt className="shrink-0 text-ink-faint">{k}</dt><dd className="min-w-0 break-words text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="text-[14px] leading-relaxed text-ink-dim" role="status">
        {!jobType.trim() ? "Pick the kind of job and SYNNR pulls your shop's list for it."
          : list ? `Your shop's list for ${list.name} has ${list.count} ${list.count === 1 ? "piece" : "pieces"}. They go on the checklist.`
            : `Your shop hasn't given SYNNR a list for "${jobType.trim()}" yet, so the checklist starts with only what the dispatch calls out. A manager can add the list under The Brain.`}
      </p>

      {err ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      <button type="submit" disabled={saving || reading}
        className="h-14 rounded-xl bg-ink text-[16px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60 sm:self-start sm:px-10">
        {saving ? "Building the list…" : "Build the list"}
      </button>
    </form>
  );
}
