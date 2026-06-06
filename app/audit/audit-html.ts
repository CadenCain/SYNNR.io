// SYNNR audit-detail markup (ported from the design prototype). Behaviour
// (approve / re-bill / mark recovered / dismiss + live pipeline) is in AuditScripts.
export const AUDIT_HTML = `
<div class="topbar2">
  <a class="back" href="/dashboard"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Back to dashboard</a>
  <div class="brandmini"><span class="mk"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z"/></svg></span><b>SYNNR</b></div>
</div>

<div class="wrap">
  <div class="jhead">
    <div>
      <span class="seclabel" style="margin:0 0 12px">Audit · Job #RC-4821</span>
      <h1>Standby &amp; rigging — Pad 14 turnaround</h1>
      <div class="jmeta">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>Apex Midstream · MSA #882</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>Closed Aug 14, 2025</span>
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 18v-5l3-6h8l3 6v5"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/></svg>Crew B-7 · Mike Ross</span>
      </div>
    </div>
  </div>

  <div class="pipe">
    <div class="pcell found"><div class="k">Recoverable found</div><div class="v" id="vFound">$4,570</div><div class="s">detected by SYNNR</div></div>
    <div class="parr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
    <div class="pcell billing"><div class="k">In billing</div><div class="v" id="vBilling">$0</div><div class="s">approved &amp; re-billed</div></div>
    <div class="parr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>
    <div class="pcell recovered"><div class="k">Recovered</div><div class="v" id="vRecovered">$0</div><div class="s">collected &amp; confirmed</div></div>
  </div>

  <div class="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
    <span><b style="color:var(--fg);font-weight:500">Recovered means re-billed and confirmed collected</b> — not just detected. Approve each finding to send it to billing, then mark it recovered once payment clears. Your dashboard total only counts confirmed dollars.</span>
  </div>

  <div class="seclabel">Findings to review <span class="ct" id="openCount">5 open</span></div>
  <div id="findings">

    <div class="finding t-missed" data-id="f1" data-amt="1430">
      <div class="fr1">
        <span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>
        <div><div class="ftitle">Unbilled standby hours</div><div class="fsub">Ticket vs invoice delta · 6.5 hrs</div></div>
        <div class="famt">+$1,430</div>
      </div>
      <div class="evi">
        <div class="ev good"><div class="el">Field ticket</div><div class="ed">6.5 standby hrs logged + signed</div></div>
        <div class="ev bad"><div class="el">Invoice as drafted</div><div class="ed">0 standby hrs billed</div></div>
      </div>
      <div class="factions" data-actions></div>
    </div>

    <div class="finding t-rate" data-id="f2" data-amt="2180">
      <div class="fr1">
        <span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/><path d="m15 15 2.5 2.5L20 13"/></svg></span>
        <div><div class="ftitle">Rate billed below MSA</div><div class="fsub">Crane &amp; rigging · MSA #882</div></div>
        <div class="famt">+$2,180</div>
      </div>
      <div class="evi">
        <div class="ev bad"><div class="el">Billed rate</div><div class="ed">$1,250 / day × 4 days = $5,000</div></div>
        <div class="ev good"><div class="el">Contract rate (MSA)</div><div class="ed">$1,795 / day × 4 days = $7,180</div></div>
      </div>
      <div class="factions" data-actions></div>
    </div>

    <div class="finding t-missed" data-id="f3" data-amt="960">
      <div class="fr1">
        <span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6M8 14h8"/></svg></span>
        <div><div class="ftitle">Consumables not reconciled</div><div class="fsub">42 line items vs pricebook</div></div>
        <div class="famt">+$960</div>
      </div>
      <div class="evi">
        <div class="ev good"><div class="el">Pricebook match</div><div class="ed">42 items priced &amp; backed</div></div>
        <div class="ev bad"><div class="el">Invoice as drafted</div><div class="ed">Consumables omitted</div></div>
      </div>
      <div class="factions" data-actions></div>
    </div>

    <div class="finding t-doc" data-id="f4" data-blocker="backup">
      <div class="fr1">
        <span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15l-5-5L5 21M3 3l18 18"/></svg></span>
        <div><div class="ftitle">Missing field photos</div><div class="fsub">3 of 5 backup images absent</div></div>
        <div class="famt muted">blocks billing</div>
      </div>
      <div class="factions" data-actions></div>
    </div>

    <div class="finding t-doc" data-id="f5" data-blocker="sign">
      <div class="fr1">
        <span class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17h16M6 12l3-9 3 9M14 12h6"/></svg></span>
        <div><div class="ftitle">Unsigned service ticket</div><div class="fsub">Customer sign-off pending</div></div>
        <div class="famt muted">blocks billing</div>
      </div>
      <div class="factions" data-actions></div>
    </div>

  </div>

  <div class="barrow">
    <div class="bl"><b id="barTitle">Review each finding to recover this job</b><span id="barSub">$0 of $4,570 recovered · 5 to review</span></div>
    <a href="/dashboard" class="btn btn-primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>Done — back to dashboard</a>
  </div>
</div>
`;
