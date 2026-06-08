import "./report.css";
import PrintButton from "./print-button";
import { getReportData } from "@/lib/data/workspace";

export const metadata = {
  title: "SYNNR — Recoverable Revenue Report",
  robots: { index: false },
};

const usd = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

export default async function ReportPage() {
  const d = await getReportData();
  const generated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const collectRate = d.foundCents > 0 ? Math.round((d.recoveredCents / d.foundCents) * 100) : 0;

  if (d.empty) {
    return (
      <div className="rpt">
        <div className="doc">
          <div className="rhead">
            <div>
              <div className="brand">{MARK} SYNNR</div>
              <div className="eyebrow">Recoverable Revenue Report</div>
              <h1>No findings yet</h1>
              <div className="meta"><b>{d.workspace}</b> · generated {generated}</div>
            </div>
            <div className="actions"><a className="btn no-print" href="/dashboard">Back to dashboard</a></div>
          </div>
          <div className="guarantee" style={{ marginTop: 30 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
            <p>Run your first audit and this report will fill in with recoverable revenue, recovery-by-type, and your top jobs — ready to print or share. <a href="/onboarding">Run an audit →</a></p>
          </div>
          <div className="foot">SYNNR · revenue intelligence for field operations · synnr.io</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rpt">
      <div className="doc">
        <div className="rhead">
          <div>
            <div className="brand">{MARK} SYNNR</div>
            <div className="eyebrow">Recoverable Revenue Report</div>
            <h1>{usd(d.foundCents)} found across {d.jobsCount.toLocaleString()} jobs</h1>
            <div className="meta">
              <b>{d.workspace}</b> · {d.findingsCount.toLocaleString()} findings · generated {generated}
              {!d.live && " · sample data"}
            </div>
          </div>
          <div className="actions">
            <a className="btn no-print" href="/dashboard">Back to dashboard</a>
            <PrintButton />
          </div>
        </div>

        <div className="pipe">
          <div className="pcell found"><div className="k">Recoverable found</div><div className="v">{usd(d.foundCents)}</div><div className="s">detected &amp; evidenced by SYNNR</div></div>
          <div className="pcell billing"><div className="k">In billing</div><div className="v">{usd(d.inBillingCents)}</div><div className="s">approved &amp; re-billed</div></div>
          <div className="pcell recovered"><div className="k">Recovered</div><div className="v">{usd(d.recoveredCents)}</div><div className="s">collected &amp; confirmed · {collectRate}% of found</div></div>
        </div>

        <h2>Recovery by type</h2>
        <table>
          <thead>
            <tr><th>Category</th><th className="num">Findings</th><th className="num">Recoverable</th></tr>
          </thead>
          <tbody>
            <tr><td>Missed billables — standby, consumables, change orders</td><td className="num">{d.byType.missedCount}</td><td className="amt">{usd(d.byType.missedCents)}</td></tr>
            <tr><td>Rate corrections — billed below MSA / contract</td><td className="num">{d.byType.rateCount}</td><td className="amt">{usd(d.byType.rateCents)}</td></tr>
            <tr><td>Documentation blockers — missing backup, unsigned</td><td className="num">{d.byType.docCount}</td><td className="amt">held</td></tr>
          </tbody>
        </table>

        {d.topJobs.length > 0 && (
          <>
            <h2>Top jobs by recoverable revenue</h2>
            <table>
              <thead>
                <tr><th>Job</th><th>Description</th><th className="num">Recoverable</th></tr>
              </thead>
              <tbody>
                {d.topJobs.map((j) => (
                  <tr key={j.number}>
                    <td className="num">#{j.number}</td>
                    <td>{j.title}</td>
                    <td className="amt">{usd(j.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="guarantee">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
          <p>
            <b>How to read this report.</b> &ldquo;Recoverable found&rdquo; is detected and backed by side-by-side
            evidence — not yet money in the bank. &ldquo;Recovered&rdquo; counts only re-billed, confirmed-collected
            dollars. SYNNR&rsquo;s 30-day ROI guarantee is measured against recoverable found; every finding is
            reviewable with its source evidence before it touches a customer invoice.
          </p>
        </div>

        <div className="foot">SYNNR · revenue intelligence for field operations · synnr.io</div>
      </div>
    </div>
  );
}
