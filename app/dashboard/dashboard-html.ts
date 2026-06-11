// SYNNR dashboard markup. Overview + risk table + activity rail render from
// live workspace data (or a real empty state for a brand-new workspace; or the
// rich demo when signed out). Sidebar tab views live in DashboardScripts.
import type { DashboardData, RiskRow } from "@/lib/data/workspace";

const AV: [string, string, string][] = [
  ["JD", "#8893a6", "John Doe"],
  ["SL", "#b58aa0", "Sarah Lee"],
  ["MR", "#9a9082", "Mike Ross"],
  ["DK", "#c2a36a", "Dana Kohl"],
  ["TW", "#968ea0", "Tara White"],
];
const PLABEL: Record<RiskRow["priority"], string> = { high: "High", med: "Medium", low: "Low" };
const CHECK = '<svg viewBox="0 0 24 24" width="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>';

function statusCell(s: RiskRow["status"]): string {
  if (s === "review") return '<span class="status review"><span class="sd"></span>In Review</span>';
  if (s === "delivered") return '<span class="status delivered">' + CHECK + "Delivered</span>";
  if (s === "resolved") return '<span class="status resolved">' + CHECK + "Resolved</span>";
  return '<span class="status open"><span class="sd"></span>Open</span>';
}

function riskRows(rows: RiskRow[]): string {
  return rows
    .map((r, i) => {
      const av = AV[i % AV.length];
      const checked = i === 0 ? " on" : "";
      return (
        "<tr>" +
        `<td><span class="cbx${checked}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></td>` +
        `<td class="tid">${r.number}</td>` +
        `<td>${r.subject}</td>` +
        `<td><span class="prio ${r.priority}"><span class="pic"><i></i><i></i><i></i></span><span class="ptxt">${PLABEL[r.priority]}</span></span></td>` +
        `<td><span class="assignee"><span class="av" style="background:${av[1]}">${av[0]}</span>${av[2]}</span></td>` +
        `<td>${statusCell(r.status)}</td>` +
        `<td class="datecell">${r.date}</td>` +
        "</tr>"
      );
    })
    .join("");
}

function emptyOverview(): string {
  return `<div class="card" style="padding:56px 28px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:13px">
    <div style="width:54px;height:54px;border-radius:14px;border:1px solid var(--line-2);display:grid;place-items:center;color:var(--accent)"><svg viewBox="0 0 24 24" width="24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></div>
    <h2 style="font-size:20px;font-weight:600;letter-spacing:-.01em">No audits yet</h2>
    <p style="color:var(--fg-dim);max-width:44ch;font-size:14px">Upload your job data — tickets, invoices, photos, rate sheets — and run your first audit. Recoverable revenue and findings will show up here.</p>
    <a href="/onboarding" class="btn btn-primary" style="margin-top:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Run your first audit</a>
  </div>`;
}

function fullStats(d: DashboardData): string {
  return `<div class="heromx">
        <div class="hm-main">
          <div class="hm-k">Caught Before Invoicing · This Month</div>
          <div class="hm-v">${d.recoverableMonth}</div>
          <div class="hm-d"><b class="up">+18%</b> vs last month · found before the invoice goes out</div>
        </div>
        <div class="hm-side">
          <div class="hm-sk">At-Risk Job Value</div>
          <div class="hm-sv">${d.atRisk}</div>
          <div class="hm-ss">unapproved findings &amp; missing backup</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <div class="row1"><span class="label">Jobs Audited</span><span class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></span></div>
          <div class="row2"><span class="big">${d.jobsAudited}</span>
            <svg class="spark" viewBox="0 0 96 38" fill="none" preserveAspectRatio="none"><path d="M1 30 L13 26 L25 28 L37 18 L49 22 L61 12 L73 15 L83 6 L95 9" stroke="var(--up)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 30 L13 26 L25 28 L37 18 L49 22 L61 12 L73 15 L83 6 L95 9 L95 38 L1 38 Z" fill="url(#sg)"/><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--up)" stop-opacity=".22"/><stop offset="1" stop-color="var(--up)" stop-opacity="0"/></linearGradient></defs></svg>
          </div>
          <div class="delta"><b class="up">+9%</b> vs last week</div>
        </div>
        <div class="stat">
          <div class="row1"><span class="label">Avg. Caught / Job</span><span class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span></div>
          <div class="row2"><span class="big">$486</span>
            <svg class="spark" viewBox="0 0 96 38" fill="none" preserveAspectRatio="none"><path d="M1 26 L13 28 L25 20 L37 24 L49 16 L61 19 L73 11 L83 14 L95 7" stroke="var(--up)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 26 L13 28 L25 20 L37 24 L49 16 L61 19 L73 11 L83 14 L95 7 L95 38 L1 38 Z" fill="url(#sg2)"/><defs><linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--up)" stop-opacity=".22"/><stop offset="1" stop-color="var(--up)" stop-opacity="0"/></linearGradient></defs></svg>
          </div>
          <div class="delta"><b class="up">+2%</b> vs last week</div>
        </div>
        <div class="stat">
          <div class="row1"><span class="label">Invoice-Ready Rate</span><span class="gic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg></span></div>
          <div class="row2"><span class="big">92%</span>
            <svg class="spark" viewBox="0 0 96 38" fill="none" preserveAspectRatio="none"><path d="M1 10 L13 8 L25 14 L37 11 L49 18 L61 15 L73 22 L83 20 L95 27" stroke="var(--down)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 10 L13 8 L25 14 L37 11 L49 18 L61 15 L73 22 L83 20 L95 27 L95 38 L1 38 Z" fill="url(#sr)"/><defs><linearGradient id="sr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--down)" stop-opacity=".22"/><stop offset="1" stop-color="var(--down)" stop-opacity="0"/></linearGradient></defs></svg>
          </div>
          <div class="delta"><b class="down">-1.3%</b> vs last week</div>
        </div>
      </div>

      <div class="card trend">
        <div class="trend-head">
          <div class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>Jobs Audited Trend</div>
          <div class="dropdown">Last week <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div>
        </div>
        <div class="big">3,120</div>
        <div class="sub"><b>+8%</b> vs last week</div>
        <div class="chart">
          <div class="gridlines"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="avgline" style="top:25%"></div>
          <div class="yaxis"><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div>
          <div class="bars" id="bars">
            <div class="bar-col" data-day="Sun" data-val="336"><div class="bar" style="height:42%"></div></div>
            <div class="bar-col" data-day="Mon" data-val="440"><div class="bar" style="height:55%"></div></div>
            <div class="bar-col hi" data-day="Tue" data-val="584"><div class="bar" style="height:73%"></div></div>
            <div class="bar-col" data-day="Wed" data-val="384"><div class="bar" style="height:48%"></div></div>
            <div class="bar-col" data-day="Thu" data-val="512"><div class="bar" style="height:64%"></div></div>
            <div class="bar-col" data-day="Fri" data-val="544"><div class="bar" style="height:68%"></div></div>
            <div class="bar-col" data-day="Sat" data-val="320"><div class="bar" style="height:40%"></div></div>
          </div>
          <div class="tooltip" id="tip" style="left:35.7%;top:27%"><span class="dot"></span>Tue : <b>584</b></div>
          <div class="xaxis"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
        </div>
      </div>

      <div class="card tablecard">
        <div class="table-head">
          <div class="t"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>Invoice Risk Monitoring</div>
          <div class="table-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>Search ticket</div>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:42px"><span class="cbx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></th>
              <th><span class="sort">Ticket ID</span></th>
              <th><span class="sort">Subject</span></th>
              <th><span class="sort">Priority</span></th>
              <th><span class="sort">Assigned To</span></th>
              <th><span class="sort">Status</span></th>
              <th><span class="sort">Created Date</span></th>
            </tr>
          </thead>
          <tbody>${riskRows(d.riskRows)}</tbody>
        </table>
      </div>`;
}

function fullRail(): string {
  const act = (label: string) => `<a class="fact" href="/audit">${label} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`;
  return `<div class="rail-note"><b>5</b> items need attention</div>
    <div class="feed">
      <div class="fitem amber"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span><span class="ft"><b>Rate flagged below MSA</b><span>Job #4821 · crane @ $250 vs $375 — <span class="fmoney">+$750 underbill</span></span>${act("Review finding")}</span></div>
      <div class="fitem green"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></span><span class="ft"><b>Missing billable found</b><span>Rigging support never invoiced — <span class="fmoney">+$1,200 recoverable</span></span>${act("Approve recovery")}</span></div>
      <div class="fitem red"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15l-5-5L5 21M3 3l18 18"/></svg></span><span class="ft"><b>Missing field photos</b><span>Job #4821 · 2 of 5 — blocks <span class="fmoney">$4,570</span> from billing</span>${act("Request backup")}</span></div>
      <div class="fitem red"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg></span><span class="ft"><b>SLA breach risk</b><span>Invoice #2320 due in 6 hrs · short-pay risk</span>${act("Generate packet")}</span></div>
      <div class="fitem green"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg></span><span class="ft"><b>Audit completed</b><span>Job #4799 · <span class="fmoney">$1,940 recoverable</span> across 6 findings</span>${act("Review job")}</span></div>
    </div>`;
}

function emptyRail(): string {
  return `<div class="rail-note">No activity yet</div>
    <div class="feed">
      <div class="fitem neutral"><span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg></span><span class="ft"><b>Run a readiness check to get started</b><span>Readiness gaps and fixes show up here.</span></span></div>
    </div>`;
}

export function dashboardHtml(d: DashboardData): string {
  const sub = d.empty
    ? "Upload your job data and run your first audit — we'll surface the revenue at risk."
    : "Here's the revenue at risk between the field and your invoices.";
  return `
<div class="app">

  <aside class="sidebar">
    <div class="sb-head">
      <div class="sb-brand">
        <span class="mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z"/></svg></span>
        <b>SYNNR</b>
      </div>
      <button class="sb-collapse" aria-label="Collapse"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg></button>
    </div>

    <div class="sb-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>Search anything<span class="kbd">⌘K</span></div>

    <div class="sb-section">
      <div class="sb-label">Main navigation</div>
      <nav class="sb-nav">
        <div class="nav-item active"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Overview</div>
        <div class="nav-item open" data-toggle="jobs"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg>Jobs<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
        <div class="subnav" id="jobs">
          <a class="on" href="#">All / My Queue</a>
          <a href="#">At-Risk Billables</a>
          <a href="#">Disputes</a>
        </div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>Clients</div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.3 3-5 6.5-5s6.5 1.7 6.5 5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M22 20c0-2.6-1.8-4.2-4.5-4.7"/></svg>Crews &amp; Teams<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5V20.5"/></svg>Pricebook<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7h4a3 3 0 0 1 0 6h-1M10 17H6a3 3 0 0 1 0-6h1M8 12h8"/></svg>Integrations</div>
      </nav>
    </div>

    <div class="sb-section">
      <div class="sb-label">Analytics &amp; Insights</div>
      <nav class="sb-nav">
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>Job Readiness</div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v9l6 3"/><circle cx="12" cy="12" r="9"/></svg>Rate Compliance</div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>Backup Coverage</div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h12l4 4v12H4Z"/><path d="M8 12h8M8 16h5"/></svg>Reports</div>
      </nav>
    </div>

    <div class="sb-section">
      <div class="sb-label">Support</div>
      <nav class="sb-nav">
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Feedback</div>
        <div class="nav-item"><svg class="lead" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .8-1 1.7M12 17h.01"/></svg>Help &amp; Support</div>
      </nav>
    </div>

    <div class="sb-foot">
      <div class="sb-user">
        <span class="av">${(d.greeting[0] || "S").toUpperCase()}</span>
        <span class="nm"><b>${d.greeting}</b><span>${d.plan || "Operations"}</span></span>
        <span class="more"><svg viewBox="0 0 24 24" width="16" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg></span>
      </div>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <button class="hamb" id="hamb" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
      <div class="crumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
        Overview <span class="sep">/</span> <span class="cur">Dashboard</span>
      </div>
      <div class="topbar-r">
        <button class="icon-btn" aria-label="Notifications"><span class="badge"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></button>
        <button class="icon-btn" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.5a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 4 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6h.1A1.6 1.6 0 0 0 10 2.5a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.1 1z"/></svg></button>
        <a href="/onboarding" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>New readiness check</a>
      </div>
    </div>

    <div class="main-body">
      <div class="dview on" data-view="overview">
        <div class="greet">
          <h1>Hello, ${d.greeting}</h1>
          <p>${sub}</p>
        </div>
        ${d.empty ? emptyOverview() : fullStats(d)}
      </div>
      <div class="dview" id="dynView" hidden></div>
    </div>
  </main>

  <aside class="rail">
    <div class="rail-head">
      <div class="r1">
        <h3>Latest Updates</h3>
        <div class="seg"><button class="on">Today</button><button>Week</button></div>
      </div>
      <div class="rail-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/></svg>Search activities</div>
    </div>
    ${d.empty ? emptyRail() : fullRail()}
  </aside>

  <div class="drawer-scrim" id="scrim"></div>

</div>
`;
}
