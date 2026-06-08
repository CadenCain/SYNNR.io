"use client";

import "./audit.css";
import { useMemo, useState } from "react";
import type { AuditData, AuditFinding } from "@/lib/data/workspace";

const money = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

const Check = ({ w = 2.4 }: { w?: number }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w}><path d="M20 6 9 17l-5-5" /></svg>
);
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const BillIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H4zM4 9h16" /></svg>
);

function findingIcon(f: AuditFinding) {
  if (f.type === "rate")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h10M4 18h7" /><path d="m15 15 2.5 2.5L20 13" /></svg>;
  if (f.type === "doc" && f.blocker === "sign")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 17h16M6 12l3-9 3 9M14 12h6" /></svg>;
  if (f.type === "doc")
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15l-5-5L5 21M3 3l18 18" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

export default function AuditView({ data }: { data: AuditData }) {
  const [states, setStates] = useState<Record<string, string>>(
    () => Object.fromEntries(data.findings.map((f) => [f.id, f.state]))
  );

  function set(id: string, next: string) {
    setStates((s) => ({ ...s, [id]: next }));
    if (data.persist) {
      fetch(`/api/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: next }),
        keepalive: true,
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

  const barTitle =
    totals.recovered > 0 && totals.recovered >= totals.found
      ? "Fully recovered — every dollar collected"
      : totals.recovered > 0
      ? "Recovering — keep going"
      : "Review each finding to recover this job";

  if (data.empty) {
    return (
      <div className="audit">
        <div className="topbar2">
          <a className="back" href="/dashboard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
            Back to dashboard
          </a>
          <div className="brandmini">
            <span className="mk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" /></svg></span>
            <b>SYNNR</b>
          </div>
        </div>
        <div className="wrap" style={{ textAlign: "center", paddingTop: 70 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>No audited jobs yet</h1>
          <p style={{ color: "var(--fg-dim)", margin: "12px auto 22px", maxWidth: "44ch" }}>
            Run an audit on your uploaded job data and approved findings will appear here, ready to review and recover.
          </p>
          <a href="/onboarding" className="btn btn-primary" style={{ display: "inline-flex" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Run an audit
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="audit">
      <div className="topbar2">
        <a className="back" href="/dashboard">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
          Back to dashboard
        </a>
        <div className="brandmini">
          <span className="mk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" /></svg></span>
          <b>SYNNR</b>
        </div>
      </div>

      <div className="wrap">
        <div className="jhead">
          <div>
            <span className="seclabel" style={{ margin: "0 0 12px" }}>Audit · Job #{data.jobNumber}</span>
            <h1>{data.jobTitle}</h1>
            <div className="jmeta">
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>{data.client}</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>{data.closed}</span>
              <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 18v-5l3-6h8l3 6v5" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /></svg>{data.crew}</span>
            </div>
          </div>
        </div>

        <div className="pipe">
          <div className="pcell found"><div className="k">Recoverable found</div><div className="v">{money(totals.found)}</div><div className="s">detected by SYNNR</div></div>
          <div className="parr"><Arrow /></div>
          <div className="pcell billing"><div className="k">In billing</div><div className="v">{money(totals.inBilling)}</div><div className="s">approved &amp; re-billed</div></div>
          <div className="parr"><Arrow /></div>
          <div className="pcell recovered"><div className="k">Recovered</div><div className="v">{money(totals.recovered)}</div><div className="s">collected &amp; confirmed</div></div>
        </div>

        <div className="note">
          <Check w={2} />
          <span>
            <b style={{ color: "var(--fg)", fontWeight: 500 }}>Recovered means re-billed and confirmed collected</b> — not just
            detected. Approve each finding to send it to billing, then mark it recovered once payment clears.
            {data.persist ? " Changes save to your workspace." : " (Demo — sign in to save changes.)"}
          </span>
        </div>

        <div className="seclabel">Findings to review <span className="ct">{totals.open} open</span></div>

        <div>
          {data.findings.map((f) => {
            const st = states[f.id] || "open";
            const done = st === "approved" || st === "recovered" || st === "resolved";
            const cls = `finding t-${f.type}${done ? " done" : ""}${st === "dismissed" ? " dismissed" : ""}`;
            return (
              <div key={f.id} className={cls}>
                <div className="fr1">
                  <span className="fic">{findingIcon(f)}</span>
                  <div><div className="ftitle">{f.title}</div><div className="fsub">{f.subtitle}</div></div>
                  <div className={`famt${f.amount_cents ? "" : " muted"}`}>
                    {f.amount_cents ? "+" + money(f.amount_cents) : "blocks billing"}
                  </div>
                </div>

                {f.evidence.length > 0 && st !== "dismissed" && (
                  <div className="evi">
                    {f.evidence.map((e, i) => (
                      <div key={i} className={`ev ${e.ok ? "good" : "bad"}`}>
                        <div className="el">{e.label}</div>
                        <div className="ed">{e.detail}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="factions">{renderActions(f, st, set)}</div>
              </div>
            );
          })}
        </div>

        <div className="barrow">
          <div className="bl">
            <b>{barTitle}</b>
            <span>{money(totals.recovered)} of {money(totals.found)} recovered · {totals.open} to review</span>
          </div>
          <a href="/dashboard" className="btn btn-primary"><Check w={2} />Done — back to dashboard</a>
        </div>
      </div>
    </div>
  );
}

function renderActions(f: AuditFinding, st: string, set: (id: string, s: string) => void) {
  if (f.blocker) {
    if (st === "resolved")
      return (
        <span className="fstate resolved"><Check />{f.blocker === "backup" ? "Backup attached" : "Signed by customer"}</span>
      );
    return (
      <>
        <button className="bmini solid" onClick={() => set(f.id, "resolved")}>
          {f.blocker === "backup" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L8 8m4-4 4 4" /><path d="M4 16v4h16v-4" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 17h16M6 12l3-9 3 9" /></svg>
          )}
          {f.blocker === "backup" ? "Request photos from crew" : "Send for signature"}
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
      <button className="bmini solid" onClick={() => set(f.id, "approved")}><BillIcon />Approve &amp; send to billing</button>
      <button className="bmini ghosty" onClick={() => set(f.id, "dismissed")}>Dismiss</button>
    </>
  );
}
