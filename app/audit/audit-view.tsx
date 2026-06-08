"use client";

import "./audit.css";
import { useMemo, useState } from "react";
import type { AuditData, AuditFinding } from "@/lib/data/workspace";

const money = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

const Check = ({ w = 2.4 }: { w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}><path d="M20 6 9 17l-5-5" /></svg>
);
const X = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg>;
const ArrowR = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const BillIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H4zM4 9h16" /></svg>;
const Bulb = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 4 10.5c-.7.6-1 1-1 2H9c0-1-.3-1.4-1-2A6 6 0 0 1 12 3Z" /></svg>;

function findingIcon(f: AuditFinding) {
  if (f.type === "rate")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
  if (f.type === "doc" && f.blocker === "sign")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>;
  if (f.type === "doc")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15l-5-5L5 21M3 3l18 18" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h10l6 6v10H4Z" /><path d="M14 4v6h6M8 14h8" /></svg>;
}

export default function AuditView({ data }: { data: AuditData }) {
  const [states, setStates] = useState<Record<string, string>>(
    () => Object.fromEntries(data.findings.map((f) => [f.id, f.state]))
  );

  function set(id: string, next: string) {
    setStates((s) => ({ ...s, [id]: next }));
    if (data.persist) {
      fetch(`/api/findings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: next }), keepalive: true,
      }).catch(() => {});
    }
  }

  const totals = useMemo(() => {
    let found = 0, billing = 0, recovered = 0, open = 0;
    for (const f of data.findings) {
      const st = states[f.id] || "open";
      if (f.amount_cents) {
        if (st !== "dismissed") found += f.amount_cents;
        if (st === "approved") billing += f.amount_cents;
        if (st === "recovered") recovered += f.amount_cents;
      }
      if (st === "open") open++;
    }
    return { found, inBilling: billing + recovered, recovered, open };
  }, [states, data.findings]);

  const moneyFindings = data.findings.filter((f) => f.amount_cents > 0).length;

  if (data.empty) {
    return (
      <div className="audit">
        <Topbar />
        <div className="wrap" style={{ textAlign: "center", paddingTop: 70 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>No audited jobs yet</h1>
          <p style={{ color: "var(--fg-dim)", margin: "12px auto 22px", maxWidth: "44ch" }}>
            Run an audit on your uploaded job data and recoverable findings — with evidence — will appear here to review and bill.
          </p>
          <a href="/onboarding" className="btn btn-primary" style={{ display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>Run an audit
          </a>
        </div>
      </div>
    );
  }

  const barTitle =
    totals.recovered > 0 && totals.recovered >= totals.found
      ? "Fully recovered — every dollar collected"
      : totals.recovered > 0
      ? "Recovering — keep going"
      : "Review each finding to recover this job";

  return (
    <div className="audit">
      <Topbar packet />

      <div className="wrap">
        <div className="jhead">
          <div>
            <span className="seclabel" style={{ margin: "0 0 12px" }}>Audit · Job #{data.jobNumber}</span>
            <h1>{data.jobTitle}</h1>
            <div className="jmeta">
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>{data.client}</span>
              {data.location && data.location !== "—" && <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>{data.location}</span>}
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>{data.closed}</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 18v-5l3-6h8l3 6v5" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /></svg>{data.crew}</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h10l6 6v10H4Z" /><path d="M14 4v6h6" /></svg>{data.invoiceStatus}</span>
            </div>
          </div>
          <div className="jright">
            <div className="jrec"><small>Recoverable found</small>{money(totals.found)}</div>
            <span className={`riskbadge ${data.risk.toLowerCase()}`}><span className="sd" />{data.risk} risk</span>
            <div className="ready">
              <div className="rl"><span>Invoice readiness</span><b>{data.readiness}%</b></div>
              <div className="rb"><i style={{ width: data.readiness + "%" }} /></div>
            </div>
          </div>
        </div>

        <div className="pipe">
          <div className="pcell found"><div className="k">Recoverable found</div><div className="v">{money(totals.found)}</div><div className="s">detected &amp; evidenced</div></div>
          <div className="parr"><ArrowR /></div>
          <div className="pcell billing"><div className="k">In billing</div><div className="v">{money(totals.inBilling)}</div><div className="s">approved &amp; re-billed</div></div>
          <div className="parr"><ArrowR /></div>
          <div className="pcell recovered"><div className="k">Recovered</div><div className="v">{money(totals.recovered)}</div><div className="s">collected &amp; confirmed</div></div>
        </div>

        <div className="note">
          <Check w={2} />
          <span>
            <b style={{ color: "var(--fg)", fontWeight: 500 }}>Every finding is backed by source evidence</b> — field ticket, photos,
            rate sheet, MSA, time log. Approve to send to billing, then mark recovered once paid.
            {data.persist ? " Changes save to your workspace." : " (Demo — sign in to save changes.)"}
          </span>
        </div>

        {data.evidenceTypes.length > 0 && (
          <>
            <div className="evlabel">Evidence on file</div>
            <div className="evpanel">
              {data.evidenceTypes.map((e) => (
                <span key={e.label} className={`evchip ${e.present ? "have" : "miss"}`}>
                  {e.present ? <Check w={2.4} /> : <X />}{e.label}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="seclabel">Findings to review <span className="ct">{totals.open} open</span></div>

        <div>
          {data.findings.map((f) => {
            const st = states[f.id] || "open";
            const done = st === "approved" || st === "recovered" || st === "resolved";
            const cls = `finding t-${f.type}${done ? " done" : ""}${st === "dismissed" ? " dismissed" : ""}`;
            const live = st !== "dismissed";
            return (
              <div key={f.id} className={cls}>
                <div className="fr1">
                  <span className="fic">{findingIcon(f)}</span>
                  <div>
                    <div className="fhl">
                      <span className={`fcat ${f.type}`}>{f.category}</span>
                      <span className="fconf">{f.confidence}% confidence</span>
                    </div>
                    <div className="ftitle" style={{ marginTop: 6 }}>{f.title}</div>
                    <div className="fsub">{f.subtitle}</div>
                  </div>
                  <div className={`famt${f.amount_cents ? "" : " muted"}`}>
                    {f.amount_cents ? "+" + money(f.amount_cents) : "blocks billing"}
                  </div>
                </div>

                {live && f.original && f.corrected && (
                  <div className="cmp">
                    <div className="c orig"><div className="cl">Original invoice</div><div className="cv">{f.original}</div></div>
                    <div className="ar"><ArrowR /></div>
                    <div className="c corr"><div className="cl">Corrected</div><div className="cv">{f.corrected}</div></div>
                  </div>
                )}

                {live && f.evidence.length > 0 && (
                  <div className="evi">
                    {f.evidence.map((e, i) => (
                      <div key={i} className={`ev ${e.ok ? "good" : "bad"}`}>
                        <div className="el">{e.label}</div>
                        <div className="ed">{e.detail}</div>
                      </div>
                    ))}
                  </div>
                )}

                {live && f.fix && (
                  <div className="fix"><Bulb /><span><b>Recommended fix.</b> {f.fix}</span></div>
                )}

                <div className="factions">{renderActions(f, st, set)}</div>
              </div>
            );
          })}
        </div>

        <div className="barrow">
          <div className="bl">
            <b>{barTitle}</b>
            <span>{money(totals.recovered)} of {money(totals.found)} recovered · {moneyFindings} billable findings · {totals.open} to review</span>
          </div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <a href="/packet" className="bmini">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>
              Generate packet
            </a>
            <a href="/dashboard" className="btn btn-primary"><Check w={2} />Done — back to dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Topbar({ packet }: { packet?: boolean }) {
  return (
    <div className="topbar2">
      <a className="back" href="/dashboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Back to dashboard
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {packet && (
          <a className="bmini" href="/packet">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M6 14h12v7H6z" /></svg>
            Generate invoice packet
          </a>
        )}
        <div className="brandmini">
          <span className="mk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" /></svg></span>
          <b>SYNNR</b>
        </div>
      </div>
    </div>
  );
}

function renderActions(f: AuditFinding, st: string, set: (id: string, s: string) => void) {
  if (f.blocker) {
    if (st === "resolved")
      return <span className="fstate resolved"><Check />{f.blocker === "backup" ? "Backup attached" : "Ready for billing"}</span>;
    return (
      <>
        <button className="bmini solid" onClick={() => set(f.id, "resolved")}>
          {f.blocker === "backup" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M4 16v4h16v-4" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
          )}
          {f.blocker === "backup" ? "Request missing backup" : "Finalize for billing"}
        </button>
        <button className="bmini ghosty" onClick={() => set(f.id, "dismissed")}>Dismiss</button>
      </>
    );
  }
  if (st === "approved")
    return (
      <>
        <span className="fstate billing"><BillIcon />Re-billed · awaiting payment</span>
        <button className="bmini solid" onClick={() => set(f.id, "recovered")}><Check />Mark recovered</button>
      </>
    );
  if (st === "recovered") return <span className="fstate recovered"><Check />Recovered · collected</span>;
  if (st === "dismissed") return <span className="fstate dismissed">Dismissed</span>;
  return (
    <>
      <button className="bmini solid" onClick={() => set(f.id, "approved")}><Check />Approve recovery</button>
      <button className="bmini ghosty" onClick={() => set(f.id, "dismissed")}>Dismiss</button>
    </>
  );
}
