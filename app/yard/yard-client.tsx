"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { YardData, YardNode, YardItem } from "@/lib/data/workspace";
import { STATE_LABEL, STATE_TONE, VALID_TRANSITIONS, TRANSITION_LABEL, type AssetState } from "@/lib/twin/fsm";

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);
const RD_LABEL = { ready: "Ready", at_risk: "At risk", blocked: "Blocked" } as const;
const dayStr = (d: number | null) => (d == null ? "" : d < 0 ? `${-d}d overdue` : `${d}d`);

export default function YardClient({ data }: { data: YardData }) {
  const router = useRouter();
  const [seeding, setSeeding] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busyAsset, setBusyAsset] = useState<string | null>(null);

  async function seed() {
    setErr(""); setSeeding(true);
    try {
      const r = await fetch("/api/yard/seed", { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error || "Couldn't seed the yard."); setSeeding(false); return; }
      router.refresh();
    } catch { setErr("Couldn't reach SYNNR — try again."); setSeeding(false); }
  }

  async function transition(node: YardNode, to: AssetState) {
    setErr(""); setBusyAsset(node.id);
    try {
      const r = await fetch(`/api/yard/asset/${node.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ to }) });
      const d = await r.json();
      if (!r.ok || !d.ok) { setErr(d.error || "Transition failed."); setBusyAsset(null); return; }
      router.refresh();
    } catch { setErr("Couldn't reach SYNNR — try again."); }
    setBusyAsset(null);
  }

  const header = (
    <div className="topbar">
      <a className="brand" href="/dashboard">{MARK}<b>SYNNR</b></a>
      <a className="back" href="/dashboard">← Dashboard</a>
    </div>
  );

  if (data.empty) {
    return (
      <div className="yd">
        {header}
        <div className="wrap">
          <div className="eyebrow">Digital Yard Twin</div>
          <h1>Your yard, live</h1>
          <p className="sub">A virtual mirror of your trucks, tools, and rigging — every asset as a tracked state, so you know what&rsquo;s loaded before it rolls.</p>
          <div className="empty">
            <b>No assets yet</b>
            <p>Load a sample yard to see the twin in action — trucks, tools, and states you can drive. Your real fleet imports here when we build your system.</p>
            <button className="btn" onClick={seed} disabled={seeding}>{seeding ? "Building yard…" : "Load sample yard"}</button>
            {err ? <div className="errline">{err}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const c = data.counts;
  return (
    <div className="yd">
      {header}
      <div className="wrap">
        <div className="eyebrow">Digital Yard Twin</div>
        <h1>Your yard, live</h1>
        <p className="sub">Every truck and tool as a tracked state. Green is ready, amber is due soon, red is blocked or down. Click a truck to see what&rsquo;s on it.</p>

        <div className="summ">
          <div className="scard green"><div className="n">{c.ready}</div><div className="k">Ready</div></div>
          <div className="scard amber"><div className="n">{c.atRisk}</div><div className="k">At risk</div></div>
          <div className="scard red"><div className="n">{c.blocked}</div><div className="k">Blocked</div></div>
          <div className="scard"><div className="n">{c.maintenance}</div><div className="k">In maintenance</div></div>
        </div>

        {err ? <div className="errline" style={{ marginBottom: 12 }}>{err}</div> : null}

        <div className="grid">
          {data.nodes.map((n) => {
            const isOpen = open === n.id;
            return (
              <div key={n.id} className={`node ${n.tone}${isOpen ? " open" : ""}`} onClick={() => setOpen(isOpen ? null : n.id)}>
                <div className="node-h">
                  <div className="node-top">
                    <span className="node-id">{n.identifier || n.name}</span>
                    <span className="glow" />
                  </div>
                  <div className="node-state">{STATE_LABEL[n.state]}</div>
                  <span className={`rd ${n.readiness}`}>{RD_LABEL[n.readiness]}</span>
                  <div className="rd-reason">{n.readinessReason}</div>
                  <div className="node-meta">
                    <span>{n.items.length} item{n.items.length === 1 ? "" : "s"}</span>
                    {n.crew && <span>· {n.crew}</span>}
                    {n.jobNumber && <span>· Job {n.jobNumber}</span>}
                    {n.inspectionDays != null && <span>· Insp {dayStr(n.inspectionDays)}</span>}
                  </div>
                </div>
                <div className="node-body" onClick={(e) => e.stopPropagation()}>
                  {n.items.map((it: YardItem) => (
                    <div key={it.id} className="il">
                      <span className={`idot ${STATE_TONE[it.state]}`} />
                      <span className="inm">{it.name}</span>
                      <span className="ist">{it.state === "maintenance_required" ? "missing / down" : it.calibrationDays != null ? `cal ${dayStr(it.calibrationDays)}` : "ok"}</span>
                    </div>
                  ))}
                  <div className="acts">
                    {VALID_TRANSITIONS[n.state].map((to) => (
                      <button key={to} className="act" disabled={busyAsset === n.id} onClick={() => transition(n, to)}>
                        {TRANSITION_LABEL[to]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
