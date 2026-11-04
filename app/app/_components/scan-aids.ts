"use client";

import { useEffect, useRef } from "react";

/**
 * What a scan screen needs to work in a real yard, with gloves on and the
 * phone in a pocket between pieces:
 *  - the screen stays awake while it's listening for tags or the camera is on
 *    (a phone that dims and locks stops reading tags), and wakes back up after
 *    the hand switches apps or unlocks;
 *  - a sound for every scan (a short beep for good, a low buzz for bad), so a
 *    hand doesn't have to look at the screen to know.
 */

type WakeLockLike = { release: () => Promise<void> };
type WakeLockApi = { request: (type: "screen") => Promise<WakeLockLike> };

/** Keep the screen on while `active`. Asks again when the page comes back into view. */
export function useWakeLock(active: boolean) {
  const lock = useRef<WakeLockLike | null>(null);
  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!active || !api) return;
    let gone = false;
    const take = async () => {
      if (gone || document.visibilityState !== "visible") return;
      try { lock.current = await api.request("screen"); } catch { /* battery saver or not allowed: the scan still works */ }
    };
    void take();
    const onVisible = () => { if (document.visibilityState === "visible") void take(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}

/** Run `restart` when the page comes back into view while `active` (tag listening dies when the phone locks). */
export function useResumeWhenVisible(active: boolean, restart: () => void) {
  const fn = useRef(restart);
  useEffect(() => { fn.current = restart; });
  useEffect(() => {
    if (!active) return;
    const onVisible = () => { if (document.visibilityState === "visible") fn.current(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active]);
}

let ctx: AudioContext | null = null;
const audio = () => {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
};

/** Call from a tap (like "Tap tags") so the phone allows sound later. */
export function primeSound() { audio(); }

/** Good: one short high beep. Warn: two mid beeps. Bad: a long low buzz, twice. */
export function scanSound(tone: "good" | "warn" | "bad") {
  const a = audio();
  if (!a) return;
  const beep = (freq: number, start: number, len: number, type: OscillatorType) => {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + len);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start); o.stop(a.currentTime + start + len + 0.02);
  };
  try {
    if (tone === "good") beep(1320, 0, 0.12, "sine");
    else if (tone === "warn") { beep(880, 0, 0.1, "square"); beep(880, 0.16, 0.1, "square"); }
    else { beep(180, 0, 0.35, "sawtooth"); beep(180, 0.45, 0.35, "sawtooth"); }
  } catch { /* no sound: the screen and the buzz still say it */ }
}
