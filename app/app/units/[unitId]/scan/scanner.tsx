"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Nfc, Camera, Check, X, ScanLine, Plus, ShieldCheck, OctagonX, Lock, ListTodo } from "lucide-react";
import { readScan, scanMessage, type ScanHow, type ScanPiece } from "@/lib/saas/loadout";
import { expectedLines, fillLines, shortLines, needsTagScan, lineSourceLabel } from "@/lib/saas/loadout-lines";
import { TESTED_CATEGORIES } from "@/lib/saas/taxonomy";
import { tagKey } from "@/lib/saas/tag-key";
import { linkTag, finishLoadout } from "./actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
// Loaded with the page (not on first camera use) so QR scanning works on a
// page this phone saved for no signal.
import jsQR from "jsqr";
import ProofLink from "../../../_components/proof-link";

/**
 * The load-out scan. The list comes first: the truck's kit, any packages
 * picked for the job, and quick lines for today. The hand taps each piece's
 * tag (NFC on Android) or scans its QR code (any phone) as it goes on, and
 * the list fills in. Anything out of test, red-tagged, or not on the list is
 * called out right then. At the end, anything short, bad, or missing makes
 * the truck NOT READY. The server works the answer out again from the
 * records, so the phone can't talk it into READY.
 */

export interface KitLine { label: string; qty: number }
export interface PackageOption { id: string; name: string; lines: KitLine[] }

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

/** A piece checked onto the truck. A tag scan carries the code read off the tag, for the server to check. */
export type Scan = { how: ScanHow; at: number; proof?: string };
type Outcome = "yard" | "missing";
const HOW: Record<ScanHow, string> = { nfc: "NFC tap", qr: "QR", hand: "checked by hand" };
const TONE = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  bad: "border-red-500/50 bg-red-500/10 text-red-400",
};
const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Scans live on the phone until the load-out is saved, so a dead zone, a
// dropped call, or a closed tab never loses them.
type Draft = { startedAt: string; scans: Record<string, Scan>; outcomes: Record<string, Outcome>; packageIds?: string[]; quick?: KitLine[]; savedAt: number };
const draftKey = (truckId: string) => `rr-loadout-${truckId}`;
/** The saved draft's raw text if it's from the last 18 hours and has scans, else null. */
const readDraftRaw = (truckId: string): string | null => {
  try {
    const raw = localStorage.getItem(draftKey(truckId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return Date.now() - d.savedAt < 18 * 3600e3 && Object.keys(d.scans ?? {}).length ? raw : null;
  } catch { return null; }
};
const writeDraft = (truckId: string, d: Draft) => { try { localStorage.setItem(draftKey(truckId), JSON.stringify(d)); } catch { /* storage off */ } };
const clearDraft = (truckId: string) => { try { localStorage.removeItem(draftKey(truckId)); } catch { /* storage off */ } };

export interface ScanPlan { by: string | null; at: string; note: string | null; packageIds: string[]; lines: KitLine[] }

export default function LoadoutScanner({ truck, pieces, kit, packages, manager = false, demo = false, lastPackageIds, plan = null, tagRule = false, initialScans, initialBanner, initialPackageIds, previewNfc = false }: {
  truck: { id: string; name: string };
  pieces: ScanPiece[];
  /** The truck's default kit lines (empty if none set). */
  kit: KitLine[];
  /** Packages a hand can add for the job. */
  packages: PackageOption[];
  manager?: boolean;
  /** The demo yard: no iron to read, so checking by hand doesn't ask for the serial. */
  demo?: boolean;
  /** Packages this truck's last load-out used, picked to start with (when nobody planned the job). */
  lastPackageIds?: string[];
  /** A manager's plan for this job: picked to start with, and the hand can't take any of it off. */
  plan?: ScanPlan | null;
  /** The yard scans tags only: pressure iron and anything on the list can't be checked by hand. */
  tagRule?: boolean;
  /** Only for the marketing screenshot: packages already picked. */
  initialPackageIds?: string[];
  /** Only for the marketing screenshot: start partway through a load-out. */
  initialScans?: Record<string, Scan>;
  initialBanner?: { tone: "good" | "warn" | "bad"; text: string };
  /** Only for the marketing screenshot: show the Android (NFC) version of the screen. */
  previewNfc?: boolean;
}) {
  const hasNfcHere = useHasNfc();
  const hasNfc = hasNfcHere || previewNfc;
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  // An unsaved load-out from earlier on this phone (read once, offered to pick back up).
  const draftRaw = useSyncExternalStore(noSubscribe, () => readDraftRaw(truck.id), () => null);
  const [draftHandled, setDraftHandled] = useState(false);
  const draft = useMemo<Draft | null>(() => {
    if (!draftRaw) return null;
    try { return JSON.parse(draftRaw) as Draft; } catch { return null; }
  }, [draftRaw]);
  const [waitingForSignal, setWaitingForSignal] = useState(false);
  const [failsWithSignal, setFailsWithSignal] = useState(0);
  const [list, setList] = useState(pieces); // local copy so a newly linked tag works on the next scan
  const [scans, setScans] = useState<Record<string, Scan>>(initialScans ?? {});
  const [banner, setBanner] = useState<{ tone: keyof typeof TONE; text: string } | null>(initialBanner ?? null);
  const [pendingLink, setPendingLink] = useState<{ extTag: string; how: ScanHow } | null>(null);
  const [linkChoice, setLinkChoice] = useState("");
  const [linkFilter, setLinkFilter] = useState("");
  const [serialText, setSerialText] = useState("");
  const [nfcOn, setNfcOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ id: string; verdict: "ready" | "not_ready"; reasons: string[]; proofToken: string } | null>(null);
  const [saveErr, setSaveErr] = useState("");
  const lockedIds = useMemo(() => plan?.packageIds ?? [], [plan]);
  const [packageIds, setPackageIds] = useState<string[]>(initialPackageIds ?? (plan ? plan.packageIds : lastPackageIds) ?? []);
  // First, what's this job? Then scanning. (Straight to scanning when picking a load-out back up.)
  const [started, setStarted] = useState(Boolean(initialScans));
  const [quick, setQuick] = useState<KitLine[]>([]);
  const [quickLabel, setQuickLabel] = useState("");
  const [quickQty, setQuickQty] = useState("1");

  const nfcAbort = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastCode = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  // The handler a scanner calls must see the latest state.
  const handleRef = useRef<(i: { link: string | null; chipId: string | null; how: ScanHow }) => void>(() => {});
  const handleScanSync = (i: { link: string | null; chipId: string | null; how: ScanHow }) => { void handleScan(i); };

  const expected = useMemo(() => list.filter((p) => p.unitId === truck.id), [list, truck.id]);
  const added = useMemo(() => list.filter((p) => p.unitId !== truck.id && scans[p.id]), [list, scans, truck.id]);
  const scannedExpected = expected.filter((p) => scans[p.id]).length;

  // The list, filled in as pieces get scanned.
  const picked = useMemo(() => packages.filter((x) => packageIds.includes(x.id)), [packages, packageIds]);
  const planned = useMemo(() => plan?.lines ?? [], [plan]);
  const lineLabels = useMemo(() => expectedLines({ kit, packages: picked, planned, quick }).map((l) => l.label), [kit, picked, planned, quick]);
  /** In a scan-only yard: this piece has to be scanned off its tag. */
  const needsTag = (p: ScanPiece) => tagRule && needsTagScan(p, lineLabels, TESTED_CATEGORIES);
  const lines = useMemo(() => fillLines(
    expectedLines({ kit, packages: picked, planned, quick }),
    list.filter((p) => scans[p.id]).sort((a, b) => scans[a.id].at - scans[b.id].at).map((p) => ({ id: p.id, name: p.name, serial: p.serial })),
  ), [kit, picked, planned, quick, list, scans]);
  // A bad piece on a line doesn't make it good: the line reads red until it comes off and a good one goes on.
  const redOnTruck = useMemo(() => new Set(list.filter((p) => scans[p.id] && p.problem === "red").map((p) => p.id)), [list, scans]);
  const lineBad = (l: { filled: { id: string }[] }) => l.filled.some((f) => redOnTruck.has(f.id));
  const linesDone = lines.filter((l) => l.filled.length >= l.qty && !lineBad(l)).length;
  const pieceNames = useMemo(() => [...new Set(list.map((p) => p.name.replace(/\s*#\s*\d+\b/g, "").trim()))].sort((a, b) => a.localeCompare(b)), [list]);

  function markScanned(piece: ScanPiece, how: ScanHow, proof?: string) {
    const already = Boolean(scans[piece.id]);
    const msg = scanMessage({ kind: "match", piece, onTruck: piece.unitId === truck.id }, truck.name, already);
    setBanner(msg);
    if (!already) setScans((s) => ({ ...s, [piece.id]: { how, at: Date.now(), ...(proof ? { proof } : {}) } }));
    try { navigator.vibrate?.(msg.tone === "good" ? 80 : [120, 80, 120]); } catch { /* no vibration */ }
  }

  /** A bad piece came back off the truck: it's not part of this load-out. */
  function takeOff(piece: ScanPiece) {
    setScans((s) => { const n = { ...s }; delete n[piece.id]; return n; });
    if (piece.unitId === truck.id) setOutcomes((o) => ({ ...o, [piece.id]: "yard" }));
    setBanner({ tone: "good", text: `${piece.name}${piece.serial ? ` ${piece.serial}` : ""} is off the truck. Scan the one going in its place.` });
  }

  function addQuick() {
    const label = quickLabel.trim().slice(0, 80);
    if (!label) return;
    const qty = Math.min(99, Math.max(1, Math.floor(Number(quickQty)) || 1));
    setQuick((q) => [...q, { label, qty }]);
    setQuickLabel(""); setQuickQty("1");
  }

  async function handleScan(input: { link: string | null; chipId: string | null; how: ScanHow }) {
    const r = await readScan(input, list, truck.id);
    if (r.kind === "match") { markScanned(r.piece, input.how, r.proof); return; }
    if (r.kind === "unknown") {
      if (tagRule && !manager) {
        setBanner({ tone: "warn", text: "New tag. This yard scans tags only, so a manager has to link it to its piece first." });
        return;
      }
      setPendingLink({ extTag: r.extTag, how: input.how });
      setLinkChoice("");
      setBanner({ tone: "warn", text: "New tag. Pick the piece it's on, and it'll be recognized from now on." });
      return;
    }
    setBanner({ tone: "warn", text: r.text });
  }
  useEffect(() => { handleRef.current = handleScanSync; });

  // Keep the load-out on the phone as it happens.
  useEffect(() => {
    if (saved || Object.keys(scans).length === 0) return;
    writeDraft(truck.id, { startedAt, scans, outcomes, packageIds, quick, savedAt: Date.now() });
  }, [scans, outcomes, packageIds, quick, startedAt, saved, truck.id]);

  function pickUpDraft() {
    if (!draft) return;
    setScans(draft.scans); setOutcomes(draft.outcomes ?? {}); setStartedAt(draft.startedAt);
    setPackageIds([...new Set([...lockedIds, ...(draft.packageIds ?? [])])].filter((id) => packages.some((x) => x.id === id))); setQuick(draft.quick ?? []);
    setStarted(true);
    setDraftHandled(true);
    setBanner({ tone: "good", text: `Picked up where you left off: ${Object.keys(draft.scans).length} scanned.` });
  }
  function dropDraft() { clearDraft(truck.id); setDraftHandled(true); }

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
    (() => {
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
    const piece = list.find((p) => p.id === linkChoice);
    let res: Awaited<ReturnType<typeof linkTag>>;
    try {
      res = await linkTag({ assetId: linkChoice, extTag: pendingLink.extTag });
    } catch {
      // No signal: keep the load-out moving. Count it by hand now; the tag
      // can be linked next time there's signal.
      if (piece) markScanned(piece, "hand");
      setPendingLink(null); setLinkFilter("");
      setBanner({ tone: "warn", text: `No signal to link that tag. ${piece ? `${piece.name}${piece.serial ? ` ${piece.serial}` : ""} is counted as checked by hand.` : ""} Link it next time you have signal.` });
      return;
    }
    if (!res.ok) { setBanner({ tone: "bad", text: res.error ?? "Couldn't link that tag." }); return; }
    const extKey = await tagKey(pendingLink.extTag);
    setList((l) => l.map((p) => (p.id === linkChoice ? { ...p, extKey } : p)));
    if (piece) markScanned({ ...piece, extKey }, pendingLink.how, pendingLink.extTag);
    setPendingLink(null); setLinkFilter("");
  }

  function matchesLink(p: ScanPiece) {
    const f = linkFilter.trim().toLowerCase();
    return !f || `${p.name} ${p.serial ?? ""}`.toLowerCase().includes(f);
  }

  function addBySerial() {
    const want = serialText.trim().toLowerCase();
    if (!want) return;
    const piece = list.find((p) => (p.serial ?? "").toLowerCase() === want);
    if (!piece) { setBanner({ tone: "warn", text: `No piece with serial ${serialText.trim()}. Check the stamp and try again.` }); return; }
    if (needsTag(piece)) { setBanner({ tone: "bad", text: `This yard scans tags only. Find the tag on ${piece.name} ${piece.serial ?? ""} and scan it.`.replace(/\s+\./, ".") }); return; }
    markScanned(piece, "hand");
    setSerialText("");
  }

  async function save() {
    setSaving(true); setSaveErr("");
    const notScanned = expected.filter((p) => !scans[p.id]).map((p) => ({ assetId: p.id, outcome: outcomes[p.id] ?? "yard" as Outcome }));
    let res: Awaited<ReturnType<typeof finishLoadout>>;
    try {
      res = await finishLoadout({
        unitId: truck.id, startedAt,
        scans: Object.entries(scans).map(([assetId, s]) => ({ assetId, how: s.how, at: s.at, proof: s.proof })),
        notScanned, packageIds, quick,
      });
    } catch {
      // No signal (or the request died). Everything is still on the phone.
      setSaving(false);
      setWaitingForSignal(true);
      const withSignal = navigator.onLine;
      const fails = withSignal ? failsWithSignal + 1 : failsWithSignal;
      setFailsWithSignal(fails);
      // A page saved for no signal can be older than the app. If it fails
      // with signal, a reload gets the new page, and the scans come back.
      setSaveErr(withSignal && fails >= 2
        ? "Couldn't reach RollReady. Your scans are saved on this phone. Reload the page and tap Pick it back up."
        : "No signal. Your scans are saved on this phone, and they'll send by themselves when you have signal.");
      return;
    }
    setSaving(false);
    if (!res.ok || !res.id || !res.verdict || !res.proofToken) { setSaveErr(res.error ?? "Couldn't save the load-out."); return; }
    setWaitingForSignal(false);
    clearDraft(truck.id);
    stopNfc(); stopCamera();
    setSaved({ id: res.id, verdict: res.verdict, reasons: res.reasons ?? [], proofToken: res.proofToken });
    try { navigator.vibrate?.(res.verdict === "ready" ? 120 : [200, 100, 200, 100, 200]); } catch { /* no vibration */ }
  }
  // When signal comes back, send the load-out that's waiting.
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    if (!waitingForSignal) return;
    const retry = () => { void saveRef.current(); };
    window.addEventListener("online", retry);
    const timer = setInterval(() => { if (navigator.onLine) retry(); }, 30000);
    return () => { window.removeEventListener("online", retry); clearInterval(timer); };
  }, [waitingForSignal]);

  if (saved) {
    const ready = saved.verdict === "ready";
    return (
      <div className="flex flex-col gap-4">
        <div className={cn("rounded-2xl border p-5", ready ? TONE.good : TONE.bad)}>
          <div className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            {ready ? <ShieldCheck className="h-8 w-8 shrink-0" /> : <OctagonX className="h-8 w-8 shrink-0" />}
            {ready ? "READY" : "NOT READY"}
          </div>
          <p className="mt-1 text-base text-ink">{ready ? `${truck.name} can roll. The record is saved and can't be edited.` : `${truck.name} can't roll. The record is saved, and anyone set up for alerts gets an email.`}</p>
          {!ready ? (
            <ul className="mt-3 flex flex-col gap-1.5">
              {saved.reasons.map((r) => <li key={r} className="break-words text-[15px] font-medium text-red-300">{r}</li>)}
            </ul>
          ) : null}
        </div>
        {ready ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <div className="font-semibold">Proof link for the operator</div>
            <ProofLink url={`https://www.synnr.io/l/${saved.proofToken}`} title={`${truck.name} load-out`} />
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {!ready ? (
            <button type="button" onClick={() => { setSaved(null); setScans({}); setOutcomes({}); setFinishing(false); setBanner(null); setStartedAt(new Date().toISOString()); }}
              className={buttonClass("default", "lg", "h-14 text-base")}><ScanLine className="h-5 w-5" /> Fix it and scan again</button>
          ) : null}
          <Link href={`/app/loadouts/${saved.id}`} className={buttonClass(ready ? "default" : "outline", "lg", "h-14 text-base")}>
            {ready ? "See the record" : manager ? "See the record (manager override)" : "See the record"}
          </Link>
          <Link href="/app" className={buttonClass("outline", "lg", "h-14 text-base")}>Back to Load out</Link>
        </div>
      </div>
    );
  }

  const redScanned = list.filter((p) => scans[p.id] && p.problem === "red");
  const notYet = expected.filter((p) => !scans[p.id]);
  const short = shortLines(lines);
  const missingNow = notYet.filter((p) => outcomes[p.id] === "missing");
  const nothingScanned = Object.keys(scans).length === 0;
  const byHandNotAllowed = list.filter((p) => scans[p.id]?.how === "hand" && needsTag(p));
  const willBlock = nothingScanned || short.length + redScanned.length + missingNow.length + byHandNotAllowed.length > 0;
  const pieceText = (p: { name: string; serial: string | null }) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`;

  const required = lines.reduce((n, l) => n + l.qty, 0);
  const lineSummary = (ls: KitLine[]) => ls.map((l) => `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`).join(", ");
  const quickEditor = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input value={quickLabel} onChange={(e) => setQuickLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQuick(); }}
        list="rr-piece-names" placeholder="Quick line for today, like Swivel 3-inch" aria-label="Quick line"
        className="h-12 w-full min-w-0 grow rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
      <datalist id="rr-piece-names">{pieceNames.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="flex gap-2">
        <input value={quickQty} onChange={(e) => setQuickQty(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" aria-label="How many"
          className="h-12 w-16 shrink-0 rounded-lg border border-line-2 bg-coal px-3 text-center text-base text-ink outline-none focus:border-bone" />
        <button type="button" onClick={addQuick} className={buttonClass("outline", "lg", "grow")}><Plus className="h-5 w-5" /> Add</button>
      </div>
    </div>
  );

  if (!started) {
    return (
      <div className="flex flex-col gap-5">
        {draft && !draftHandled ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="font-semibold">There&apos;s an unsaved load-out on this phone</div>
            <p className="text-sm text-ink-dim">{Object.keys(draft.scans).length} pieces scanned, last at {clock(draft.savedAt)}. Pick it back up, or start over.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={pickUpDraft} className={buttonClass("default", "lg")}>Pick it back up</button>
              <button type="button" onClick={dropDraft} className={buttonClass("ghost", "lg")}>Start over</button>
            </div>
          </div>
        ) : null}
        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <div>
            <h2 className="text-lg font-semibold">What&apos;s going on {truck.name} today?</h2>
            <p className="text-sm text-ink-dim">{plan ? "A manager planned this job. You can add to it, not take anything off." : "The truck\u2019s kit always counts. Pick the package for this job, or add a quick line."}</p>
          </div>
          {plan ? (
            <div className="flex items-start gap-3 rounded-xl border-2 border-bone/50 bg-bone/10 px-4 py-3">
              <ListTodo className="mt-0.5 h-5 w-5 shrink-0 text-bone" />
              <div className="min-w-0 text-sm">
                <div className="font-semibold">Planned by {plan.by ?? "a manager"}, {plan.at}</div>
                {plan.note ? <div className="break-words text-ink">&ldquo;{plan.note}&rdquo;</div> : null}
                {planned.length ? <div className="break-words text-ink-dim">Extra for this job: {lineSummary(planned)}</div> : null}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <div className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-line-2 bg-elevated px-4 py-2">
              <Check className="h-5 w-5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <div className="font-semibold">{truck.name} kit</div>
                <div className="break-words text-[13px] text-ink-dim">{kit.length ? lineSummary(kit) : <>No kit set yet{manager ? <>. <Link href={`/app/units/${truck.id}/kit`} className="text-bone underline underline-offset-2">Set it</Link></> : ". A manager can set one."}</>}</div>
              </div>
            </div>
            {packages.map((x) => {
              const on = packageIds.includes(x.id);
              const locked = lockedIds.includes(x.id);
              return (
                <button key={x.id} type="button" aria-pressed={on} disabled={locked}
                  onClick={() => setPackageIds((ids) => on ? ids.filter((i) => i !== x.id) : [...ids, x.id])}
                  className={cn("flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-2 text-left", on ? "border-bone bg-bone/10" : "border-line-2 hover:bg-elevated", locked && "cursor-default")}>
                  {locked ? <Lock className="h-5 w-5 shrink-0 text-bone" /> : on ? <Check className="h-5 w-5 shrink-0 text-bone" /> : <Plus className="h-5 w-5 shrink-0 text-ink-faint" />}
                  <div className="min-w-0">
                    <div className="font-semibold">{x.name}{locked ? <span className="ml-2 text-xs font-normal text-ink-faint">planned</span> : on && lastPackageIds?.includes(x.id) ? <span className="ml-2 text-xs font-normal text-ink-faint">same as last time</span> : null}</div>
                    <div className="break-words text-[13px] text-ink-dim">{lineSummary(x.lines) || "No lines yet"}</div>
                  </div>
                </button>
              );
            })}
          </div>
          {quick.length ? (
            <div className="flex flex-wrap gap-2">
              {quick.map((l, i) => (
                <span key={`${l.label}-${i}`} className="inline-flex items-center gap-1 rounded-lg border border-line-2 py-1 pl-3 pr-1 text-sm">
                  {l.label}{l.qty > 1 ? ` × ${l.qty}` : ""}
                  <button type="button" aria-label={`Remove ${l.label}`} onClick={() => setQuick((q) => [...q.slice(0, i), ...q.slice(i + 1)])}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:bg-elevated"><X className="h-4 w-4" /></button>
                </span>
              ))}
            </div>
          ) : null}
          {quickEditor}
          <button type="button" onClick={() => { setStarted(true); setStartedAt(new Date().toISOString()); }} className={buttonClass("default", "lg", "h-14 w-full text-base")}>
            <ScanLine className="h-5 w-5" /> Start scanning{required ? ` (${required} ${required === 1 ? "piece" : "pieces"} required)` : ""}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {draft && !draftHandled && Object.keys(scans).length === 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="font-semibold">There&apos;s an unsaved load-out on this phone</div>
          <p className="text-sm text-ink-dim">{Object.keys(draft.scans).length} pieces scanned, last at {clock(draft.savedAt)}. Pick it back up, or start over.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={pickUpDraft} className={buttonClass("default", "lg")}>Pick it back up</button>
            <button type="button" onClick={dropDraft} className={buttonClass("ghost", "lg")}>Start over</button>
          </div>
        </div>
      ) : null}
      {banner ? (
        <div role="status" aria-live="polite" className={cn("rounded-2xl border px-4 py-4 text-lg font-semibold leading-snug", TONE[banner.tone])}>{banner.text}</div>
      ) : (
        <div className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm text-ink-dim">
          Scan each piece as it goes on {truck.name}. Anything out of test or not on this truck&apos;s list gets called out right away.
        </div>
      )}

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
      {!hasNfc ? <p className="-mt-2 text-xs text-ink-faint">NFC tapping works in Chrome on Android. On this device, scan QR codes{tagRule ? "." : " or check pieces by hand."}</p> : null}
      {tagRule ? <p className="-mt-2 text-xs text-ink-faint">This yard scans tags only: pressure iron and anything on the list has to be scanned off its tag. A tag that won&apos;t scan means a manager signs off.</p> : null}

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
          <input value={linkFilter} onChange={(e) => { setLinkFilter(e.target.value); setLinkChoice(""); }} aria-label="Find the piece"
            placeholder="Type part of the serial or name" autoComplete="off"
            className="h-12 w-full rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-bone" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)} aria-label="Piece this tag is on"
              className="h-11 w-full min-w-0 grow rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-bone">
              <option value="">Pick the piece…</option>
              <optgroup label={`On ${truck.name}`}>
                {expected.filter(matchesLink).map((p) => <option key={p.id} value={p.id}>{p.name}{p.serial ? ` ${p.serial}` : ""}</option>)}
              </optgroup>
              <optgroup label="Everything else">
                {list.filter((p) => p.unitId !== truck.id).filter(matchesLink).slice(0, 200).map((p) => <option key={p.id} value={p.id}>{p.name}{p.serial ? ` ${p.serial}` : ""} ({p.where})</option>)}
              </optgroup>
            </select>
            <button type="button" onClick={doLink} disabled={!linkChoice} className={buttonClass("default")}>Link it</button>
            <button type="button" onClick={() => setPendingLink(null)} className={buttonClass("ghost")}>Skip</button>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">What {truck.name} needs</h2>
          {lines.length ? <span className="text-sm tabular-nums text-ink-dim">{linesDone} of {lines.length} {lines.length === 1 ? "line" : "lines"} filled</span> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {kit.length ? <span className="rounded-lg border border-line-2 bg-elevated px-3 py-2 text-sm font-medium">{truck.name} kit</span> : null}
          {picked.map((x) => (
            <span key={x.id} className={cn("inline-flex items-center gap-1 rounded-lg border border-bone/40 bg-bone/10 py-1 pl-3 text-sm font-medium text-ink", lockedIds.includes(x.id) ? "pr-3" : "pr-1")}>
              {lockedIds.includes(x.id) ? <Lock className="h-3.5 w-3.5 text-bone" aria-label="Planned by a manager" /> : null}
              {x.name}
              {lockedIds.includes(x.id) ? null : (
                <button type="button" onClick={() => setPackageIds((ids) => ids.filter((i) => i !== x.id))} aria-label={`Take ${x.name} off the list`}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-ink-dim hover:bg-elevated"><X className="h-4 w-4" /></button>
              )}
            </span>
          ))}
          {planned.length ? <span className="inline-flex items-center gap-1 rounded-lg border border-bone/40 bg-bone/10 px-3 py-2 text-sm font-medium"><Lock className="h-3.5 w-3.5 text-bone" /> Planned extras</span> : null}
          {packages.filter((x) => !packageIds.includes(x.id)).length ? (
            <select value="" onChange={(e) => { const v = e.target.value; if (v) setPackageIds((ids) => [...ids, v]); }} aria-label="Add a package"
              className="h-11 min-w-0 rounded-lg border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-bone">
              <option value="">+ Add a package</option>
              {packages.filter((x) => !packageIds.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          ) : null}
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-ink-dim">
            No list for this load-out yet. Add a package or a quick line below. Without one, only what&apos;s logged on {truck.name} gets checked.
            {manager ? <> <Link href={`/app/units/${truck.id}/kit`} className="text-bone underline underline-offset-2">Set {truck.name}&apos;s kit</Link></> : null}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((l, i) => {
              const bad = lineBad(l);
              const done = l.filled.length >= l.qty && !bad;
              return (
                <div key={`${l.source}-${l.package ?? ""}-${l.label}-${i}`} className={cn("flex items-center gap-3 rounded-xl border p-3",
                  bad ? "border-red-500/50 bg-red-500/[0.08]" : done ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-line bg-coal")}>
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    bad ? "border-red-500/50 bg-red-500/15 text-red-400" : done ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-line-2 text-ink-faint")}>
                    {bad ? <X className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-semibold">{l.label}</div>
                    <div className={cn("break-words text-[13px]", bad ? "text-red-400" : "text-ink-faint")}>
                      {lineSourceLabel(l)}
                      {l.filled.length ? ` · ${l.filled.map((f) => `${f.serial ?? f.name}${redOnTruck.has(f.id) ? " (bad, take it off)" : ""}`).join(", ")}` : ""}
                    </div>
                  </div>
                  <span className={cn("shrink-0 text-base font-semibold tabular-nums", bad ? "text-red-400" : done ? "text-emerald-400" : "text-ink-dim")}>{l.filled.length}/{l.qty}</span>
                  {l.source === "quick" ? (
                    <button type="button" aria-label={`Remove ${l.label}`} onClick={() => setQuick((q) => { const idx = q.findIndex((x) => x.label === l.label && x.qty === l.qty); return idx < 0 ? q : [...q.slice(0, idx), ...q.slice(idx + 1)]; })}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-elevated"><X className="h-4 w-4" /></button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {quickEditor}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink-dim">Logged on {truck.name}</h2>
          <span className="text-sm tabular-nums text-ink-dim">{scannedExpected} of {expected.length} scanned</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
          <div className="h-full rounded-full bg-bone transition-all" style={{ width: `${expected.length ? (scannedExpected / expected.length) * 100 : 0}%` }} />
        </div>
        {expected.length === 0 ? <p className="text-sm text-ink-faint">Nothing is logged on {truck.name} yet. Scan what goes on and it gets added.</p> : null}
        {expected.map((p) => <Row key={p.id} p={p} scan={scans[p.id]} demo={demo} tagOnly={needsTag(p)} onHand={() => markScanned(p, "hand")} onTakeOff={() => takeOff(p)} />)}
      </section>

      {added.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-ink-dim">Going on {truck.name} (logged somewhere else)</h2>
          {added.map((p) => <Row key={p.id} p={p} scan={scans[p.id]} demo={demo} tagOnly={needsTag(p)} onHand={() => {}} onTakeOff={() => takeOff(p)} />)}
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={serialText} onChange={(e) => setSerialText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addBySerial(); }}
          placeholder="Can't scan it? Type the serial" aria-label="Serial number"
          className="h-12 w-full min-w-0 grow rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-bone" />
        <button type="button" onClick={addBySerial} className={buttonClass("outline", "lg")}>Add</button>
      </div>

      {!finishing ? (
        /* Always in reach: what's still needed, and Done. */
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              {lines.length
                ? <><span className="text-lg font-bold tabular-nums">{linesDone}/{lines.length}</span> lines filled</>
                : <><span className="text-lg font-bold tabular-nums">{Object.keys(scans).length}</span> scanned</>}
              {short.length ? <span className="block font-semibold text-amber-400 sm:inline"> · {short.length} still needed</span> : null}
              {redScanned.length ? <span className="block font-semibold text-red-400 sm:inline"> · {redScanned.length} bad on the truck</span> : null}
            </div>
            <button type="button" onClick={() => setFinishing(true)} className={buttonClass("default", "lg", "h-14 shrink-0 px-6 text-base")}>Done loading</button>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-semibold">Before you save</h2>
          {notYet.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink-dim">These are logged on {truck.name} but didn&apos;t get scanned. Where are they?</p>
              {notYet.map((p) => (
                <label key={p.id} className="flex flex-col gap-1 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 break-words text-sm font-medium">{p.name}{p.serial ? ` ${!demo && checkable(p.serial) ? maskSerial(p.serial) : p.serial}` : ""}</span>
                  <select value={outcomes[p.id] ?? "yard"} onChange={(e) => setOutcomes((o) => ({ ...o, [p.id]: e.target.value as Outcome }))}
                    className="h-12 rounded-lg border border-line-2 bg-surface px-2 text-base text-ink outline-none focus:border-bone">
                    <option value="yard">Not going this trip (stays in the yard)</option>
                    <option value="missing">Can&apos;t find it (flag missing)</option>
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          <div className={cn("rounded-xl border p-3", willBlock ? TONE.bad : TONE.good)}>
            <div className="text-lg font-bold">{willBlock ? `${truck.name} will be NOT READY` : `${truck.name} looks READY`}</div>
            {willBlock ? (
              <ul className="mt-1 flex flex-col gap-1 text-sm font-medium">
                {nothingScanned ? <li>Nothing was scanned onto the truck</li> : null}
                {short.map((l, i) => <li key={`s${i}`}>Short: {l.label}, {l.filled.length} of {l.qty} scanned</li>)}
                {redScanned.map((p) => <li key={`r${p.id}`}>Bad piece on the truck: {pieceText(p)}. Take it off and scan a good one.</li>)}
                {missingNow.map((p) => <li key={`m${p.id}`}>Can&apos;t find: {pieceText(p)}</li>)}
                {byHandNotAllowed.map((p) => <li key={`h${p.id}`}>Checked by hand, not scanned off its tag: {pieceText(p)}</li>)}
              </ul>
            ) : (
              <p className="mt-0.5 text-sm text-ink-dim">Saving checks every piece against the records one more time.</p>
            )}
            {willBlock ? <p className="mt-2 text-sm text-ink-dim">You can still save it. The record will say NOT READY, and only a manager can roll it anyway.</p> : null}
          </div>
          {saveErr ? <p className={cn("text-sm", waitingForSignal ? "text-amber-400" : "text-red-400")}>{saveErr}</p> : null}
          {failsWithSignal >= 2 ? (
            <button type="button" onClick={() => window.location.reload()} className={buttonClass("outline", "lg", "h-14 self-start text-base")}>Reload the page</button>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className={buttonClass("default", "lg", "h-14 text-base")}>{saving ? "Saving…" : waitingForSignal ? "Try sending now" : "Save load-out"}</button>
            <button type="button" onClick={() => setFinishing(false)} className={buttonClass("outline", "lg", "h-14 text-base")}>Keep scanning</button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Letters and digits of a serial, uppercased: "QB-4471" → "QB4471". */
const alnum = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");
/** A serial long enough that its last 4 prove someone read the stamp. */
const checkable = (serial: string | null) => Boolean(serial && alnum(serial).length >= 5);
/** "QB-4471" → "QB-••••": the last 4 letters or digits hidden until the piece is scanned. */
function maskSerial(serial: string): string {
  let left = 4;
  return serial.split("").reverse().map((ch) => (/[a-z0-9]/i.test(ch) && left-- > 0 ? "•" : ch)).reverse().join("");
}

/**
 * One piece logged on the truck. Checking it by hand means reading the last
 * 4 of its serial off the band or the stamp: the screen hides them until the
 * piece is scanned, so the check proves someone looked at the iron. (Not in
 * the demo yard, where there's no iron to read.)
 */
function Row({ p, scan, onHand, onTakeOff, demo = false, tagOnly = false }: { p: ScanPiece; scan?: Scan; onHand: () => void; onTakeOff: () => void; demo?: boolean; tagOnly?: boolean }) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const needsSerial = !demo && checkable(p.serial);
  function check() {
    if (!needsSerial) { onHand(); return; }
    if (!asking) { setAsking(true); return; }
    if (alnum(typed) === alnum(p.serial!).slice(-4)) { setAsking(false); setTyped(""); setErr(""); onHand(); }
    else setErr("That's not it. Read the last 4 off the band or the stamp.");
  }
  const shownSerial = p.serial ? (!scan && needsSerial ? maskSerial(p.serial) : p.serial) : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border p-3",
      scan ? (p.problem === "red" ? TONE.bad : "border-emerald-500/40 bg-emerald-500/[0.06]") : "border-line bg-surface")}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
        scan ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-line-2 text-ink-faint")}>
        {scan ? <Check className="h-4 w-4" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold text-ink">{p.name}{shownSerial ? <span className="font-normal text-ink-dim"> · {shownSerial}</span> : null}</div>
        <div className={cn("break-words text-[13px]", p.problem === "red" ? "text-red-400" : p.problem === "yellow" ? "text-amber-400" : "text-ink-dim")}>
          {p.statusText}{scan ? <span className="text-ink-faint"> · {HOW[scan.how]} {clock(scan.at)}</span> : null}
        </div>
      </div>
      {!scan && tagOnly ? (
        <span className="w-full shrink-0 text-[13px] font-medium text-ink-dim sm:w-auto">Scan its tag</span>
      ) : !scan ? (
        <button type="button" onClick={check} className="min-h-12 w-full shrink-0 rounded-lg border border-line-2 px-4 text-sm text-ink-dim hover:bg-elevated sm:w-auto">
          {asking ? "Check it" : "Check by hand"}
        </button>
      ) : p.problem === "red" ? (
        <button type="button" onClick={onTakeOff} className="min-h-12 w-full shrink-0 rounded-lg border border-red-500/50 px-4 text-sm font-semibold text-red-400 hover:bg-red-500/10 sm:w-auto">Took it off</button>
      ) : null}
      {asking && !scan ? (
        <div className="flex w-full flex-col gap-1">
          <label className="text-[13px] text-ink-dim" htmlFor={`last4-${p.id}`}>Last 4 of the serial on the band or the stamp</label>
          <input id={`last4-${p.id}`} value={typed} onChange={(e) => { setTyped(e.target.value.slice(0, 8)); setErr(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }} autoFocus autoComplete="off" autoCapitalize="characters"
            className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base uppercase tracking-widest text-ink outline-none focus:border-bone" />
          {err ? <p className="text-[13px] text-red-400">{err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
