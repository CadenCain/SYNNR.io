"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Nfc, Camera, Check, X, ScanLine, Truck, Warehouse } from "lucide-react";
import { readScan, type ScanHow, type ScanPiece } from "@/lib/saas/loadout";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTagReader, type ReaderNote } from "../_components/use-tag-reader";
import { checkable, maskSerial, lastFourMatch } from "../_components/serial-check";
import { finishReturn, type ReturnDest } from "./actions";

/**
 * Checking iron back in. With a truck: everything that went out on it is
 * listed, and each piece scanned goes back on the truck or off into the yard
 * at a rack. Without one: scan loose iron into the yard (a hotshot, the
 * testing company's truck). Scans live on the phone until saved, so a dead
 * zone never loses them, and they send by themselves when signal is back.
 */

type Scan = { how: ScanHow; at: number; to: ReturnDest; rack: string; proof?: string };
type Outcome = "still_out" | "missing";
type Draft = { startedAt: string; scans: Record<string, Scan>; outcomes: Record<string, Outcome>; savedAt: number };

const TONE = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  bad: "border-red-500/50 bg-red-500/10 text-red-400",
};
const HOW: Record<ScanHow, string> = { nfc: "NFC tap", qr: "QR", hand: "checked by hand" };
const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const noSubscribe = () => () => {};
const draftKey = (k: string) => `rr-return-${k}`;
const readDraftRaw = (k: string): string | null => {
  try {
    const raw = localStorage.getItem(draftKey(k));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return Date.now() - d.savedAt < 18 * 3600e3 && Object.keys(d.scans ?? {}).length ? raw : null;
  } catch { return null; }
};

export default function ReturnScanner({ truck, pieces, outDays, yards, defaultYardId, alertDays = 7, demo = false }: {
  truck: { id: string; name: string } | null;
  pieces: ScanPiece[];
  /** Days out, for pieces out on a job. */
  outDays: Record<string, number>;
  yards: { id: string; name: string }[];
  defaultYardId: string | null;
  /** Out this many days or more reads red. */
  alertDays?: number;
  demo?: boolean;
}) {
  const key = truck?.id ?? "yard";
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [scans, setScans] = useState<Record<string, Scan>>({});
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [dest, setDest] = useState<ReturnDest>(truck ? "truck" : "yard");
  const [yardId, setYardId] = useState(defaultYardId ?? yards[0]?.id ?? "");
  const [rack, setRack] = useState("");
  const [banner, setBanner] = useState<ReaderNote | null>(null);
  const [serialText, setSerialText] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState("");
  const [waiting, setWaiting] = useState(false);
  const draftRaw = useSyncExternalStore(noSubscribe, () => readDraftRaw(key), () => null);
  const [draftHandled, setDraftHandled] = useState(false);
  const draft = useMemo<Draft | null>(() => { try { return draftRaw ? JSON.parse(draftRaw) as Draft : null; } catch { return null; } }, [draftRaw]);

  // What should come back: the truck's iron, or (no truck) everything out on a job.
  const expected = useMemo(() => truck ? pieces.filter((p) => p.unitId === truck.id) : pieces.filter((p) => outDays[p.id] !== undefined)
    .sort((a, b) => (outDays[b.id] ?? 0) - (outDays[a.id] ?? 0)), [pieces, truck, outDays]);
  const extra = pieces.filter((p) => scans[p.id] && !expected.some((e) => e.id === p.id));
  const yardName = yards.find((y) => y.id === yardId)?.name ?? "the yard";
  const destText = (s: Scan) => s.to === "truck" && truck ? `back on ${truck.name}` : `into ${yardName}${s.rack ? `, ${s.rack}` : ""}`;

  function mark(p: ScanPiece, how: ScanHow, proof?: string) {
    const already = Boolean(scans[p.id]);
    const s: Scan = { how, at: Date.now(), to: dest, rack: dest === "yard" ? rack.trim() : "", ...(proof ? { proof } : {}) };
    if (!already) setScans((x) => ({ ...x, [p.id]: s }));
    const label = `${p.name}${p.serial ? ` ${p.serial}` : ""}`;
    setBanner(already ? { tone: "warn", text: `${label} is already checked in.` }
      : p.problem === "red" ? { tone: "bad", text: `${label} is back, ${destText(s)}. ${p.statusText}. It can't go out again until that's fixed.` }
      : { tone: "good", text: `${label}: ${destText(s)}.` });
    try { navigator.vibrate?.(p.problem === "red" ? [120, 80, 120] : 80); } catch { /* no vibration */ }
  }
  async function onReadTag(r: { link: string | null; chipId: string | null; how: ScanHow }) {
    const hit = await readScan(r, pieces, truck?.id ?? "");
    if (hit.kind === "match") { mark(hit.piece, r.how, hit.proof); return; }
    if (hit.kind === "unknown") { setBanner({ tone: "warn", text: "That tag isn't linked to a piece yet. Type the serial below, and link the tag on the next load-out." }); return; }
    setBanner({ tone: "warn", text: hit.text });
  }
  const onRead = (r: { link: string | null; chipId: string | null; how: ScanHow }) => { void onReadTag(r); };
  const { hasNfc, nfcOn, camOn, startNfc, stopNfc, startCamera, stopCamera, video, stopAll } = useTagReader(onRead, setBanner);

  function bySerial() {
    const want = serialText.trim().toLowerCase();
    if (!want) return;
    const p = pieces.find((x) => (x.serial ?? "").toLowerCase() === want);
    if (!p) { setBanner({ tone: "warn", text: `No piece with serial ${serialText.trim()}. Check the stamp and try again.` }); return; }
    mark(p, "hand"); setSerialText("");
  }
  const flip = (id: string) => setScans((x) => {
    const s = x[id]; if (!s || !truck) return x;
    return { ...x, [id]: s.to === "truck" ? { ...s, to: "yard", rack: rack.trim() } : { ...s, to: "truck", rack: "" } };
  });

  useEffect(() => {
    if (saved || Object.keys(scans).length === 0) return;
    try { localStorage.setItem(draftKey(key), JSON.stringify({ startedAt, scans, outcomes, savedAt: Date.now() } satisfies Draft)); } catch { /* storage off */ }
  }, [scans, outcomes, startedAt, saved, key]);

  async function save() {
    setSaving(true); setSaveErr("");
    let res: Awaited<ReturnType<typeof finishReturn>>;
    try {
      res = await finishReturn({
        unitId: truck?.id ?? null, yardId: yardId || null, startedAt,
        scans: Object.entries(scans).map(([assetId, s]) => ({ assetId, how: s.how, at: s.at, to: s.to, rack: s.rack, proof: s.proof })),
        notReturned: truck ? expected.filter((p) => !scans[p.id]).map((p) => ({ assetId: p.id, outcome: outcomes[p.id] ?? "still_out" })) : [],
      });
    } catch {
      setSaving(false); setWaiting(true);
      setSaveErr("No signal. Your check-in is saved on this phone and will send by itself when you have signal.");
      return;
    }
    setSaving(false);
    if (!res.ok) { setSaveErr(res.error ?? "Couldn't save the check-in."); return; }
    setWaiting(false);
    try { localStorage.removeItem(draftKey(key)); } catch { /* storage off */ }
    stopAll();
    setSaved(res.summary ?? "Checked in.");
  }
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!waiting) return;
    const retry = () => { void saveRef.current(); };
    window.addEventListener("online", retry);
    const t = setInterval(() => { if (navigator.onLine) retry(); }, 30000);
    return () => { window.removeEventListener("online", retry); clearInterval(t); };
  }, [waiting]);

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <div className={cn("rounded-2xl border p-5", TONE.good)}>
          <div className="flex items-center gap-2 text-2xl font-bold"><Check className="h-7 w-7" /> Checked in</div>
          <p className="mt-1 text-base text-ink">{saved}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Link href="/app" className={buttonClass("default", "lg", "h-14 text-base")}>Back to Load out</Link>
          {truck ? <Link href={`/app/units/${truck.id}/scan`} className={buttonClass("outline", "lg", "h-14 text-base")}><ScanLine className="h-5 w-5" /> Load {truck.name} out again</Link> : null}
        </div>
      </div>
    );
  }

  const scannedExpected = expected.filter((p) => scans[p.id]).length;
  const notYet = expected.filter((p) => !scans[p.id]);
  const field = "h-12 w-full min-w-0 rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-bone";

  return (
    <div className="flex flex-col gap-5">
      {draft && !draftHandled && Object.keys(scans).length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="font-semibold">There&apos;s an unsaved check-in on this phone</div>
          <p className="text-sm text-ink-dim">{Object.keys(draft.scans).length} pieces scanned, last at {clock(draft.savedAt)}.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setScans(draft.scans); setOutcomes(draft.outcomes ?? {}); setStartedAt(draft.startedAt); setDraftHandled(true); }} className={buttonClass("default", "lg")}>Pick it back up</button>
            <button type="button" onClick={() => { try { localStorage.removeItem(draftKey(key)); } catch { /* */ } setDraftHandled(true); }} className={buttonClass("ghost", "lg")}>Start over</button>
          </div>
        </div>
      ) : null}

      {/* Where scanned iron goes. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-base font-semibold">Where is it going?</h2>
        {truck ? (
          <div className="grid grid-cols-2 gap-2">
            {(["truck", "yard"] as const).map((d) => (
              <button key={d} type="button" onClick={() => setDest(d)} aria-pressed={dest === d}
                className={cn("flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 text-base font-semibold",
                  dest === d ? "border-bone bg-bone/10 text-bone" : "border-line-2 text-ink-dim")}>
                {d === "truck" ? <Truck className="h-5 w-5" /> : <Warehouse className="h-5 w-5" />}
                {d === "truck" ? <span>Back on <span className="whitespace-nowrap">{truck.name}</span></span> : "Into the yard"}
              </button>
            ))}
          </div>
        ) : null}
        {dest === "yard" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {yards.length > 1 ? (
              <select value={yardId} onChange={(e) => setYardId(e.target.value)} aria-label="Yard" className={field}>
                {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            ) : null}
            <input value={rack} onChange={(e) => setRack(e.target.value.slice(0, 80))} placeholder="Rack or spot, like rack 2 or by the wash bay" aria-label="Rack or spot" className={field} />
          </div>
        ) : null}
        <p className="text-sm text-ink-dim">Every piece you scan goes {dest === "truck" && truck ? `back on ${truck.name}` : `into ${yardName}${rack.trim() ? `, ${rack.trim()}` : ""}`}. You can switch any time.</p>
      </section>

      {banner ? (
        <div role="status" aria-live="polite" className={cn("rounded-2xl border px-4 py-4 text-lg font-semibold leading-snug", TONE[banner.tone])}>{banner.text}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {hasNfc ? (
          nfcOn
            ? <button type="button" onClick={stopNfc} className={buttonClass("outline", "lg", "h-14 text-base")}><Nfc className="h-5 w-5 animate-pulse text-bone" /> Listening for tags (stop)</button>
            : <button type="button" onClick={startNfc} className={buttonClass("default", "lg", "h-14 text-base")}><Nfc className="h-5 w-5" /> Tap tags (NFC)</button>
        ) : null}
        {camOn
          ? <button type="button" onClick={stopCamera} className={buttonClass("outline", "lg", "h-14 text-base")}><X className="h-5 w-5" /> Stop camera</button>
          : <button type="button" onClick={startCamera} className={buttonClass(hasNfc ? "outline" : "default", "lg", "h-14 text-base")}><Camera className="h-5 w-5" /> Scan QR codes</button>}
      </div>
      {camOn ? (
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-black">
          <video ref={video} playsInline muted className="aspect-[3/4] w-full object-cover" />
          <ScanLine className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-white/60" />
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-dim">{truck ? `Went out on ${truck.name}` : "Out on jobs"}</h2>
          <span className="text-sm tabular-nums text-ink-dim">{scannedExpected} of {expected.length} back</span>
        </div>
        {expected.length === 0 ? <p className="text-sm text-ink-faint">{truck ? `Nothing is logged on ${truck.name}.` : "Nothing is out on a job right now."} Scan anything that came back and it gets checked in.</p> : null}
        {expected.map((p) => (
          <Row key={p.id} p={p} scan={scans[p.id]} days={outDays[p.id]} alertDays={alertDays} demo={demo} destText={scans[p.id] ? destText(scans[p.id]) : ""}
            onHand={() => mark(p, "hand")} onFlip={truck ? () => flip(p.id) : undefined} />
        ))}
      </section>
      {extra.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Also came back</h2>
          {extra.map((p) => <Row key={p.id} p={p} scan={scans[p.id]} days={outDays[p.id]} alertDays={alertDays} demo={demo} destText={destText(scans[p.id])} onHand={() => {}} onFlip={truck ? () => flip(p.id) : undefined} />)}
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={serialText} onChange={(e) => setSerialText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") bySerial(); }}
          placeholder="Can't scan it? Type the serial" aria-label="Serial number" className={field} />
        <button type="button" onClick={bySerial} className={buttonClass("outline", "lg")}>Add</button>
      </div>

      {finishing ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Before you save</h2>
          {truck && notYet.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-dim">These went out on {truck.name} but didn&apos;t get scanned back. Where are they?</p>
              {notYet.map((p) => (
                <label key={p.id} className="flex flex-col gap-1 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words text-sm font-medium">{p.name}{p.serial ? ` ${!demo && checkable(p.serial) ? maskSerial(p.serial) : p.serial}` : ""}</span>
                  <select value={outcomes[p.id] ?? "still_out"} onChange={(e) => setOutcomes((o) => ({ ...o, [p.id]: e.target.value as Outcome }))}
                    className="h-12 rounded-lg border border-line-2 bg-surface px-2 text-base text-ink outline-none focus:border-bone">
                    <option value="still_out">Still out on the job</option>
                    <option value="missing">Can&apos;t find it (flag missing)</option>
                  </select>
                </label>
              ))}
            </div>
          ) : <p className="text-sm text-ink-dim">{Object.keys(scans).length} {Object.keys(scans).length === 1 ? "piece" : "pieces"} checked in.</p>}
          {saveErr ? <p className={cn("text-sm", waiting ? "text-amber-400" : "text-red-400")}>{saveErr}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className={buttonClass("default", "lg", "h-14 text-base")}>{saving ? "Saving…" : waiting ? "Try sending now" : "Save check-in"}</button>
            <button type="button" onClick={() => setFinishing(false)} className={buttonClass("outline", "lg", "h-14 text-base")}>Keep scanning</button>
          </div>
        </section>
      ) : null}

      {/* Always in reach: how many are back, and Done. */}
      {!finishing ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm"><span className="text-lg font-bold tabular-nums">{Object.keys(scans).length}</span> checked in{expected.length ? <span className="text-ink-dim"> · {notYet.length} not back yet</span> : null}</div>
            <button type="button" onClick={() => setFinishing(true)} disabled={Object.keys(scans).length === 0 && notYet.length === 0}
              className={buttonClass("default", "lg", "h-14 px-6 text-base")}>Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ p, scan, days, alertDays, demo, destText, onHand, onFlip }: {
  p: ScanPiece; scan?: Scan; days?: number; alertDays: number; demo: boolean; destText: string; onHand: () => void; onFlip?: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const needsSerial = !demo && checkable(p.serial);
  function check() {
    if (!needsSerial) { onHand(); return; }
    if (!asking) { setAsking(true); return; }
    if (lastFourMatch(typed, p.serial!)) { setAsking(false); setTyped(""); setErr(""); onHand(); }
    else setErr("That's not it. Read the last 4 off the band or the stamp.");
  }
  const shown = p.serial ? (!scan && needsSerial ? maskSerial(p.serial) : p.serial) : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3",
      scan ? (p.problem === "red" ? TONE.bad : "border-emerald-500/40 bg-emerald-500/[0.06]") : "border-line bg-surface")}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
        scan ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-line-2 text-ink-faint")}>
        {scan ? <Check className="h-4 w-4" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold text-ink">{p.name}{shown ? <span className="font-normal text-ink-dim"> · {shown}</span> : null}</div>
        <div className={cn("break-words text-[13px]", scan ? "text-ink-dim" : days !== undefined && days >= alertDays ? "text-red-400" : "text-ink-dim")}>
          {scan ? <>{destText} · {HOW[scan.how]} {clock(scan.at)}</> : <>{days !== undefined ? `${days === 0 ? "Out since today" : `Out ${days} ${days === 1 ? "day" : "days"}`} · ` : ""}{p.where}</>}
          {p.problem === "red" ? <span className="text-red-400"> · {p.statusText}</span> : null}
        </div>
      </div>
      {!scan ? (
        <button type="button" onClick={check} className="min-h-12 w-full shrink-0 rounded-lg border border-line-2 px-4 text-sm text-ink-dim hover:bg-elevated sm:w-auto">
          {asking ? "Check it" : "Check by hand"}
        </button>
      ) : onFlip ? (
        <button type="button" onClick={onFlip} className="min-h-12 w-full shrink-0 rounded-lg border border-line-2 px-4 text-sm text-ink-dim hover:bg-elevated sm:w-auto">
          {destText.startsWith("back on") ? "Into the yard instead" : "Back on the truck instead"}
        </button>
      ) : null}
      {asking && !scan ? (
        <div className="flex w-full flex-col gap-1">
          <label className="text-[13px] text-ink-dim" htmlFor={`r4-${p.id}`}>Last 4 of the serial on the band or the stamp</label>
          <input id={`r4-${p.id}`} value={typed} onChange={(e) => { setTyped(e.target.value.slice(0, 8)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }} autoFocus autoComplete="off" autoCapitalize="characters"
            className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base uppercase tracking-widest text-ink outline-none focus:border-bone" />
          {err ? <p className="text-[13px] text-red-400">{err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
