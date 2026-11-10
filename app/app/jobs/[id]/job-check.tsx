"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { jobState, orderLines, type JobLine } from "@/lib/saas/jobs";
import { fmtTime, fmtWhen } from "@/lib/saas/format";
import { setLine, addLine, removeLine, markReady, deleteJob } from "../actions";

// One clock for the server's first paint and the phone, so a time never changes under a thumb.
const when = (iso: string | null) => iso ? fmtTime(iso) : "";

/**
 * Loading the truck. Every piece is one big row: tap it when it's on. A
 * critical piece goes on with a photo of it, so the tap opens the camera and
 * the photo is the tap. What stops the job is at the top. The truck reads NOT
 * READY, and says what's missing, until every row is on and someone calls it
 * ready. The photos stay with the job as the proof.
 */
export default function JobCheck({ jobId, initial, photos, initialReady, me, manager, writable }: {
  jobId: string; initial: JobLine[]; photos: Record<string, string>; initialReady: { by: string | null; at: string | null } | null; me: string; manager: boolean; writable: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = useState(initial);
  const [ready, setReady] = useState(initialReady);
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const [busyReady, setBusyReady] = useState(false);
  // Photos taken on this screen, so they show before the page loads again.
  const [fresh, setFresh] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const reloaded = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const ordered = orderLines(lines);
  const s = jobState(lines);
  const photoOf = (l: JobLine) => l.photo_path ? fresh[l.id] ?? photos[l.id] ?? null : null;
  const critical = lines.filter((l) => l.critical);
  const proof = ordered.filter((l) => l.critical && l.on_at && l.photo_path);
  const viewing = open ? lines.find((l) => l.id === open && l.photo_path) ?? null : null;

  // A real dialog sits over everything, the site's own header included, and
  // closes on Escape or the phone's back gesture by itself.
  const isViewing = Boolean(viewing);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (isViewing && !d.open) d.showModal();
    if (!isViewing && d.open) d.close();
  }, [isViewing]);

  function toggle(l: JobLine, on: boolean) {
    setErr("");
    // Show it right away; put it back if the save doesn't go through.
    setLines((ls) => ls.map((x) => x.id === l.id ? { ...x, on_at: on ? new Date().toISOString() : null, on_by: on ? me : null, photo_path: on ? x.photo_path : null } : x));
    if (!on) setReady(null);
    start(async () => {
      const r = await setLine(l.id, on);
      if (!r.ok) {
        setLines((ls) => ls.map((x) => x.id === l.id ? { ...x, on_at: l.on_at, on_by: l.on_by, photo_path: l.photo_path } : x));
        setErr(r.error);
      } else {
        setLines((ls) => ls.map((x) => x.id === l.id ? { ...x, on_at: r.on_at, on_by: r.on_by } : x));
      }
    });
  }

  function tap(l: JobLine) {
    if (l.critical) {
      // Once it's on, the row opens its photo: a stray thumb can't throw the proof away.
      if (l.on_at && l.photo_path) setOpen(l.id);
      else shoot(l.id);
      return;
    }
    if (writable) toggle(l, !l.on_at);
  }

  function shoot(id: string) {
    if (!writable || saving) return;
    target.current = id;
    camera.current?.click();
  }

  /** The photo is saved first, then the piece reads as on. No photo, no tap. */
  async function onShot(file: File | undefined) {
    const id = target.current;
    target.current = null;
    if (!file || !id) return;
    setErr(""); setSaving(id);
    try {
      // A phone photo is several megabytes; shrink it so it sends on one bar.
      const small = await shrinkPhoto(file).catch(() => file);
      const body = new FormData();
      body.set("line", id);
      body.set("photo", small);
      const r = await fetch("/api/synnr/line-photo", { method: "POST", body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setErr(d.error || "The photo didn't save. Try again."); return; }
      setLines((ls) => ls.map((x) => x.id === id ? { ...x, on_at: d.on_at, on_by: d.on_by, photo_path: d.photo_path } : x));
      setFresh((f) => ({ ...f, [id]: d.photo_url || URL.createObjectURL(small) }));
    } catch {
      setErr("The photo didn't send. Check your signal and try again.");
    } finally {
      setSaving(null);
    }
  }

  // The links that open the photos last an hour. If one has gone stale, load the page again for new ones.
  function stale() {
    if (reloaded.current) return;
    reloaded.current = true;
    setFresh({});
    router.refresh();
  }

  function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const label = String(fd.get("label") ?? "").trim();
    if (!label) return;
    const qty = Number(fd.get("qty")) || 1;
    const isCritical = fd.get("critical") === "on";
    setErr("");
    start(async () => {
      const r = await addLine(jobId, { label, qty, critical: isCritical });
      if (!r.ok) { setErr(r.error); return; }
      setLines((ls) => [...ls, { id: r.id, label, qty, critical: isCritical, why: null, source: "added", sort: r.sort, on_at: null, on_by: null, photo_path: null }]);
      setReady(null);
      form.reset();
      setAdding(false);
    });
  }

  function remove(l: JobLine) {
    setErr("");
    start(async () => {
      const r = await removeLine(l.id);
      if (!r.ok) { setErr(r.error); return; }
      setLines((ls) => ls.filter((x) => x.id !== l.id));
    });
  }

  async function callReady() {
    setBusyReady(true); setErr("");
    const r = await markReady(jobId);
    setBusyReady(false);
    if (!r.ok) { setErr(r.error); router.refresh(); return; }
    setReady({ by: r.ready_by, at: r.ready_at });
  }

  async function del() {
    if (!window.confirm("Delete this job? Its list, its photos, and who loaded what go with it.")) return;
    const r = await deleteJob(jobId);
    if (!r.ok) { setErr(r.error); return; }
    router.replace("/app");
    router.refresh();
  }

  const isReady = Boolean(ready) && s.ready;
  const proven = critical.length > 0 && proof.length === critical.length;
  const viewingUrl = viewing ? photoOf(viewing) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* The camera. On a phone this opens it straight up, so the photo is taken now, not picked from last week. */}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Photo of the piece"
        onChange={(e) => { void onShot(e.target.files?.[0]); e.target.value = ""; }} />

      {/* Where the truck stands */}
      <div className={cn("rounded-2xl border px-5 py-5 sm:px-6", isReady ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-line-2 bg-[#0b0c0e]")}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", isReady ? "bg-emerald-400" : "bg-red-400")} />
              <span className={cn("text-[40px] font-light leading-none tracking-[-0.03em] sm:text-[52px]", isReady ? "text-emerald-400" : "text-red-400")}>{isReady ? "Ready" : "Not ready"}</span>
            </div>
            <p className="mt-3 text-[14px] text-ink-dim" role="status">
              {isReady
                ? `Cleared by ${ready?.by ?? "someone"}${ready?.at ? ` at ${when(ready.at)}` : ""}. Everything on the list is on the truck${proven ? (critical.length === 1 ? ", with a photo of the critical piece" : `, with a photo of all ${critical.length} critical pieces`) : ""}.`
                : s.total === 0
                  ? "This job has no list yet. Add what it takes."
                  : s.ready
                    ? "Everything is on. Call it ready."
                    : `${s.missing.length} still off the truck${s.criticalMissing ? `, ${s.criticalMissing} of them critical` : ""}.`}
            </p>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-[40px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums sm:text-[52px]">{s.on}<span className="text-ink-faint"> / {s.total}</span></span>
            <span className="text-[13px] text-ink-dim">on the truck</span>
          </div>
        </div>
        {!isReady && s.ready && writable ? (
          <button type="button" onClick={callReady} disabled={busyReady}
            className="mt-5 h-14 w-full rounded-xl bg-emerald-400 text-[17px] font-semibold text-coal transition-colors hover:bg-emerald-300 disabled:opacity-60 sm:w-auto sm:px-10">
            {busyReady ? "Saving…" : "Call it ready"}
          </button>
        ) : null}
      </div>

      {err ? <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      {/* The list */}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium text-ink">What to take</h2>
          {writable ? (
            <button type="button" onClick={() => setAdding((a) => !a)} className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
              <Plus className="h-4 w-4" /> Add a piece
            </button>
          ) : null}
        </div>
        {critical.length && writable && !isReady ? (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">A critical piece goes on with a photo. Tap it and the camera opens.</p>
        ) : null}

        {adding ? (
          <form onSubmit={add} className="mt-3 flex flex-col gap-3 rounded-xl border border-line-2 bg-surface p-4 sm:flex-row sm:items-center">
            <input name="label" required maxLength={120} autoFocus placeholder="What is it?" aria-label="What is it?"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none placeholder:text-ink-faint focus:border-ink-faint" />
            <input name="qty" type="number" min={1} max={999} defaultValue={1} aria-label="How many"
              className="h-11 w-20 rounded-lg border border-line-2 bg-coal px-3 text-[15px] text-ink outline-none focus:border-ink-faint" />
            <label className="flex h-11 items-center gap-2 text-[14px] text-ink-dim"><input name="critical" type="checkbox" className="h-5 w-5 accent-bone" /> Critical</label>
            <button type="submit" className="h-11 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white">Add</button>
          </form>
        ) : null}

        <ul className="mt-3 overflow-hidden rounded-xl border border-line">
          {ordered.length === 0 ? (
            <li className="bg-surface px-5 py-8 text-center text-[14px] text-ink-dim">Nothing on the list yet.</li>
          ) : ordered.map((l) => {
            const on = Boolean(l.on_at);
            const photo = photoOf(l);
            const busy = saving === l.id;
            // Anyone who can see the job can open a photo; only a paid-up account can load.
            const canTap = l.critical && on && l.photo_path ? true : writable;
            return (
              <li key={l.id} className="flex items-stretch border-b border-line bg-surface last:border-b-0">
                <button type="button" onClick={() => tap(l)} disabled={!canTap || busy} aria-pressed={on}
                  className={cn("flex min-h-16 min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left transition-colors sm:px-5", canTap && "hover:bg-elevated active:bg-elevated")}>
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    on ? "border-emerald-400 bg-emerald-400 text-coal" : l.critical ? "border-bone text-bone" : "border-line-2", busy && "animate-pulse")}>
                    {on ? <Check className="h-4 w-4" strokeWidth={3} /> : l.critical ? <Camera className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[16px] leading-snug", on ? "text-ink-dim" : "text-ink")}>
                      {l.label}{l.qty > 1 ? <span className="text-ink-faint"> × {l.qty}</span> : null}
                    </span>
                    {l.why ? <span className="mt-0.5 block text-[13px] leading-snug text-ink-dim">Dispatch: {l.why}</span> : null}
                    {busy ? <span className="mt-0.5 block text-[12px] text-bone">Saving the photo…</span>
                      : on ? <span className="mt-0.5 block text-[12px] text-ink-faint">{l.on_by ?? "Someone"}{l.on_at ? `, ${when(l.on_at)}` : ""}</span>
                        : l.critical ? <span className="sr-only">Take a photo of it to put it on.</span> : null}
                  </span>
                  {photo ? (
                    // A private, short-lived link: it goes straight to the phone, not through an image resizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" onError={stale} className="h-11 w-11 shrink-0 rounded-md border border-line-2 object-cover" />
                  ) : null}
                  {l.critical ? <span className={cn("shrink-0 text-[12px]", on ? "text-ink-faint" : "text-bone", photo && "hidden sm:inline")}>Critical</span> : null}
                </button>
                {manager && writable ? (
                  <button type="button" onClick={() => remove(l)} aria-label={`Take ${l.label} off the list`} title="Take it off the list"
                    className="flex w-11 shrink-0 items-center justify-center border-l border-line text-ink-faint transition-colors hover:bg-elevated hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* The proof: one photo per critical piece, with who took it and when. */}
      {proof.length ? (
        <section>
          <h2 className="text-[15px] font-medium text-ink">Proof</h2>
          <p className="mt-1 text-[13px] text-ink-faint">
            {proof.length} of {critical.length} critical {critical.length === 1 ? "piece" : "pieces"} photographed going on the truck.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {proof.map((l) => {
              const photo = photoOf(l);
              return (
                <li key={l.id}>
                  <button type="button" onClick={() => setOpen(l.id)} className="block w-full overflow-hidden rounded-xl border border-line bg-surface text-left transition-colors hover:border-line-2">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={`Photo of ${l.label}`} onError={stale} className="aspect-[4/3] w-full bg-coal object-cover" />
                    ) : (
                      <span className="flex aspect-[4/3] w-full items-center justify-center bg-coal text-[12px] text-ink-faint">Photo on file</span>
                    )}
                    <span className="block px-3 py-2.5">
                      <span className="block truncate text-[13px] text-ink">{l.label}</span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-faint">{l.on_by ?? "Someone"}, {fmtWhen(l.on_at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {manager && writable ? (
        <button type="button" onClick={del} className="self-start text-[13px] text-ink-faint underline-offset-4 transition-colors hover:text-red-400 hover:underline">Delete this job</button>
      ) : null}

      {/* One photo, full size */}
      <dialog ref={dialog} onClose={() => setOpen(null)} aria-label={viewing ? `Photo of ${viewing.label}` : "Photo"}
        className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none flex-col border-0 bg-black/95 p-0 text-ink open:flex backdrop:bg-black">
        {viewing ? (
          <>
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <div className="truncate text-[16px] text-ink">{viewing.label}{viewing.qty > 1 ? <span className="text-ink-faint"> × {viewing.qty}</span> : null}</div>
                <div className="mt-0.5 truncate text-[13px] text-ink-dim">On the truck: {viewing.on_by ?? "someone"}, {fmtWhen(viewing.on_at)}</div>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close the photo"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-elevated hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-6">
              {viewingUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewingUrl} alt={`Photo of ${viewing.label}`} onError={stale} className="max-h-full max-w-full rounded-lg object-contain" />
              ) : (
                <span className="text-[14px] text-ink-dim">The photo is on file but didn&apos;t load. Load the page again.</span>
              )}
            </div>
            {writable ? (
              <div className="flex gap-3 border-t border-line px-4 py-4 sm:px-6">
                <button type="button" onClick={() => { const id = viewing.id; setOpen(null); shoot(id); }}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-[15px] font-medium text-coal transition-colors hover:bg-white sm:flex-none">
                  <Camera className="h-4 w-4" /> Take it again
                </button>
                <button type="button" onClick={() => { const l = viewing; setOpen(null); toggle(l, false); }}
                  className="h-12 flex-1 rounded-lg border border-line-2 px-5 text-[15px] text-ink-dim transition-colors hover:border-red-500/50 hover:text-red-300 sm:flex-none">
                  Take it off
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </dialog>
    </div>
  );
}
