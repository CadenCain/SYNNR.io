"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check } from "lucide-react";

/**
 * The homepage's hero: the quick check, done the way a hand does it at the
 * truck. Each line on the short list gets tapped On truck, then the BOP
 * check, one photo, and Ready, and it reads READY with a name and a time.
 * Then it runs once more with the sinker bars left behind, and it reads NOT
 * READY with what's missing, in the app's own words (lib/saas/quick-check.ts).
 * A visitor can tap the lines and Ready themselves, too.
 */

type Line = { key: string; label: string; qty?: number; job?: boolean; check?: boolean };

const TRUCK = "WL-07";
const HAND = "Dale Wooten";
const LINES: Line[] = [
  { key: "sinker", label: "Sinker bars" },
  { key: "cross", label: "Crossover subs" },
  { key: "pumpin", label: "Pump-in sub" },
  { key: "tool", label: "Baker 20 setting tool", job: true },
  { key: "plugs", label: "Frac plugs", qty: 3, job: true },
  { key: "bop", label: "BOP rams closed for travel", check: true },
];
/** Every line, plus the photo. */
const TOTAL = LINES.length + 1;
/** The line the second run leaves behind. */
const SKIPPED = "sinker";

type Verdict = { ready: boolean; reasons: string[] };

/** Same words the app uses when it reads NOT READY. */
function judge(on: string[], photo: boolean): Verdict {
  const reasons = [
    ...LINES.filter((l) => !on.includes(l.key)).map((l) =>
      l.check ? `Not confirmed: ${l.label}` : `Not on the truck: ${l.label}${l.qty ? ` (0 of ${l.qty})` : ""}`),
    ...(photo ? [] : ["No photo of the loaded truck"]),
  ];
  return { ready: reasons.length === 0, reasons };
}

/** A small stand-in for the photo of the loaded truck. */
const TruckPhoto = () => (
  <svg viewBox="0 0 48 32" aria-hidden="true">
    <rect width="48" height="32" rx="4" fill="#1a222d" />
    <path d="M0 26h48v6H0Z" fill="#141a22" />
    <path d="M5 23V11h21v12Z" fill="#3b4b60" />
    <path d="M26 14h8l5 5v4H26Z" fill="#55697f" />
    <path d="M29 16h4l3 3h-7Z" fill="#1a222d" />
    <circle cx="12" cy="24" r="3" fill="#0b0e13" stroke="#6e7987" />
    <circle cx="33" cy="24" r="3" fill="#0b0e13" stroke="#6e7987" />
  </svg>
);

export default function HomeGate() {
  const [on, setOn] = useState<string[]>([]);
  const [photo, setPhoto] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const timers = useRef<number[]>([]);
  const instant = useRef(false);

  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  /** Tap down the list the way a hand would: each line, the check, the photo, then Ready. */
  const play = useCallback((skip: boolean, then?: () => void) => {
    stop();
    const unit = instant.current ? 0 : 1;
    let t = 0;
    const at = (ms: number, fn: () => void) => { t += ms * unit; timers.current.push(window.setTimeout(fn, t)); };
    const keys = LINES.map((l) => l.key).filter((k) => !(skip && k === SKIPPED));
    at(0, () => { setOn([]); setPhoto(false); setPressed(false); setVerdict(null); });
    keys.forEach((k, i) => at(i === 0 ? 650 : 430, () => setOn((o) => [...o, k])));
    at(520, () => setPhoto(true));
    at(700, () => setPressed(true));
    at(260, () => { setPressed(false); setVerdict(judge(keys, true)); });
    if (then) at(4200, then);
  }, [stop]);

  useEffect(() => {
    instant.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Once all the way through, then once with a line skipped. Motion off: just the READY.
    play(false, instant.current ? undefined : () => play(true));
    return stop;
  }, [play, stop]);

  const tapLine = (k: string) => {
    stop(); setPressed(false); setVerdict(null);
    setOn((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));
  };
  const tapPhoto = () => { stop(); setPressed(false); setVerdict(null); setPhoto((p) => !p); };
  const tapReady = () => { stop(); setPressed(false); setVerdict(judge(on, photo)); };
  const fixIt = () => { stop(); setVerdict(null); };

  const done = on.length + (photo ? 1 : 0);
  const left = TOTAL - done;
  const stopReasons = verdict && !verdict.ready ? verdict.reasons : [`Not on the truck: Sinker bars`];

  return (
    <figure className="qc" aria-label={`Example quick check for truck ${TRUCK}`}>
      <div className="qc-top">
        <div>
          <div className="qc-truck">{TRUCK}</div>
          <div className="qc-meta">Wireline truck · Plug set</div>
        </div>
        <span className="qc-count">{done} of {TOTAL} done</span>
      </div>

      <ul className="qc-rows">
        {LINES.map((l) => {
          const isOn = on.includes(l.key);
          return (
            <li key={l.key}>
              <button type="button" className={isOn ? "qc-row on" : "qc-row"} aria-pressed={isOn} onClick={() => tapLine(l.key)}>
                <span className="qc-ic" aria-hidden="true">{isOn ? <Check strokeWidth={3} /> : null}</span>
                <span className="qc-text">
                  <span className="qc-name">{l.label}{l.qty ? ` × ${l.qty}` : ""}</span>
                  {l.check ? <span className="qc-sub">Before it rolls</span> : l.job ? <span className="qc-sub">Plug set</span> : null}
                </span>
                <span className="qc-act">{isOn ? "On" : l.check ? "Done" : l.qty ? `All ${l.qty} on` : "On truck"}</span>
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" className={photo ? "qc-row on" : "qc-row"} aria-pressed={photo} onClick={tapPhoto}>
            <span className={photo ? "qc-pic" : "qc-cam"} aria-hidden="true">{photo ? <TruckPhoto /> : <Camera />}</span>
            <span className="qc-text">
              <span className="qc-name">Photo of the loaded truck</span>
              {photo ? <span className="qc-sub">Taken 5:01 AM</span> : null}
            </span>
            <span className="qc-act">{photo ? "Taken" : "Take it"}</span>
          </button>
        </li>
      </ul>

      {/* The Ready bar and both answers share one spot, so the card never jumps. */}
      <div className="qc-end">
        <div className={verdict ? "qc-bar off" : "qc-bar"}>
          <button type="button" className={pressed ? "qc-ready pressed" : "qc-ready"} onClick={tapReady}>Ready</button>
          <p className={left ? "qc-left warn" : "qc-left"}>
            {left ? `${left} still to go. You can save it, but it reads NOT READY.` : "Everything’s on. Tap Ready."}
          </p>
        </div>
        <div className={verdict?.ready ? "qc-verdict go" : "qc-verdict go off"}>
          <div className="qc-word">READY</div>
          <p>Cleared by {HAND} at 5:02 AM. The record is locked, and the proof link is ready for the operator.</p>
        </div>
        <div className={verdict && !verdict.ready ? "qc-verdict stop" : "qc-verdict stop off"}>
          <div className="qc-stop-top">
            <div className="qc-word">NOT READY</div>
            <button type="button" className="qc-fix" onClick={fixIt}>Fix it</button>
          </div>
          <p>{TRUCK} can’t roll yet.</p>
          <ul className="qc-why">{stopReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </div>
      <p className="qc-sr" aria-live="polite">
        {verdict ? (verdict.ready ? `READY. Cleared by ${HAND} at 5:02 AM.` : `NOT READY. ${verdict.reasons.join(". ")}.`) : ""}
      </p>

      <div className="qc-foot">
        <div className="qc-btns">
          <button type="button" className="qc-btn" onClick={() => play(false)}>Load it all</button>
          <button type="button" className="qc-btn" onClick={() => play(true)}>Skip a line</button>
        </div>
        <figcaption>Or tap the lines yourself.</figcaption>
      </div>
    </figure>
  );
}
