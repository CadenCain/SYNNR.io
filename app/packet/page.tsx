import "./packet.css";
import PrintButton from "../report/print-button";
import { getAuditData } from "@/lib/data/workspace";

export const metadata = {
  title: "SYNNR — Invoice-Ready Packet",
  robots: { index: false },
};

const usd = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

export default async function PacketPage() {
  const d = await getAuditData();

  if (d.empty) {
    return (
      <div className="pkt">
        <div className="doc">
          <div className="phead">
            <div><div className="brand">{MARK} SYNNR</div><div className="eyebrow">Invoice-Ready Packet</div><h1>No job to export yet</h1></div>
            <div className="actions"><a className="btn no-print" href="/dashboard">Back to dashboard</a></div>
          </div>
          <p style={{ color: "var(--fg-dim)", marginTop: 24 }}>
            Run an audit, then export a defensible, invoice-ready packet for any job. <a href="/onboarding">Run an audit →</a>
          </p>
        </div>
      </div>
    );
  }

  const billable = d.findings.filter((f) => f.amount_cents > 0);
  const blockers = d.findings.filter((f) => f.amount_cents === 0);
  const total = billable.reduce((s, f) => s + f.amount_cents, 0);

  return (
    <div className="pkt">
      <div className="doc">
        <div className="phead">
          <div>
            <div className="brand">{MARK} SYNNR</div>
            <div className="eyebrow">Invoice-Ready Packet · Job #{d.jobNumber}</div>
            <h1>{d.jobTitle}</h1>
            <div className="jmeta"><span>{d.client}</span><span>{d.closed}</span><span>{d.crew}</span></div>
          </div>
          <div className="actions">
            <a className="btn no-print" href="/audit">Back to audit</a>
            <PrintButton />
          </div>
        </div>

        <div className="totalbar">
          <div><div className="k">Recoverable on this job</div><div className="s">{billable.length} billable line{billable.length === 1 ? "" : "s"}, each backed by evidence</div></div>
          <div className="v">{usd(total)}</div>
        </div>

        <h2>Recoverable line items</h2>
        {billable.length === 0 && <p style={{ color: "var(--fg-dim)" }}>No billable findings on this job.</p>}
        {billable.map((f) => (
          <div key={f.id} className={`li ${f.type === "rate" ? "rate" : ""}`}>
            <div className="l1">
              <div><div className="lt">{f.title}</div><div className="ls">{f.subtitle}</div></div>
              <div className="la">+{usd(f.amount_cents)}</div>
            </div>
            {f.evidence.length > 0 && (
              <div className="ev">
                {f.evidence.map((e, i) => (
                  <div key={i} className={`e ${e.ok ? "good" : "bad"}`}>
                    <div className="el">{e.label}</div>
                    <div className="ed">{e.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {blockers.length > 0 && (
          <>
            <h2>Required before billing</h2>
            <div className="chk">
              {blockers.map((f) => (
                <div className="crow" key={f.id}>
                  <span className="box" />
                  <span className="lbl">{f.title} — {f.subtitle}</span>
                  <span className="st">Needed</span>
                </div>
              ))}
            </div>
          </>
        )}

        <h2>Billing handoff</h2>
        <div className="handoff">
          <div className="hf"><span className="hk">Total invoice adjustment</span><span className="hv pos">+{usd(total)}</span></div>
          <div className="hf"><span className="hk">Corrected lines</span><span className="hv">{billable.length} ready</span></div>
          <div className="hf"><span className="hk">Backup required</span><span className="hv">{blockers.length ? `${blockers.length} outstanding` : "complete"}</span></div>
          <div className="hf"><span className="hk">Owner</span><span className="hv">Billing team</span></div>
          <div className="hf"><span className="hk">Bill-by</span><span className="hv">Per MSA window</span></div>
          <div className="hf"><span className="hk">Export to</span><span className="hv">QuickBooks draft + PDF</span></div>
          <div className={`hf-status ${blockers.length ? "blocked" : "ready"}`}>
            {blockers.length ? (
              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>Blocked — {blockers.length} backup item{blockers.length === 1 ? "" : "s"} needed before this can be sent</>
            ) : (
              <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>Ready to send to billing</>
            )}
          </div>
        </div>

        <div className="foot">
          Prepared by SYNNR · every line item above is backed by source evidence (field ticket vs. invoice vs. contract).
          Attach this packet to your re-bill. {d.persist ? "" : "Sample data — sign in to generate from your jobs."}
        </div>
      </div>
    </div>
  );
}
