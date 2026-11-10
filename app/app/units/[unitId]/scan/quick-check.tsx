"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import Link from "next/link";
import { Camera, Check, ShieldCheck, TriangleAlert } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { quickLines, quickKey } from "@/lib/saas/quick-check";
import { finishQuickCheck, type QuickResult } from "./quick-actions";

export interface QuickPackage { id: string; name: string; lines: { label: string; qty: number }[]; checks?: string[] }

type Draft = { startedAt: string; confirmed: Record<string, number>; checks: string[]; packageIds: string[]; job: string; savedAt: number };
const draftKey = (truckId: string) => `rr-quick-${truckId}`;
const readDraft = (truckId: string): Draft | null => {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(truckId)) ?? "null") as Draft | null;
    return d && Date.now() - d.savedAt < 18 * 3600e3 && Date.now() - Date.parse(d.startedAt) < 20 * 3600e3 ? d : null;
  } catch { return null; }
};
const nowIso = () => new Date().toISOString();

/**
 * The quick check on the phone: the truck's short list with a big "On truck"
 * button on each line, the checks like "BOP rams closed for travel", one
 * photo of the loaded truck, and Ready. Under a minute when the list is set.
 * The server decides READY; the phone just says what's on.
 */
export default function QuickCheck({ truck, companyId, kit, kitChecks, packages, plan, photoRule, outNote }: {
  truck: { id: string; name: string };
  companyId: string;
  kit: { label: string; qty: number }[];
  kitChecks: string[];
  /** Job lists to pick from (not tied to a truck). */
  packages: QuickPackage[];
  /** A manager planned this job: its lists are on and can't be taken off. */
  plan: { by: string | null; job: string | null; packageIds: string[]; lines: { label: string; qty: number }[] } | null;
  photoRule: "required" | "optional" | "off";
  /** The truck is out by the records: said once, doesn't stop anything. */
  outNote: string | null;
}) {
  const locked = useMemo(() => plan?.packageIds ?? [], [plan]);
  const [startedAt, setStartedAt] = useState(nowIso);
  const [picked, setPicked] = useState<string[]>(locked);
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [checks, setChecks] = useState<string[]>([]);
  const [job, setJob] = useState(plan?.job ?? "");
  const [showJob, setShowJob] = useState(Boolean(plan?.job));
  const [photo, setPhoto] = useState<{ file: File; url: string; at: number } | null>(null);
  const [photoErr, setPhotoErr] = useState("");
  const [result, setResult] = useState<QuickResult | null>(null);
  const [err, setErr] = useState("");
  const [pickedUp, setPickedUp] = useState(false);
  const [pending, start] = useTransition();
  const tries = useRef(0);

  // A check left on this phone (no signal, or the hand stepped away) comes back as it was.
  useEffect(() => {
    const d = readDraft(truck.id);
    if (!d || !Object.keys(d.confirmed).length) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one read of the phone's saved copy on load */
    setStartedAt(d.startedAt); setConfirmed(d.confirmed); setChecks(d.checks);
    setPicked([...new Set([...locked, ...d.packageIds])]); setJob(d.job || plan?.job || ""); setPickedUp(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [truck.id, locked, plan]);
  useEffect(() => {
    if (result?.ok || !Object.keys(confirmed).length) return;
    try { localStorage.setItem(draftKey(truck.id), JSON.stringify({ startedAt, confirmed, checks, packageIds: picked, job, savedAt: Date.now() } satisfies Draft)); } catch { /* storage off */ }
  }, [truck.id, startedAt, confirmed, checks, picked, job, result]);

  const chosen = packages.filter((p) => picked.includes(p.id));
  const lines = useMemo(() => quickLines({ kit, packages: chosen.map((p) => ({ name: p.name, lines: p.lines })), planned: plan?.lines ?? [] }), [kit, chosen, plan]);
  const askChecks = [...new Set([...kitChecks, ...chosen.flatMap((p) => p.checks ?? [])].map((c) => c.trim()).filter(Boolean))];
  const left = lines.filter((l) => (confirmed[quickKey(l)] ?? 0) < l.qty).length + askChecks.filter((c) => !checks.includes(c.toLowerCase())).length
    + (photoRule === "required" && !photo ? 1 : 0);

  const toggle = (l: (typeof lines)[number]) => {
    const k = quickKey(l);
    setConfirmed((c) => { const n = { ...c }; if ((n[k] ?? 0) >= l.qty) delete n[k]; else n[k] = l.qty; return n; });
  };
  const toggleCheck = (c: string) => setChecks((x) => x.includes(c.toLowerCase()) ? x.filter((y) => y !== c.toLowerCase()) : [...x, c.toLowerCase()]);
  const togglePkg = (id: string) => { if (!locked.includes(id)) setPicked((x) => x.includes(id) ? x.filter((y) => y !== id) : [...x, id]); };

  async function takePhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setPhotoErr("");
    const small = await shrinkPhoto(f, 1600, 0.8);
    if (!small.type.startsWith("image/") || small.size > 12e6) { setPhotoErr("That photo didn't work. Take it again with the camera."); return; }
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto({ file: small, url: URL.createObjectURL(small), at: Date.now() });
  }

  /** The photo goes to storage under this try's name. Throws with no signal. */
  async function sendPhoto(started: string): Promise<string | undefined> {
    if (!photo) return undefined;
    const startedMs = Date.parse(started);
    const path = `${companyId}/loadout/${truck.id}/${startedMs}-${Math.max(photo.at, startedMs)}.jpg`;
    const sb = getBrowserSupabase();
    if (!sb) throw new Error("no client");
    const { error } = await sb.storage.from("proofs").upload(path, photo.file, { upsert: false, contentType: "image/jpeg" });
    if (error && !/exists|duplicate/i.test(error.message)) throw error;
    return path;
  }

  const ready = () => start(async () => {
    setErr("");
    try {
      const photoPath = await sendPhoto(startedAt);
      const res = await finishQuickCheck({ unitId: truck.id, startedAt, packageIds: picked.filter((id) => !locked.includes(id)), confirmed, checks, photoPath, job: job.trim() || undefined, savedAt: Date.now() });
      if (!res.ok) {
        setErr(res.error ?? "Couldn't save that.");
        if (res.stale) { try { localStorage.removeItem(draftKey(truck.id)); } catch { /* storage off */ } }
        return;
      }
      setResult(res);
      try { localStorage.removeItem(draftKey(truck.id)); } catch { /* storage off */ }
    } catch {
      setErr("No signal. Your taps are saved on this phone. Tap Ready again when you have signal.");
    }
  });

  /** NOT READY: back to the list as it was. The next Ready is a new try on the record. */
  const fixIt = () => {
    tries.current += 1;
    setStartedAt(new Date(Date.parse(startedAt) + tries.current).toISOString());
    setResult(null); setErr("");
  };

  if (result?.ok) {
    const good = result.verdict === "ready";
    const link = result.proofToken ? `${typeof window !== "undefined" ? window.location.origin : "https://www.synnr.io"}/l/${result.proofToken}` : null;
    return (
      <div className="flex flex-col gap-4">
        <div className={cn("rounded-2xl border p-5", good ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/50 bg-red-500/10")}>
          <div className={cn("flex items-center gap-2 text-2xl font-bold", good ? "text-emerald-400" : "text-red-400")}>
            {good ? <ShieldCheck className="h-7 w-7" /> : <TriangleAlert className="h-7 w-7" />}{good ? "READY" : "NOT READY"}
          </div>
          <p className="mt-1 text-sm text-ink-dim">{good ? `${truck.name} can roll. Your name and the time are on the record, and nobody can change it.` : `${truck.name} can't roll yet. The record is saved.`}</p>
          {!good && result.reasons?.length ? <ul className="mt-2 list-disc pl-5 text-sm text-red-400">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
        </div>
        {good && link ? (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-sm font-semibold">Proof link for the operator</div>
            <div className="mt-1 break-all text-[13px] text-ink-dim">{link}</div>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(link).catch(() => {}); }} className={buttonClass("outline", "default", "mt-2 min-h-11")}>Copy link</button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {!good ? <button type="button" onClick={fixIt} className={buttonClass("default", "lg", "h-14 text-base")}>Fix it</button> : null}
          {result.id ? <Link href={`/app/loadouts/${result.id}`} className={buttonClass(good ? "default" : "outline", "lg", "h-14 text-base")}>See the record</Link> : null}
          <Link href="/app" className={buttonClass("outline", "lg", "h-14 text-base")}>Back to trucks</Link>
        </div>
      </div>
    );
  }

  const row = (key: string, label: string, sub: string | null, on: boolean, onTap: () => void, button: string) => (
    <button key={key} type="button" onClick={onTap} aria-pressed={on}
      className={cn("flex min-h-16 w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left",
        on ? "border-emerald-500/60 bg-emerald-500/10" : "border-line-2 bg-surface hover:bg-elevated")}>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2", on ? "border-emerald-400 bg-emerald-500/20 text-emerald-400" : "border-line-2")}>
        {on ? <Check className="h-5 w-5" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-base font-semibold">{label}</span>
        {sub ? <span className="block text-[13px] text-ink-dim">{sub}</span> : null}
      </span>
      <span className={cn("shrink-0 text-sm font-semibold", on ? "text-emerald-400" : "text-bone")}>{on ? "On" : button}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4 pb-28">
      {outNote ? <p className="rounded-xl border border-line-2 bg-surface p-3 text-sm text-ink-dim">{outNote}</p> : null}
      {pickedUp ? <p className="text-sm text-ink-dim">Picked up where you left off on this phone. <button type="button" className="font-semibold text-bone underline" onClick={() => { try { localStorage.removeItem(draftKey(truck.id)); } catch { /* storage off */ } setConfirmed({}); setChecks([]); setPickedUp(false); setStartedAt(nowIso()); }}>Start over</button></p> : null}

      {packages.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">What job?{plan ? ` Planned by ${plan.by ?? "a manager"}.` : ""}</h2>
          <div className="flex flex-wrap gap-2">
            {packages.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => togglePkg(p.id)} disabled={locked.includes(p.id)} aria-pressed={on}
                  className={cn("min-h-12 rounded-full border-2 px-4 text-sm font-semibold", on ? "border-bone bg-bone/15 text-bone" : "border-line-2 text-ink", locked.includes(p.id) && "opacity-90")}>
                  {p.name}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {showJob ? (
        <input value={job} onChange={(e) => setJob(e.target.value.slice(0, 120))} placeholder="Job or well, like University 7-12 #3H" aria-label="Job or well"
          className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
      ) : (
        <button type="button" onClick={() => setShowJob(true)} className="self-start text-sm font-semibold text-bone underline">Add the job or well name (optional)</button>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink-dim">On the truck</h2>
        {lines.length === 0 ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">{truck.name} has no list yet. A manager sets it under Truck lists.</p>
        ) : lines.map((l) => {
          const on = (confirmed[quickKey(l)] ?? 0) >= l.qty;
          return row(quickKey(l), `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`, l.source === "kit" ? null : l.source === "plan" ? "Planned for this job" : l.package ?? null, on, () => toggle(l), l.qty > 1 ? `All ${l.qty} on` : "On truck");
        })}
        {askChecks.map((c) => row(`check:${c}`, c, "Before it rolls", checks.includes(c.toLowerCase()), () => toggleCheck(c), "Done"))}
      </section>

      {photoRule !== "off" ? (
        <section className="flex flex-col gap-2">
          <label className={cn("flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 px-4", photo ? "border-emerald-500/60 bg-emerald-500/10" : "border-line-2 bg-surface")}>
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={takePhoto} />
            {/* eslint-disable-next-line @next/next/no-img-element -- a local photo that hasn't been sent yet */}
            {photo ? <img src={photo.url} alt="The loaded truck" className="h-12 w-16 rounded object-cover" /> : <Camera className="h-6 w-6 text-bone" />}
            <span className="text-base font-semibold">{photo ? "Photo of the loaded truck. Tap to take it again." : `Photo of the loaded truck${photoRule === "optional" ? " (optional in the demo)" : ""}`}</span>
          </label>
          {photoErr ? <p className="text-sm text-amber-400">{photoErr}</p> : null}
        </section>
      ) : null}

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 flex flex-col gap-1 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <button type="button" onClick={ready} disabled={pending} className={buttonClass("default", "lg", "h-14 w-full text-lg")}>{pending ? "Saving…" : "Ready"}</button>
        <p className={cn("text-center text-[13px]", err || left ? "text-amber-400" : "text-ink-dim")}>
          {err || (left ? `${left} still to go. You can save it, but it reads NOT READY.` : "Everything's on. Tap Ready.")}
        </p>
      </div>
    </div>
  );
}
