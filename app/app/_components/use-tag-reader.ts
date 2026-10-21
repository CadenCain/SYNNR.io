"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ScanHow } from "@/lib/saas/loadout";
// Loaded with the page so QR scanning works on a page saved for no signal.
import jsQR from "jsqr";

/**
 * Reading tags at the truck: NFC taps (Chrome on Android, the testing
 * company's tags or RollReady's) and QR codes through the camera (any phone).
 * Hands the caller what was read; the caller decides what it means.
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

export type TagRead = { link: string | null; chipId: string | null; how: ScanHow };
export type ReaderNote = { tone: "good" | "warn" | "bad"; text: string };

export function useTagReader(onRead: (r: TagRead) => void, onNote: (n: ReaderNote) => void) {
  const hasNfc = useSyncExternalStore(noSubscribe, () => ndef() !== null, () => false);
  const [nfcOn, setNfcOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const nfcAbort = useRef<AbortController | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const lastCode = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  // The tag callbacks must always see the caller's latest state.
  const readRef = useRef(onRead);
  const noteRef = useRef(onNote);
  useEffect(() => { readRef.current = onRead; noteRef.current = onNote; });

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
        readRef.current({ link, chipId: e.serialNumber || null, how: "nfc" });
      };
      reader.onreadingerror = () => noteRef.current({ tone: "warn", text: "Couldn't read that tag. Hold it still against the back of the phone." });
      await reader.scan({ signal: ac.signal });
      setNfcOn(true);
      noteRef.current({ tone: "good", text: "Ready. Tap each piece's tag to the back of the phone." });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      noteRef.current({ tone: "bad", text: name === "NotAllowedError" ? "The phone said no to NFC. Allow it for this site in Chrome's settings." : "NFC is off or not available. Turn on NFC in the phone's settings, or scan QR codes." });
    }
  }
  function stopNfc() { nfcAbort.current?.abort(); setNfcOn(false); }

  async function startCamera() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      setCamOn(true);
    } catch {
      noteRef.current({ tone: "bad", text: "Couldn't open the camera. Allow camera access for this site, then try again." });
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
            readRef.current({ link: code.data, chipId: null, how: "qr" });
          }
        }
      }
      timer = setTimeout(tick, 220);
    };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [camOn]);

  useEffect(() => () => { nfcAbort.current?.abort(); stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  return { hasNfc, nfcOn, camOn, startNfc, stopNfc, startCamera, stopCamera, video, stopAll: () => { stopNfc(); stopCamera(); } };
}
