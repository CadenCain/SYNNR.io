"use client";

import { useState, useRef } from "react";
import type { TallyResult, TallyJoint, RawCell } from "@/lib/tally/types";
import { extractJoint } from "@/lib/tally/extract";
import { buildResult } from "@/lib/tally/qc";
import { SAMPLE_TALLY_CONFIG } from "@/lib/tally/sample";

const CFG = SAMPLE_TALLY_CONFIG;
const ft = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} ft`);

function readShell(r: TallyResult) {
  return {
    meta: r.meta,
    cells: [] as RawCell[],
    independent: r.crossCheck.expectedFt != null ? { totalFt: r.crossCheck.expectedFt } : undefined,
    usedSample: r.usedSample,
  };
}

/**
 * Public TallyShot demo: scan ONE real sheet free (no signup), or load the
 * sample. Confirm flagged digits, then capture email to download the Excel.
 */
export default function IngestDemoClient() {
  const [result, setResult] = useState<TallyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [isReal, setIsReal] = useState(false); // true for a real free scan (gates export behind email)
  const [email, setEmail] = useState("");
  const [emailGate, setEmailGate] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadSample() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tally/demo", { method: "POST" });
      const d = await r.json();
      if (!d.ok) { setMsg("Couldn't load the sample — try again."); setBusy(false); return; }
      setResult(d.result); setEdits({}); setIsReal(false); setEmailGate(false); setEmailed(false);
    } catch { setMsg("Couldn't reach SYNNR — try again."); }
    setBusy(false);
  }

  async function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg("Use a photo of the sheet (JPG, PNG, or HEIC)."); return; }
    if (file.size > 25 * 1024 * 1024) { setMsg("That photo is over 25 MB — retake it a little smaller."); return; }
    setBusy(true); setMsg("");
    try {
      const fd = new FormData(); fd.append("image", file);
      const r = await fetch("/api/tally/free-scan", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok && d.ok) {
        setResult(d.result); setEdits({}); setIsReal(true); setEmailGate(false); setEmailed(false);
      } else {
        setMsg(d.error || "Couldn't read that photo — try a clearer shot.");
      }
    } catch { setMsg("Couldn't reach SYNNR — try again."); }
    setBusy(false);
  }

  function confirmJoint(j: TallyJoint) {
    if (!result) return;
    const raw = (edits[j.joint] ?? j.raw).trim();
    const corrected = extractJoint({ joint: j.joint, raw, confidence: 1 } as RawCell, CFG);
    const joints = result.joints.map((x) => (x.joint === j.joint ? corrected : x));
    setResult(buildResult(joints, readShell(result), CFG));
  }

  async function doExport() {
    if (!result) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tally/demo/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result }) });
      if (!r.ok) { setMsg("Export failed."); setBusy(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = isReal ? "tallyshot-scan.xlsx" : "tallyshot-sample.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch { setMsg("Export failed — try again."); }
    setBusy(false);
  }

  /** Real scans: capture email before the first download. Sample: free. */
  function exportXlsx() {
    if (isReal && !emailed) { setEmailGate(true); return; }
    void doExport();
  }

  async function captureEmail() {
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setMsg("Enter a valid email."); return; }
    setBusy(true); setMsg("");
    try {
      await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), source: "free_scan" }) });
    } catch { /* don't block the download on a lead-save hiccup */ }
    setEmailed(true); setEmailGate(false); setBusy(false);
    void doExport();
  }

  if (!result) {
    return (
      <div className="ts">
        <div className="ts-empty">
          <b>Scan your own tally sheet — free, no signup</b>
          <p>Photograph a real handwritten casing/tubing tally and TallyShot reads it: implied decimal, running shoe depth, per-10 subtotals, and every shaky digit flagged for you to confirm. Or load a sample to see it first.</p>
          <div className="ts-actions" style={{ justifyContent: "center", marginTop: 4 }}>
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading…" : "Scan your own sheet"}</button>
            <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Load sample sheet</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhotoPick} />
          {msg ? <div className="ts-msg" style={{ marginTop: 14 }}>{msg}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ts">
      <div className="ts-actions">
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? "Reading…" : "Scan your own sheet"}</button>
        <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Reload sample</button>
        <button className="btn btn-ghost" onClick={exportXlsx} disabled={busy}>Export to Excel ↓</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhotoPick} />
      </div>
      {msg ? <p className="ts-msg">{msg}</p> : null}

      {isReal ? (
        emailGate ? (
          <div className="ts-save">
            <input type="email" placeholder="you@company.com — get this as Excel" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
            <button className="btn btn-primary" onClick={captureEmail} disabled={busy}>Email me the Excel ↓</button>
          </div>
        ) : (
          <div className="ts-flagbar ok"><b>Read off your sheet.</b> Confirm any flagged digits, then export. <a href="/checkout?product=tallyshot&seats=1">Start a free trial</a> to scan all you want + save records.</div>
        )
      ) : null}

      <div className="ts-summary">
        <div className="sc"><div className="n">{result.grandTotalFt}</div><div className="k">Trusted total (ft)</div></div>
        <div className="sc"><div className="n">{result.trustedCount}/{result.jointCount}</div><div className="k">Joints trusted</div></div>
        <div className={`sc ${result.flaggedCount ? "amber" : ""}`}><div className="n">{result.flaggedCount}</div><div className="k">Flagged</div></div>
        <div className={`sc ${result.crossCheck.ran ? (result.crossCheck.pass ? "green" : "red") : ""}`}>
          <div className="n">{result.crossCheck.ran ? (result.crossCheck.pass ? "PASS" : "FAIL") : "—"}</div><div className="k">Cross-check</div>
        </div>
      </div>

      {result.flaggedCount > 0 ? (
        <div className="ts-flagbar"><b>{result.flaggedCount} flagged for review.</b> Confirm or correct each — that&apos;s why the exported total is one you can trust.</div>
      ) : (
        <div className="ts-flagbar ok"><b>All joints confirmed.</b> Grand total {result.grandTotalFt} ft is final — export it.</div>
      )}

      <div className="ts-table">
        <div className="tr th"><span>No.</span><span>Read</span><span>Length</span><span>Cum ft</span><span>Status</span><span>Comments</span></div>
        {result.joints.map((j) => (
          <div key={j.joint} className={`tr ${j.trusted ? "" : j.flag === "RANGE" ? "flag" : "warn"}`}>
            <span className="mono">{j.joint}</span>
            <span className="mono">{j.raw}</span>
            <span className="mono">{ft(j.lengthFt)}</span>
            <span className="mono">{j.cumulativeFt != null ? j.cumulativeFt.toFixed(2) : "—"}</span>
            {j.trusted ? (
              <span className="st ok">Trusted</span>
            ) : (
              <span className="st-edit">
                <span className="why">{j.flag === "RANGE" ? "Out of range" : "Low confidence"}</span>
                <input className="mono" value={edits[j.joint] ?? j.raw} onChange={(e) => setEdits({ ...edits, [j.joint]: e.target.value })} aria-label={`Correct joint ${j.joint}`} />
                <button onClick={() => confirmJoint(j)}>Confirm</button>
              </span>
            )}
            <span className="note-ro">{j.note || "—"}</span>
          </div>
        ))}
      </div>

      <div className="ts-subs">
        {result.subtotals.map((s) => (
          <div key={s.from} className="sub"><span>Joints {s.from}–{s.to}</span><b className="mono">{s.ft} ft</b>{s.flagged ? <span className="fl">{s.flagged} flagged</span> : null}</div>
        ))}
      </div>
    </div>
  );
}
