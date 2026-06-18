"use client";

import { useState } from "react";
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

/** Public, cardless TallyShot demo: load the sample sheet, confirm/correct the
 *  flagged digits, watch the totals update, export the real Excel. */
export default function IngestDemoClient() {
  const [result, setResult] = useState<TallyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});

  async function loadSample() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tally/demo", { method: "POST" });
      const d = await r.json();
      if (!d.ok) { setMsg("Couldn't load the sample — try again."); setBusy(false); return; }
      setResult(d.result); setEdits({});
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

  async function exportXlsx() {
    if (!result) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/tally/demo/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result }) });
      if (!r.ok) { setMsg("Export failed."); setBusy(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "tallyshot-sample.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch { setMsg("Export failed — try again."); }
    setBusy(false);
  }

  if (!result) {
    return (
      <div className="ts">
        <div className="ts-empty">
          <b>See TallyShot read a real tally sheet</b>
          <p>Load a sample handwritten casing tally. TallyShot applies the implied decimal, totals the joints, and flags the digits it isn&apos;t sure about — no account, no card.</p>
          <button className="btn btn-primary" onClick={loadSample} disabled={busy}>{busy ? "Reading…" : "Load sample tally sheet"}</button>
          {msg ? <div className="ts-msg" style={{ marginTop: 14 }}>{msg}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="ts">
      <div className="ts-actions">
        <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Reload sample</button>
        <button className="btn btn-primary" onClick={exportXlsx} disabled={busy}>Export to Excel ↓</button>
        <a className="btn btn-ghost" href="/checkout?product=tallyshot&seats=1">Scan your own → free trial</a>
      </div>
      {msg ? <p className="ts-msg">{msg}</p> : null}

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
