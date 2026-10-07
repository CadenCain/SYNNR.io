"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Nfc, Camera, Check, X, ScanLine } from "lucide-react";
import { identifyScan, scanMessage, type ScanHow, type ScanPiece } from "@/lib/saas/loadout";
import { linkTag, finishLoadout } from "./actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The load-out scan. The hand taps each piece's tag (NFC on Android) or
 * scans its QR code (any phone) as it goes on the truck. Anything out of
 * test, red-tagged, or not on this truck's list is called out right then.
 * Pieces nobody scanned get sorted at the end: left on, moved to the yard,
 * or flagged missing. The scan is the proof of what actually went out.
 */

interface NdefRecordLike { recordType: string; data?: DataView; encoding?: string }
interface NdefReadingLike { serialNumber: string; message: { records: NdefRecordLike[] } }
interface NdefScanner {
  scan(options?: { signal?: AbortSignal }): Promise<void>;
  onreading: ((e: NdefReadingLike) => void) | null;
  onreadingerror: (() => void) | null;
}
type NdefCtor = new () => NdefScanner;
const ndef = (): NdefCtor | null =>
  typeof window !== "undefined" && "NDEFReader" in window ? (window as unknown as { NDEFReader: NdefCtor }).NDEFReader : null;
const noSubscribe = () => () => {};
const useHasNfc = () => useSyncExternalStore(noSubscribe, () => ndef() !== null, () => false);

type Scan = { how: ScanHow; at: number };
type Outcome = "left" | "yard" | "missing";
const HOW: Record<ScanHow, string> = { nfc: "NFC tap", qr: "QR", hand: "checked by hand" };
const TONE = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  bad: "border-red-500/50 bg-red-500/10 text-red-400",
};
const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export default function LoadoutScanner({ truck, pieces }: { truck: { id: string; name: string }; pieces: ScanPiece[] }) {
  const hasNfc = useHasNfc();
  const [startedAt] = useState(() => new Date().toISOString());
  const [list, setList] = useState(pieces); // local copy so a newly linked tag works on the next scan
  const [scans, setScans] = useState<Record<string, Scan>>({});
  const [banner, setBanner] = useState<{ tone: keyof typeof TONE; text: string } | null>(null);
  const [pendingLink, setPendingLink] = useState<{ extTag: string; how: ScanHow } | null>(null);
  const [linkChoice, setLinkChoice] = useState("");
  const [serialText, setSerialText] = useState("");
  const [nfcOn, setNfcOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState("");

  const nfcAbort = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastCode = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  // The handler a scanner calls must see the latest state.
  const handleRef = useRef<(i: { link: string | null; chipId: string | null; how: ScanHow }) => void>(() => {});

  const expected = useMemo(() => list.filter((p) => p.unitId === truck.id), [list, truck.id]);
  const added = useMemo(() => list.filter((p) => p.unitId !== truck.id && scans[p.id]), [list, scans, truck.id]);
  const scannedExpected = expected.filter((p) => scans[p.id]).length;

  function markScanned(piece: ScanPiece, how: ScanHow) {
    const already = Boolean(scans[piece.id]);
    const msg = scanMessage({ kind: "match", piece, onTruck: piece.unitId === truck.id }, truck.name, already);
    setBanner(msg);
    if (!already) setScans((s) => ({ ...s, [piece.id]: { how, at: Date.now() } }));
    try { navigator.vibrate?.(msg.tone === "good" ? 80 : [120, 80, 120]); } catch { /* no vibration */ }
  }

  function handleScan(input: { link: string | null; chipId: string | null; how: ScanHow }) {
    const r = identifyScan(input, list, truck.id);
    if (r.kind === "match") { markScanned(r.piece, input.how); return; }
    if (r.kind === "unknown") {
      setPendingLink({ extTag: r.extTag, how: input.how });
      setLinkChoice("");
      setBanner({ tone: "warn", text: "New tag. Pick the piece it's on, and it'll be recognized from now on." });
      return;
    }
    setBanner({ tone: "warn", text: r.text });
  }
  useEffect(() => { handleRef.current = handleScan; });

  async function startNfc() {
    const Ctor = ndef();
    if (!Ctor) return;
    nfcAbort.current?.abort();
    const ac = new AbortController();
    nfcAbort.current = ac;
    try {
      const reader = new Ctor();
      reader.onreading = (e) => {
        let link: string | null = null;
        for (const rec of e.message.records) {
          if (!rec.data) continue;
          if (rec.recordType === "url" || rec.recordType === "absolute-url") link = new TextDecoder().decode(rec.data);
          else if (rec.recordType === "text" && !link) link = new TextDecoder(rec.encoding || "utf-8").decode(rec.data);
        }
        handleRef.current({ link, chipId: e.serialNumber || null, how: "nfc" });
      };
      reader.onreadingerror = () => setBanner({ tone: "warn", text: "Couldn't read that tag. Hold it still against the back of the phone." });
      await reader.scan({ signal: ac.signal });
      setNfcOn(true);
      setBanner({ tone: "good", text: "Ready. Tap each piece's tag to the back of the phone." });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setBanner({ tone: "bad", text: name === "NotAllowedError" ? "The phone said no to NFC. Allow it for this site in Chrome's settings." : "NFC is off or not available. Turn on NFC in the phone's settings, or scan QR codes." });
    }
  }
  function stopNfc() { nfcAbort.current?.abort(); setNfcOn(false); }

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      setCamOn(true);
    } catch {
      setBanner({ tone: "bad", text: "Couldn't open the camera. Allow camera access for this site, then try again." });
    }
  }
  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamOn(false);
  }

  // Read QR codes off the camera while it's on.
  useEffect(() => {
    if (!camOn || !video.current || !stream.current) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const v = video.current;
    v.srcObject = stream.current;
    void v.play().catch(() => {});
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      const jsQR = (await import("jsqr")).default;
      const tick = () => {
        if (stop) return;
        if (ctx && v.readyState >= 2 && v.videoWidth) {
          const w = 640, h = Math.round((v.videoHeight / v.videoWidth) * 640);
          canvas.width = w; canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const now = Date.now();
            if (code.data !== lastCode.current.text || now - lastCode.current.at > 3000) {
              lastCode.current = { text: code.data, at: now };
              handleRef.current({ link: code.data, chipId: null, how: "qr" });
            }
          }
        }
        timer = setTimeout(tick, 220);
      };
      tick();
    })();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [camOn]);

  useEffect(() => () => { nfcAbort.current?.abort(); stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  async function doLink() {
    if (!pendingLink || !linkChoice) return;
    const res = await linkTag({ assetId: linkChoice, extTag: pendingLink.extTag });
    if (!res.ok) { setBanner({ tone: "bad", text: res.error ?? "Couldn't link that tag." }); return; }
    const piece = list.find((p) => p.id === linkChoice);
    setList((l) => l.map((p) => (p.id === linkChoice ? { ...p, extTag: pendingLink.extTag } : p)));
    if (piece) markScanned({ ...piece, extTag: pendingLink.extTag }, pendingLink.how);
    setPendingLink(null);
  }

  function addBySerial() {
    const want = serialText.trim().toLowerCase();
    if (!want) return;
    const piece = list.find((p) => (p.serial ?? "").toLowerCase() === want);
    if (!piece) { setBanner({ tone: "warn", text: `No piece with serial ${serialText.trim()}. Check the stamp and try again.` }); return; }
    markScanned(piece, "hand");
    setSerialText("");
  }

  async function save() {
    setSaving(true); setSaveErr("");
    const notScanned = expected.filter((p) => !scans[p.id]).map((p) => ({ assetId: p.id, outcome: outcomes[p.id] ?? "left" as Outcome }));
    const res = await finishLoadout({
      unitId: truck.id, startedAt,
      scans: Object.entries(scans).map(([assetId, s]) => ({ assetId, how: s.how })),
      notScanned,
    });
    setSaving(false);
    if (!res.ok) { setSaveErr(res.error ?? "Couldn't save the load-out."); return; }
    stopNfc(); stopCamera();
    setSaved(res.summary ?? "Saved.");
  }

  if (saved) {
    return (
      <div className="flex flex-col gap-4">
        <div className={cn("rounded-2xl border p-5", TONE.good)}>
          <div className="flex items-center gap-2 text-lg font-semibold"><Check className="h-5 w-5" /> Load-out saved</div>
          <p className="mt-1 text-sm text-ink-dim">{saved}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/units/${truck.id}/dispatch`} className={buttonClass("default")}>Run the readiness check</Link>
          <Link href={`/app/units/${truck.id}`} className={buttonClass("outline")}>Back to {truck.name}</Link>
          <Link href="/app/map" className={buttonClass("outline")}>Yard map</Link>
        </div>
      </div>
    );
  }

  const redScanned = list.filter((p) => scans[p.id] && p.problem === "red");
  const notYet = expected.filter((p) => !scans[p.id]);

  return (
    <div className="flex flex-col gap-5">
      {banner ? (
        <div role="status" aria-live="polite" className={cn("rounded-2xl border px-4 py-3.5 text-base font-semibold", TONE[banner.tone])}>{banner.text}</div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm text-ink-dim">
          Scan each piece as it goes on {truck.name}. Anything out of test or not on this truck&apos;s list gets called out right away.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {hasNfc ? (
          nfcOn
            ? <button type="button" onClick={stopNfc} className={buttonClass("outline")}><Nfc className="h-4 w-4 animate-pulse text-bone" /> Listening for tags (stop)</button>
            : <button type="button" onClick={startNfc} className={buttonClass("default")}><Nfc className="h-4 w-4" /> Tap tags (NFC)</button>
        ) : null}
        {camOn
          ? <button type="button" onClick={stopCamera} className={buttonClass("outline")}><X className="h-4 w-4" /> Stop camera</button>
          : <button type="button" onClick={startCamera} className={buttonClass(hasNfc ? "outline" : "default")}><Camera className="h-4 w-4" /> Scan QR codes</button>}
      </div>
      {!hasNfc ? <p className="-mt-2 text-xs text-ink-faint">NFC tapping works in Chrome on Android. On this device, scan QR codes or check pieces by hand.</p> : null}

      {camOn ? (
        <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-black">
          <video ref={video} playsInline muted className="aspect-[3/4] w-full object-cover" />
          <ScanLine className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-white/60" />
        </div>
      ) : null}

      {pendingLink ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="font-semibold">New tag. Which piece is it on?</div>
          <p className="text-sm text-ink-dim">Probably your testing company&apos;s tag. Link it once and RollReady knows it from now on.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)} aria-label="Piece this tag is on"
              className="h-11 w-full min-w-0 grow rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-bone">
              <option value="">Pick the piece…</option>
              <optgroup label={`On ${truck.name}`}>
                {expected.map((p) => <option key={p.id} value={p.id}>{p.name}{p.serial ? ` ${p.serial}` : ""}</option>)}
              </optgroup>
              <optgroup label="Everything else">
                {list.filter((p) => p.unitId !== truck.id).map((p) => <option key={p.id} value={p.id}>{p.name}{p.serial ? ` ${p.serial}` : ""} ({p.where})</option>)}
              </optgroup>
            </select>
            <button type="button" onClick={doLink} disabled={!linkChoice} className={buttonClass("default")}>Link it</button>
            <button type="button" onClick={() => setPendingLink(null)} className={buttonClass("ghost")}>Skip</button>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-dim">On {truck.name}&apos;s list</h2>
          <span className="text-sm tabular-nums text-ink-dim">{scannedExpected} of {expected.length} scanned</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
          <div className="h-full rounded-full bg-bone transition-all" style={{ width: `${expected.length ? (scannedExpected / expected.length) * 100 : 0}%` }} />
        </div>
        {expected.length === 0 ? <p className="text-sm text-ink-faint">Nothing is logged on {truck.name} yet. Scan what goes on and it gets added.</p> : null}
        {expected.map((p) => <Row key={p.id} p={p} scan={scans[p.id]} onHand={() => markScanned(p, "hand")} />)}
      </section>

      {added.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Going on {truck.name} (logged somewhere else)</h2>
          {added.map((p) => <Row key={p.id} p={p} scan={scans[p.id]} onHand={() => {}} />)}
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={serialText} onChange={(e) => setSerialText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBySerial(); }}
          placeholder="Can't scan it? Type the serial" aria-label="Serial number"
          className="h-11 w-full min-w-0 grow rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-bone" />
        <button type="button" onClick={addBySerial} className={buttonClass("outline")}>Add</button>
      </div>

      {!finishing ? (
        <button type="button" onClick={() => setFinishing(true)} className={buttonClass("default", "lg", "w-full sm:w-auto sm:self-start")}>Done loading</button>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Before you save</h2>
          {redScanned.length > 0 && (
            <p className={cn("rounded-lg border px-3 py-2 text-sm", TONE.bad)}>
              {`Out of test or red-tagged and scanned on: ${redScanned.map((p) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`).join(", ")}. ${truck.name} will read NOT READY until that's fixed or it comes off.`}
            </p>
          )}
          {notYet.length === 0 ? (
            <p className="text-sm text-ink-dim">Everything on {truck.name}&apos;s list got scanned.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-dim">These are on {truck.name}&apos;s list but didn&apos;t get scanned. Where are they?</p>
              {notYet.map((p) => (
                <label key={p.id} className="flex flex-col gap-1 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words text-sm font-medium">{p.name}{p.serial ? ` ${p.serial}` : ""}</span>
                  <select value={outcomes[p.id] ?? "left"} onChange={(e) => setOutcomes((o) => ({ ...o, [p.id]: e.target.value as Outcome }))}
                    className="h-10 rounded-lg border border-line-2 bg-surface px-2 text-sm text-ink outline-none focus:border-bone">
                    <option value="left">On the truck, just didn&apos;t scan</option>
                    <option value="yard">Not going this trip (move to the yard)</option>
                    <option value="missing">Can&apos;t find it (flag missing)</option>
                  </select>
                </label>
              ))}
            </div>
          )}
          {saveErr ? <p className="text-sm text-red-400">{saveErr}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className={buttonClass("default")}>{saving ? "Saving…" : "Save load-out"}</button>
            <button type="button" onClick={() => setFinishing(false)} className={buttonClass("ghost")}>Keep scanning</button>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ p, scan, onHand }: { p: ScanPiece; scan?: Scan; onHand: () => void }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3",
      scan ? (p.problem === "red" ? TONE.bad : "border-emerald-500/40 bg-emerald-500/[0.06]") : "border-line bg-surface")}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
        scan ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-line-2 text-ink-faint")}>
        {scan ? <Check className="h-4 w-4" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold text-ink">{p.name}{p.serial ? <span className="font-normal text-ink-dim"> · {p.serial}</span> : null}</div>
        <div className={cn("break-words text-[13px]", p.problem === "red" ? "text-red-400" : p.problem === "yellow" ? "text-amber-400" : "text-ink-dim")}>
          {p.statusText}{scan ? <span className="text-ink-faint"> · {HOW[scan.how]} {clock(scan.at)}</span> : null}
        </div>
      </div>
      {!scan ? (
        <button type="button" onClick={onHand} className="shrink-0 rounded-lg border border-line-2 px-2.5 py-1.5 text-xs text-ink-dim hover:bg-elevated">Check by hand</button>
      ) : null}
    </div>
  );
}
