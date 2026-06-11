// SYNNR onboarding markup (ported from the design prototype). The 4-step
// wizard behaviour lives in OnboardingScripts.
export const ONBOARDING_HTML = `
<div class="wrap">

  <aside class="rail">
    <div class="brand">
      <span class="mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z"/></svg></span>
      <b>SYNNR</b>
    </div>

    <div class="rail-lede">
      <h2>Stop job failures before they happen.</h2>
      <p>Four quick steps. No integration project. Your first readiness check runs the moment your data lands.</p>
    </div>

    <div class="stepper" id="stepper">
      <div class="step-li active" data-i="1"><span class="dot"><span class="num">1</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="stxt"><b>Create workspace</b><span>Company &amp; team</span></span></div>
      <div class="step-li" data-i="2"><span class="dot"><span class="num">2</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="stxt"><b>Connect job data</b><span>Tickets, photos, packets</span></span></div>
      <div class="step-li" data-i="3"><span class="dot"><span class="num">3</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="stxt"><b>Add pricing &amp; rules</b><span>Pricebook, rates, MSAs, customer rules</span></span></div>
      <div class="step-li" data-i="4"><span class="dot"><span class="num">4</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="stxt"><b>Run readiness check</b><span>See what would have gone wrong</span></span></div>
    </div>

    <div class="rail-foot">
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>Encrypted in transit &amp; at rest</span>
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Your data stays yours</span>
      <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>No credit card</span>
    </div>
  </aside>

  <main class="panel">
    <div class="panel-top">
      <div class="mob-brand"><span class="mark"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z"/></svg></span><b>SYNNR</b></div>
      <div class="meta" id="stepMeta">Step 1 of 4</div>
      <div class="skip" id="skipLink">Save &amp; finish later</div>
    </div>
    <div class="progress"><div class="fill" id="progressFill"></div></div>

    <div class="stage">
      <div class="stage-inner">

        <section class="step-panel on" data-step="1">
          <span class="eyebrow">Create workspace</span>
          <h1>Let's set up your operation</h1>
          <p class="desc">Tell us who you are. This shapes how SYNNR reads your jobs and applies your rates.</p>
          <div class="form">
            <div class="field"><label>Company name <span class="req">*</span></label><input class="input" id="f_company" placeholder="e.g. Permian Field Services" /></div>
            <div class="row2">
              <div class="field"><label>Your name <span class="req">*</span></label><input class="input" id="f_name" placeholder="Ray Mendez" /></div>
              <div class="field"><label>Work email <span class="req">*</span></label><input class="input" id="f_email" type="email" placeholder="ray@company.com" /></div>
            </div>
            <div class="field">
              <label>What kind of work do you run? <span class="req">*</span></label>
              <div class="seg-grid" id="industry">
                <div class="seg-opt" data-v="Oilfield service"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2.7C12 2.7 6 9 6 13.5a6 6 0 0 0 12 0C18 9 12 2.7 12 2.7Z"/></svg></span>Oilfield service<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
                <div class="seg-opt" data-v="Industrial contractor"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M7 18h.01M12 18h.01M17 18h.01"/></svg></span>Industrial<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
                <div class="seg-opt" data-v="Construction service"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2Z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M5 15a7 7 0 0 1 14 0"/></svg></span>Construction<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
                <div class="seg-opt" data-v="Equipment rental"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="7" width="13" height="9" rx="1.5"/><path d="M15 10h3l2 3v3h-5z"/><circle cx="6.5" cy="18" r="1.5"/><circle cx="17.5" cy="18" r="1.5"/></svg></span>Equipment rental<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
                <div class="seg-opt" data-v="Field maintenance"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z"/></svg></span>Field maintenance<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
                <div class="seg-opt" data-v="Other field service"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg></span>Something else<span class="ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span></div>
              </div>
            </div>
          </div>
        </section>

        <section class="step-panel" data-step="2">
          <span class="eyebrow">Connect job data</span>
          <h1>Bring in the mess</h1>
          <p class="desc">Drop in whatever you've got — tickets, invoices, field photos, notes, full job packets. SYNNR reads any format.</p>
          <div class="form">
            <div class="dropzone" id="dzJobs">
              <div class="dz-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg></div>
              <b>Drag &amp; drop job files, or click to browse</b>
              <p>Up to 25 MB per file · we'll de-dupe and organize automatically</p>
              <div class="types"><span>PDF</span><span>JPG / HEIC</span><span>XLSX / CSV</span><span>DOCX</span><span>ZIP</span></div>
              <input type="file" id="fileJobs" multiple hidden />
            </div>
            <button type="button" class="tryit" id="tryit">
              <span class="ti-l"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>See a finding in 10 seconds<i>No upload needed — runs on a sample job packet</i></span>
              <svg class="ti-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
            <div class="instant" id="instant" hidden>
              <div class="ins-scan" id="insScan"><span class="spin"></span><span id="insStatus">Reading sample packet…</span></div>
              <div class="ins-result" id="insResult" hidden>
                <div class="ins-head"><span class="ins-badge">Recoverable</span><span class="ins-amt">+$1,430</span></div>
                <b class="ins-title">Standby hours billed at $0</b>
                <p class="ins-sub">Job #4821 · field ticket shows 6.5 standby hrs · invoice shows 0</p>
                <div class="ins-evi">
                  <span class="ie"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>Ticket: 6.5 hrs standby</span>
                  <span class="ie bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>Invoice: 0 hrs billed</span>
                  <span class="ie"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>MSA rate: $220/hr</span>
                </div>
                <p class="ins-foot"><b>That's one catch on one job.</b> Your real readiness check runs this across every job you upload — most operations surface 100+ in the first pass.</p>
              </div>
            </div>
            <div class="filelist" id="jobsList"></div>
            <label class="invtoggle" id="invToggle"><span class="cbx2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span>My upload includes draft invoices <i>— what you actually billed</i></label>
            <div class="or">or connect a source</div>
            <div class="tools" id="toolsJobs">
              <div class="tool" data-name="QuickBooks"><span class="tl" style="background:#8aa0b8">QB</span><span class="tn"><b>QuickBooks</b><span>Invoices &amp; customers</span></span><span class="cbtn soon">Soon</span></div>
              <div class="tool" data-name="ServiceTitan"><span class="tl" style="background:#c2a36a">ST</span><span class="tn"><b>ServiceTitan</b><span>Jobs &amp; tickets</span></span><span class="cbtn soon">Soon</span></div>
              <div class="tool" data-name="Procore"><span class="tl" style="background:#b58aa0">PC</span><span class="tn"><b>Procore</b><span>Daily logs &amp; T&amp;M</span></span><span class="cbtn soon">Soon</span></div>
              <div class="tool" data-name="Google Drive"><span class="tl" style="background:#9a9082">GD</span><span class="tn"><b>Google Drive</b><span>Folders of packets</span></span><span class="cbtn soon">Soon</span></div>
            </div>
            <p class="tools-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>Don't see your system? Drop files above or connect it later — SYNNR reads any format, from any tool.</p>
            <div class="cov" id="cov2">
              <div class="cov-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>What SYNNR reconciles to find money</div>
              <div class="cov-item" data-leg="field"><span class="cdot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="cl"><b>Field records</b><span>Tickets, photos, notes, time logs</span></span><span class="tag">Need</span></div>
              <div class="cov-item" data-leg="invoices"><span class="cdot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="cl"><b>Invoices</b><span>What you actually billed</span></span><span class="tag">Need</span></div>
              <div class="cov-item" data-leg="contracts"><span class="cdot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg></span><span class="cl"><b>Pricing &amp; contracts</b><span>Pricebook, rates, MSAs — added next step</span></span><span class="tag">Need</span></div>
            </div>
          </div>
        </section>

        <section class="step-panel" data-step="3">
          <span class="eyebrow">Add pricing &amp; rules</span>
          <h1>Teach SYNNR your rates</h1>
          <p class="desc">Upload your pricebook, rate sheets, and customer agreements. This is how SYNNR catches under-billed lines and MSA mismatches.</p>
          <div class="form">
            <div class="dropzone" id="dzPrice">
              <div class="dz-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M8 8h8M8 12h6"/></svg></div>
              <b>Upload pricebook, rate sheets &amp; MSAs</b>
              <p>We map line items to your jobs automatically — you confirm before billing</p>
              <div class="types"><span>XLSX / CSV</span><span>PDF</span><span>DOCX</span></div>
              <input type="file" id="filePrice" multiple hidden />
            </div>
            <div class="filelist" id="priceList"></div>
            <div class="rev-row" style="border:1px solid var(--line);border-radius:12px;margin-top:4px">
              <span class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg></span>
              <span class="rl"><b>No pricebook handy?</b><span>You can add it later — SYNNR will still flag missing backup and unbilled work.</span></span>
              <span class="edit" id="skipPrice">Skip for now</span>
            </div>
          </div>
        </section>

        <section class="step-panel" data-step="4">
          <span class="eyebrow">Run readiness check</span>
          <h1 id="step4Title">Review &amp; run your readiness check</h1>
          <p class="desc" id="step4Desc">Here's what SYNNR will analyze. Kick off your first readiness check — most operations see results in a few minutes.</p>

          <div id="reviewWrap">
            <div class="review">
              <div class="rev-row"><span class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span><span class="rl"><b id="rv_company">Your workspace</b><span id="rv_industry">—</span></span><span class="edit" data-goto="1">Edit</span></div>
              <div class="rev-row"><span class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg></span><span class="rl"><b>Job data</b><span id="rv_jobs">No files yet</span></span><span class="edit" data-goto="2">Edit</span></div>
              <div class="rev-row"><span class="ri"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/></svg></span><span class="rl"><b>Pricing</b><span id="rv_price">No files yet</span></span><span class="edit" data-goto="3">Edit</span></div>
            </div>
            <div class="cov" style="margin-top:16px">
              <div class="cov-h"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>What this check can detect</div>
              <div class="caps" id="cov4caps"></div>
            </div>
          </div>

          <div class="runbox" id="runbox" style="display:none">
            <div class="runlines" id="runlines"></div>
          </div>

          <div id="successWrap" style="display:none">
            <div class="success">
              <span class="eyebrow" style="justify-content:center">Readiness check complete</span>
              <div class="big-amt" id="recAmount">$0</div>
              <p class="desc" style="margin:0 auto">in billable work protected across your uploaded jobs</p>
              <div class="sgrid">
                <div class="scell"><div class="n" id="s_missed">0</div><div class="k">Missed billables</div></div>
                <div class="scell"><div class="n" id="s_rate">0</div><div class="k">Rate mismatches</div></div>
                <div class="scell"><div class="n" id="s_backup">0</div><div class="k">Packets at risk</div></div>
              </div>
              <div class="fpv" id="findPreview"></div>
            </div>
          </div>
        </section>

        <div class="actions" id="actions">
          <button class="btn btn-ghost" id="backBtn" style="visibility:hidden"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>Back</button>
          <button class="btn btn-primary" id="nextBtn">Continue<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>

      </div>
    </div>
  </main>
</div>
`;
