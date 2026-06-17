"use client";

import { useState, useRef } from "react";
import type { TallyResult, TallyJoint, RawCell } from "@/lib/tally/types";
import { extractJoint } from "@/lib/tally/extract";
import { buildResult } from "@/lib/tally/qc";
import { SAMPLE_TALLY_CONFIG } from "@/lib/tally/sample";

const CFG = SAMPLE_TALLY_CONFIG;
const ft = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} ft`);

/** Rebuild a TallyRead shell so buildResult can recompute over edited joints. */
function readShell(r: TallyResult) {
  return {
    meta: r.meta,
    cells: [] as RawCell[],
    independent: r.crossCheck.expectedFt != null ? { totalFt: r.crossCheck.expectedFt } : undefined,
    usedSample: r.usedSample,
  };
}

export default function TallyShotClient() {
  const [result, setResult] = useState<TallyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Editable string spec — what a company man reads first. Pre-filled from the
  // read meta where present, carried into the export + the saved record.
  const [spec, setSpec] = useState({ well: "", lease: "", rig: "", size: "", weight: "", grade: "", connection: "", date: "" });

  /** Initialize the spec form from whatever the reader pulled off the sheet. */
  function specFrom(r: TallyResult) {
    const m = r.meta ?? {};
    return { well: m.well ?? "", lease: m.lease ?? "", rig: m.rig ?? "", size: m.size ?? "", weight: m.weight ?? "", grade: m.grade ?? "", connection: m.connection ?? "", date: m.date ?? "" };
  }

  /** Merge the edited spec + per-joint comments back into the result (for export/save). */
  function prepared(r: TallyResult): TallyResult {
    return {
      ...r,
      meta: { ...r.meta, well: spec.well || r.meta.well, lease: spec.lease || r.meta.lease, rig: spec.rig || r.meta.rig, size: spec.size || r.meta.size, weight: spec.weight || r.meta.weight, grade: spec.grade || r.meta.grade, connection: spec.connection || r.meta.connection, date: spec.date || r.meta.date },
      joints: r.joints.map((j) => (notes[j.joint] !== undefined ? { ...j, note: notes[j.joint] } : j)),
    };
  }

  async function save() {
    if (!result) return;
    setBusy(true); setMsg(""); setSavedId(null);
    try {
      const r = await fetch("/api/tally/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result: prepared(result), meta: { wellName: spec.well, lease: spec.lease, rig: spec.rig, size: spec.size, weight: spec.weight, grade: spec.grade, connection: spec.connection, date: spec.date } }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setMsg(d.error || "Couldn't save."); setBusy(false); return; }
      setSavedId(d.id);
    } catch { setMsg("Couldn't save — try again."); }
    setBusy(false);
  }

  async function loadSample() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tally", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sample: true }) });
      const d = await r.json();
      if (!d.ok) { setMsg(d.error || "Couldn't load."); setBusy(false); return; }
      setResult(d.result); setEdits({}); setNotes({}); setSpec(specFrom(d.result));
    } catch { setMsg("Couldn't reach SYNNR — try again."); }
    setBusy(false);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setMsg("");
    try {
      const fd = new FormData(); fd.append("image", file);
      const r = await fetch("/api/tally", { method: "POST", body: fd });
      const d = await r.json();
      if (d.ok) { setResult(d.result); setEdits({}); setNotes({}); setSpec(specFrom(d.result)); }
      else if (d.needsCard) setMsg("Live photo reading turns on when the AI vision card is added. Use “Load sample sheet” to see the full flow now.");
      else setMsg(d.error || "Couldn't read that photo.");
    } catch { setMsg("Couldn't read that photo — try again."); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** User confirms (optionally corrects) a flagged joint → re-extract + recompute. */
  function confirmJoint(j: TallyJoint) {
    if (!result) return;
    const raw = (edits[j.joint] ?? j.raw).trim();
    const corrected = extractJoint({ joint: j.joint, raw, confidence: 1 } as RawCell, CFG); // user vouches → conf 1
    const joints = result.joints.map((x) => (x.joint === j.joint ? corrected : x));
    setResult(buildResult(joints, readShell(result), CFG));
  }

  /** Mark a range-flagged joint as a pup/sub — legitimately short, so clear the flag. */
  function markPup(j: TallyJoint) {
    if (!result) return;
    const corrected = extractJoint({ joint: j.joint, raw: j.raw, confidence: 1, kind: "pup" } as RawCell, CFG);
    const joints = result.joints.map((x) => (x.joint === j.joint ? corrected : x));
    setResult(buildResult(joints, readShell(result), CFG));
  }

  async function exportXlsx() {
    if (!result) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tally/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result: prepared(result) }) });
      if (!r.ok) { setMsg("Export failed."); setBusy(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `tallyshot-${result.meta.sheetNo ? "sheet-" + result.meta.sheetNo : "export"}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
    } catch { setMsg("Export failed — try again."); }
    setBusy(false);
  }

  return (
    <div className="ts">
      <div className="ts-actions">
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>Photograph a sheet</button>
        <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>{busy ? "Working…" : "Load sample sheet"}</button>
        {result ? <button className="btn btn-ghost" onClick={exportXlsx} disabled={busy}>Export to Excel ↓</button> : null}
        <a className="btn btn-ghost" href="/app/tallyshot/records">Saved tallies</a>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
      </div>
      {msg ? <p className="ts-msg">{msg}</p> : null}

      {result ? (
        savedId ? (
          <div className="ts-flagbar ok"><b>Saved to records.</b> <a href={`/app/tallyshot/records/${savedId}`}>View it</a> · <a href="/app/tallyshot/records">all saved tallies</a></div>
        ) : (
          <div className="ts-spec">
            <div className="ts-spec-head">String spec <span>— shown in the export title block &amp; the saved record</span></div>
            <div className="ts-spec-grid">
              <label>Well<input className="mono" value={spec.well} onChange={(e) => setSpec({ ...spec, well: e.target.value })} placeholder="Pad 14 #3H" /></label>
              <label>Size<input className="mono" value={spec.size} onChange={(e) => setSpec({ ...spec, size: e.target.value })} placeholder={'5-1/2"'} /></label>
              <label>Weight (lb/ft)<input className="mono" value={spec.weight} onChange={(e) => setSpec({ ...spec, weight: e.target.value })} placeholder="23.0" /></label>
              <label>Grade<input className="mono" value={spec.grade} onChange={(e) => setSpec({ ...spec, grade: e.target.value })} placeholder="J-55 / L-80" /></label>
              <label>Connection<input className="mono" value={spec.connection} onChange={(e) => setSpec({ ...spec, connection: e.target.value })} placeholder="BTC / LTC / 8Rd" /></label>
              <label>Date<input className="mono" value={spec.date} onChange={(e) => setSpec({ ...spec, date: e.target.value })} placeholder="6/16/26" /></label>
              <label>Lease<input className="mono" value={spec.lease} onChange={(e) => setSpec({ ...spec, lease: e.target.value })} placeholder="Optional" /></label>
              <label>Rig<input className="mono" value={spec.rig} onChange={(e) => setSpec({ ...spec, rig: e.target.value })} placeholder="Optional" /></label>
            </div>
            <button className="btn btn-primary" onClick={save} disabled={busy}>Save to records</button>
          </div>
        )
      ) : null}

      {!result ? (
        <div className="ts-empty">
          <b>No sheet loaded</b>
          <p>Photograph a handwritten tally sheet, or load the sample to see the full flow — flagged digits, subtotals, grand total, and Excel export.</p>
        </div>
      ) : (
        <>
          <div className="ts-summary">
            <div className="sc"><div className="n">{result.grandTotalFt}</div><div className="k">Grand total (trusted) ft</div></div>
            <div className="sc"><div className="n">{result.trustedCount}/{result.jointCount}</div><div className="k">Joints trusted</div></div>
            <div className={`sc ${result.flaggedCount ? "amber" : ""}`}><div className="n">{result.flaggedCount}</div><div className="k">Flagged</div></div>
            <div className={`sc ${result.crossCheck.ran ? (result.crossCheck.pass ? "green" : "red") : ""}`}>
              <div className="n">{result.crossCheck.ran ? (result.crossCheck.pass ? "PASS" : "FAIL") : "—"}</div><div className="k">Cross-check</div>
            </div>
          </div>

          {result.flaggedCount > 0 ? (
            <div className="ts-flagbar">
              <b>{result.flaggedCount} flagged for review.</b> Confirm or correct each before the total is final.
            </div>
          ) : (
            <div className="ts-flagbar ok"><b>All joints confirmed.</b> Grand total {result.grandTotalFt} ft is final — export when ready.</div>
          )}

          <div className="ts-table">
            <div className="tr th"><span>No.</span><span>Read</span><span>Length</span><span>Cum ft</span><span>Status</span><span>Comments</span></div>
            {result.joints.map((j) => (
              <div key={j.joint} className={`tr ${j.trusted ? "" : j.flag === "RANGE" ? "flag" : "warn"}`}>
                <span className="mono">{j.joint}</span>
                <span className="mono">{j.raw}</span>
                <span className="mono">{ft(j.lengthFt)}{j.kind !== "joint" ? <em className="kind-tag"> {j.kind}</em> : null}</span>
                <span className="mono">{j.cumulativeFt != null ? j.cumulativeFt.toFixed(2) : "—"}</span>
                {j.trusted ? (
                  <span className="st ok">Trusted{j.kind !== "joint" ? ` · ${j.kind}` : ""}</span>
                ) : (
                  <span className="st-edit">
                    <span className="why">{j.flag === "RANGE" ? "Out of range" : "Low confidence"}</span>
                    <input className="mono" value={edits[j.joint] ?? j.raw} onChange={(e) => setEdits({ ...edits, [j.joint]: e.target.value })} aria-label={`Correct joint ${j.joint}`} />
                    <button onClick={() => confirmJoint(j)}>Confirm</button>
                    {j.flag === "RANGE" ? <button className="pup-btn" onClick={() => markPup(j)} title="It's a pup / sub — legitimately short">Pup</button> : null}
                  </span>
                )}
                <input className="note-input" value={notes[j.joint] ?? j.note ?? ""} onChange={(e) => setNotes({ ...notes, [j.joint]: e.target.value })} placeholder="—" aria-label={`Comment for joint ${j.joint}`} />
              </div>
            ))}
          </div>

          <div className="ts-subs">
            {result.subtotals.map((s) => (
              <div key={s.from} className="sub"><span>Joints {s.from}–{s.to}</span><b className="mono">{s.ft} ft</b>{s.flagged ? <span className="fl">{s.flagged} flagged</span> : null}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
