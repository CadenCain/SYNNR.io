"use client";

import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * Dashboard interactions, ported from the prototype's dashboard.js +
 * dashboard-views.js: bar tooltip, checkboxes, collapsible subnav, nav active
 * state, segmented toggles, mobile drawer, row -> audit detail, and the full
 * tab-view registry that swaps the main panel for every sidebar item.
 */
export default function DashboardScripts() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".dash");
    if (!root) return;
    const cleanups: Array<() => void> = [];
    const on = (
      target: Window | Document | Element,
      type: string,
      handler: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, handler, opts);
      cleanups.push(() => target.removeEventListener(type, handler, opts));
    };

    /* ---- bar chart tooltip ---- */
    const bars = root.querySelector<HTMLElement>("#bars");
    const tip = root.querySelector<HTMLElement>("#tip");
    if (bars && tip) {
      const cols = Array.from(bars.querySelectorAll<HTMLElement>(".bar-col"));
      const place = (col: HTMLElement) => {
        cols.forEach((c) => c.classList.remove("hi"));
        col.classList.add("hi");
        const bar = col.querySelector<HTMLElement>(".bar")!;
        const crect = bars.parentElement!.getBoundingClientRect();
        const brect = bar.getBoundingClientRect();
        tip.style.left = brect.left + brect.width / 2 - crect.left + "px";
        tip.style.top = brect.top - crect.top + "px";
        tip.innerHTML =
          '<span class="dot"></span>' + col.getAttribute("data-day") + " : <b>" + col.getAttribute("data-val") + "</b>";
        tip.style.opacity = "1";
      };
      cols.forEach((col) => on(col, "mouseenter", () => place(col)));
      const initial = bars.querySelector<HTMLElement>(".bar-col.hi") || cols[2];
      requestAnimationFrame(() =>
        requestAnimationFrame(() => initial && place(initial))
      );
      on(window, "resize", () => {
        const h = bars.querySelector<HTMLElement>(".bar-col.hi");
        if (h) place(h);
      });
    }

    /* ---- checkboxes ---- */
    root.querySelectorAll<HTMLElement>(".cbx").forEach((cb) =>
      on(cb, "click", () => {
        const isOn = cb.classList.toggle("on");
        if (cb.closest("th")) {
          root.querySelectorAll<HTMLElement>("tbody .cbx").forEach((c) => c.classList.toggle("on", isOn));
        }
      })
    );

    /* ---- collapsible subnav ---- */
    root.querySelectorAll<HTMLElement>(".nav-item[data-toggle]").forEach((it) => {
      const target = root.querySelector<HTMLElement>("#" + it.getAttribute("data-toggle"));
      on(it, "click", () => {
        const open = it.classList.toggle("open");
        if (target) target.style.display = open ? "flex" : "none";
      });
    });

    /* ---- nav active state ---- */
    root.querySelectorAll<HTMLElement>(".sb-nav .nav-item").forEach((it) => {
      if (it.hasAttribute("data-toggle")) return;
      on(it, "click", () => {
        root.querySelectorAll<HTMLElement>(".sb-nav .nav-item.active").forEach((a) => a.classList.remove("active"));
        it.classList.add("active");
      });
    });

    /* ---- rail segmented toggles ---- */
    root.querySelectorAll<HTMLElement>(".seg").forEach((seg) =>
      seg.querySelectorAll<HTMLElement>("button").forEach((b) =>
        on(b, "click", () => {
          seg.querySelectorAll<HTMLElement>("button").forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
        })
      )
    );

    /* ---- mobile drawer ---- */
    const hamb = root.querySelector<HTMLElement>("#hamb");
    const sidebar = root.querySelector<HTMLElement>(".sidebar");
    const scrim = root.querySelector<HTMLElement>("#scrim");
    const openDrawer = () => { sidebar?.classList.add("open"); scrim?.classList.add("show"); };
    const closeDrawer = () => { sidebar?.classList.remove("open"); scrim?.classList.remove("show"); };
    if (hamb) on(hamb, "click", openDrawer);
    if (scrim) on(scrim, "click", closeDrawer);
    const sbc = root.querySelector<HTMLElement>(".sb-collapse");
    if (sbc) on(sbc, "click", () => { if (window.innerWidth <= 1080) closeDrawer(); });
    root.querySelectorAll<HTMLElement>(".sidebar .nav-item:not([data-toggle]), .subnav a").forEach((n) =>
      on(n, "click", () => { if (window.innerWidth <= 1080) closeDrawer(); })
    );

    /* ---- row -> audit detail ---- */
    root.querySelectorAll<HTMLElement>(".tbl tbody tr").forEach((tr) => {
      tr.style.cursor = "pointer";
      on(tr, "click", (e) => {
        if ((e.target as HTMLElement).closest(".cbx")) return;
        window.location.href = "/audit";
      });
    });

    /* =================== tab-view registry =================== */
    const I: Record<string, string> = {
      file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h10l6 6v10H4Z"/><path d="M14 4v6h6"/></svg>',
      dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
      users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.3 3-5 6.5-5s6.5 1.7 6.5 5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M22 20c0-2.6-1.8-4.2-4.5-4.7"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>',
      alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 7h4a3 3 0 0 1 0 6h-1M10 17H6a3 3 0 0 1 0-6h1M8 12h8"/></svg>',
      book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5V20.5"/></svg>',
      chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
      doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h12l4 4v12H4Z"/><path d="M8 12h8M8 16h5"/></svg>',
      help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .8-1 1.7M12 17h.01"/></svg>',
      list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h10M4 18h7"/></svg>',
      dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/><path d="M12 4v10m0 0 4-4m-4 4-4-4"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>',
      msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    };
    const head = (title: string, meta?: string) =>
      '<div class="vsec-h"><h2>' + title + "</h2>" + (meta ? '<span class="meta">' + meta + "</span>" : "") + "</div>";
    const list = (rows: string[]) => '<div class="dlist">' + rows.join("") + "</div>";
    const row = (icon: string, iconCls: string, title: string, sub: string, trail: string) =>
      '<div class="drow"><div class="dic ' + (iconCls || "") + '">' + icon + "</div>" +
      '<div class="dmain"><b>' + title + "</b><span>" + sub + "</span></div>" +
      '<div class="dtrail">' + trail + "</div></div>";
    const val = (v: string, cls?: string) => '<span class="dval ' + (cls || "") + '">' + v + "</span>";
    const pill = (cls: string, txt: string) => '<span class="status ' + cls + '"><span class="sd"></span>' + txt + "</span>";
    const bar = (pct: number) => '<span class="dbar"><i style="width:' + pct + '%"></i></span>';
    const statCards = (cards: { label: string; big: string; delta: string; icon?: string }[]) =>
      '<div class="stats" style="margin-bottom:22px">' +
      cards.map((c) =>
        '<div class="stat"><div class="row1"><span class="label">' + c.label + '</span><span class="gic">' + (c.icon || I.chart) + "</span></div>" +
        '<div class="row2"><span class="big">' + c.big + "</span></div>" +
        '<div class="delta">' + c.delta + "</div></div>"
      ).join("") + "</div>";

    type View = { section: string; title: string; body: () => string };
    const VIEWS: Record<string, View> = {
      jobs: { section: "Jobs", title: "All / My Queue", body: () =>
        head("Job queue", "1,204 jobs") + list([
          row(I.file, "", "#4821 · Standby &amp; rigging — Pad 14", "Apex Midstream · closed Aug 14", val("+$4,570", "pos") + pill("review", "In review")),
          row(I.file, "", "#4805 · Tank cleanout — Yard 3", "Permian Co · closed Aug 13", val("+$2,180", "pos") + pill("open", "Open")),
          row(I.file, "", "#4799 · Pipeline inspection", "Apex Midstream · closed Aug 12", val("+$1,940", "pos") + pill("delivered", "Delivered")),
          row(I.file, "", "#4772 · Crane lift — Site B", "Lone Star Energy · closed Aug 11", val("+$1,430", "pos") + pill("resolved", "Resolved")),
          row(I.file, "", "#4760 · Hydro test — Pad 7", "Permian Co · closed Aug 10", val("+$890", "pos") + pill("delivered", "Delivered")),
          row(I.file, "", "#4741 · Vacuum truck — Route 4", "Apex Midstream · closed Aug 9", val("—", "") + pill("open", "Clean")),
        ]) },
      atrisk: { section: "Jobs", title: "At-Risk Billables", body: () =>
        head("At-risk billables", "$28,400 held") + list([
          row(I.alert, "down", "#4821 · Unsigned ticket", "Holds billing on completed job", val("$4,570") + pill("review", "High")),
          row(I.alert, "down", "#4790 · SLA breach risk", "Invoice due in 6 hours", val("$3,120") + pill("review", "High")),
          row(I.alert, "warn", "#4805 · Missing field photos", "Packet incomplete · 4 of 7 docs", val("$2,180") + pill("open", "Medium")),
          row(I.alert, "warn", "#4772 · Rate below MSA", "Billed under contract rate", val("$1,430") + pill("open", "Medium")),
          row(I.alert, "warn", "#4738 · Standby unbilled", "6.5 hrs not on invoice", val("$1,430") + pill("open", "Medium")),
        ]) },
      disputes: { section: "Jobs", title: "Disputes", body: () =>
        head("Open disputes", "$12,330 at stake") + list([
          row(I.msg, "down", "#4612 · Rate dispute — crane svc", "Apex Midstream · opened Aug 8", val("$6,200") + pill("review", "Awaiting client")),
          row(I.msg, "down", "#4588 · Standby hours contested", "Permian Co · opened Aug 6", val("$3,100") + pill("open", "In review")),
          row(I.msg, "down", "#4570 · Mobilization fee omitted", "Lone Star Energy · opened Aug 4", val("$850") + pill("review", "Awaiting client")),
          row(I.msg, "up", "#4521 · Consumables markup", "Apex Midstream · resolved Aug 5", val("+$2,180", "pos") + pill("resolved", "Won")),
          row(I.msg, "up", "#4498 · Duplicate line item", "Permian Co · resolved Jul 30", val("—") + pill("resolved", "Resolved")),
        ]) },
      clients: { section: "Clients", title: "All clients", body: () =>
        head("Clients", "14 active") + list([
          row(I.user, "", "Apex Midstream", "486 jobs · MSA #882", val("+$132,400", "pos")),
          row(I.user, "", "Permian Co", "372 jobs · MSA #714", val("+$74,900", "pos")),
          row(I.user, "", "Lone Star Energy", "218 jobs · MSA #905", val("+$41,250", "pos")),
          row(I.user, "", "Delaware Basin Ops", "94 jobs · MSA #1102", val("+$22,800", "pos")),
          row(I.user, "", "Cimarron Services", "34 jobs · onboarding", val("+$13,400", "pos")),
        ]) },
      crews: { section: "Crews &amp; Teams", title: "All crews", body: () =>
        head("Crews &amp; teams", "9 crews") + list([
          row(I.users, "", "Crew B-7 · Mike Ross", "6 members · 142 jobs", val("+$48,200", "pos")),
          row(I.users, "", "Crew A-3 · Sarah Lee", "5 members · 118 jobs", val("+$39,600", "pos")),
          row(I.users, "", "Crew C-1 · Dana Kohl", "7 members · 96 jobs", val("+$28,100", "pos")),
          row(I.users, "", "Crew D-5 · Tara White", "4 members · 71 jobs", val("+$19,400", "pos")),
          row(I.users, "", "Crew B-2 · John Doe", "6 members · 64 jobs", val("+$16,900", "pos")),
        ]) },
      pricebook: { section: "Pricebook", title: "Rate conflicts", body: () =>
        head("Rate conflicts vs. contract", "37 found") + list([
          row(I.dollar, "warn", "Crane service — 8 hr", "Billed $180/hr → MSA $220/hr", val("+$40/hr · 18 jobs")),
          row(I.dollar, "warn", "Standby labor", "Billed $0 → MSA $95/hr", val("+$95/hr · 12 jobs")),
          row(I.dollar, "warn", "Mobilization fee", "Missing on 7 invoices", val("$850 each")),
          row(I.dollar, "warn", "Consumables markup", "Billed 8% → MSA 15%", val("+7% · 9 jobs")),
          row(I.check, "up", "Environmental surcharge", "Matches contract on all jobs", pill("delivered", "In line")),
        ]) },
      integrations: { section: "Integrations", title: "Connected sources", body: () =>
        head("Connected sources") + list([
          row(I.file, "up", "ServiceTitan", "Field tickets &amp; job data", pill("delivered", "Connected")),
          row(I.dollar, "up", "QuickBooks", "Invoices &amp; billing", pill("delivered", "Connected")),
          row(I.book, "up", "Google Drive", "Field photos &amp; packets", pill("delivered", "Connected")),
          row(I.link, "", "Procore", "Project &amp; cost data", '<button class="cbtn" data-connect>Connect</button>'),
          row(I.link, "", "Sage Intacct", "GL &amp; AR sync", '<button class="cbtn" data-connect>Connect</button>'),
        ]) },
      recovery: { section: "Analytics", title: "Revenue Recovery", body: () =>
        statCards([
          { label: "Recovered YTD", big: "$284,750", delta: '<b class="up">+47.3%</b> vs last year', icon: I.dollar },
          { label: "This month", big: "$38,200", delta: '<b class="up">+12%</b> vs last month', icon: I.chart },
          { label: "Pending re-bill", big: "$46,900", delta: "63 findings approved", icon: I.file },
        ]) + head("Recovery by type", "YTD") + list([
          row(I.dollar, "up", "Missed billables", "142 across 1,204 jobs", val("+$148,200", "pos")),
          row(I.list, "up", "Rate corrections", "37 pricebook conflicts", val("+$94,300", "pos")),
          row(I.shield, "up", "Backup recovered", "61 packets repaired", val("+$42,250", "pos")),
        ]) },
      compliance: { section: "Analytics", title: "Rate Compliance", body: () =>
        statCards([
          { label: "Compliance rate", big: "94%", delta: '<b class="up">+3%</b> vs last quarter', icon: I.shield },
          { label: "Below-MSA jobs", big: "37", delta: "flagged this cycle", icon: I.alert },
          { label: "Recovered", big: "$94,300", delta: "from rate corrections", icon: I.dollar },
        ]) + head("Compliance findings", "37 open") + list([
          row(I.alert, "warn", "Crane service under MSA", "18 jobs · $40/hr gap", val("+$11,520", "pos")),
          row(I.alert, "warn", "Standby not billed", "12 jobs · $95/hr", val("+$8,200", "pos")),
          row(I.alert, "warn", "Mobilization omitted", "7 invoices", val("+$5,950", "pos")),
          row(I.check, "up", "Environmental surcharge", "Compliant on all jobs", pill("delivered", "Pass")),
        ]) },
      backup: { section: "Analytics", title: "Backup Coverage", body: () =>
        head("Backup coverage", "$8,690 blocked by gaps") + list([
          row(I.shield, "up", "#4833 · Hydro test — Pad 7", "7 of 7 documents · complete", bar(100) + pill("delivered", "Ready")),
          row(I.shield, "down", "#4821 · Crane lift — Site B", "6 of 7 · missing signature", bar(86) + val("$4,570 blocked")),
          row(I.shield, "down", "#4805 · Tank cleanout", "4 of 7 · missing photos", bar(57) + val("$2,180 blocked")),
          row(I.shield, "warn", "#4799 · Pipeline inspection", "5 of 7 · missing time log", bar(71) + val("$1,940 blocked")),
          row(I.shield, "up", "#4760 · Vacuum truck", "7 of 7 documents · complete", bar(100) + pill("delivered", "Ready")),
        ]) },
      reports: { section: "Analytics", title: "Reports", body: () => {
        const badge = (t: string) => '<span class="ftype">' + t + "</span>";
        const dlbtn = () => '<a class="cbtn icon" href="/report" aria-label="Open report">' + I.dl + "</a>";
        return head("Reports", "4 generated") + list([
          row(I.chart, "up", "August recovery report", "$284,750 recovered · 240 findings · Sep 1", badge("PDF") + dlbtn()),
          row(I.shield, "warn", "Q3 rate compliance summary", "94% compliant · $94,300 corrected · Aug 28", badge("PDF") + dlbtn()),
          row(I.file, "", "Backup coverage audit", "78% coverage · $8,690 blocked · Aug 20", badge("CSV") + dlbtn()),
          row(I.users, "", "Client recovery breakdown", "14 clients · top Apex $132,400 · Aug 15", badge("PDF") + dlbtn()),
        ]);
      } },
      feedback: { section: "Support", title: "Feedback", body: () =>
        head("Send feedback") +
        '<div class="fbcard"><p class="lbl">Tell us what’s working and what could be better. The SYNNR team reads every note.</p>' +
        '<textarea id="fbText" placeholder="Your feedback…"></textarea>' +
        '<div class="fbfoot"><button class="cbtn" id="fbSend" style="background:var(--accent);color:#1a1613;border-color:var(--accent);font-weight:600">Send feedback</button></div></div>' },
      help: { section: "Support", title: "Help &amp; Support", body: () =>
        head("Help &amp; support") + list([
          row(I.book, "", "Getting started with SYNNR", "Connect data &amp; run your first audit", pill("open", "Guide")),
          row(I.book, "", "How recovery is detected", "Reconciliation &amp; evidence explained", pill("open", "Guide")),
          row(I.book, "", "Approving &amp; re-billing findings", "From flag to collected", pill("open", "Guide")),
          row(I.msg, "up", "Contact your recovery analyst", "ray@synnr.com · replies in &lt; 4 hrs", pill("delivered", "Live")),
        ]) },
    };

    const LABELMAP: Record<string, string> = {
      Overview: "overview", Clients: "clients", "Crews & Teams": "crews", Pricebook: "pricebook",
      Integrations: "integrations", "Revenue Recovery": "recovery", "Rate Compliance": "compliance",
      "Backup Coverage": "backup", Reports: "reports", Feedback: "feedback", "Help & Support": "help",
    };
    const SUBMAP: Record<string, string> = {
      "All / My Queue": "jobs", "At-Risk Billables": "atrisk", Disputes: "disputes",
    };

    const overviewEl = root.querySelector<HTMLElement>('.dview[data-view="overview"]');
    const dynEl = root.querySelector<HTMLElement>("#dynView");
    const crumb = root.querySelector<HTMLElement>(".topbar .crumb");
    const crumbIcon = crumb ? crumb.querySelector("svg")!.outerHTML : "";

    const setCrumb = (section: string, title: string) => {
      if (crumb) crumb.innerHTML = crumbIcon + " " + section + ' <span class="sep">/</span> <span class="cur">' + title + "</span>";
    };

    const show = (key: string) => {
      if (!overviewEl || !dynEl) return;
      if (key === "overview" || !VIEWS[key]) {
        dynEl.hidden = true; dynEl.innerHTML = "";
        overviewEl.hidden = false;
        overviewEl.classList.remove("dview"); void overviewEl.offsetWidth; overviewEl.classList.add("dview");
        setCrumb("Overview", "Dashboard");
      } else {
        overviewEl.hidden = true;
        const v = VIEWS[key];
        dynEl.innerHTML = '<div class="vsec">' + v.body() + "</div>";
        dynEl.hidden = false;
        dynEl.setAttribute("data-view-key", key);
        dynEl.classList.remove("dview"); void dynEl.offsetWidth; dynEl.classList.add("dview");
        setCrumb(v.section, v.title);
        void hydrate(key); // swap demo rows for live workspace data when signed in
      }
      const main = root.querySelector<HTMLElement>(".main");
      if (main) main.scrollTop = 0;
    };

    // Demo renders instantly; if signed in with live data, replace the rows.
    async function hydrate(key: string) {
      if (!dynEl) return;
      const sb = getBrowserSupabase();
      if (!sb) return;
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;
      const money = (c: number | null) => (c == null ? "—" : "$" + Math.round(c / 100).toLocaleString());
      let rows: string | null = null;

      if (key === "clients") {
        const { data } = await sb.from("clients").select("name, msa_number").order("name");
        if (data?.length) rows = data.map((c) => row(I.user, "", c.name, c.msa_number || "—", "")).join("");
      } else if (key === "crews") {
        const { data } = await sb.from("crews").select("name, lead").order("name");
        if (data?.length) rows = data.map((c) => row(I.users, "", c.name, c.lead ? "Lead · " + c.lead : "—", "")).join("");
      } else if (key === "pricebook") {
        const { data } = await sb.from("pricebook_rules").select("label, billed_cents, contract_cents, note").order("label");
        if (data?.length) rows = data.map((r) => row(I.dollar, "warn", r.label, `Billed ${money(r.billed_cents)} → MSA ${money(r.contract_cents)}`, val(r.note || ""))).join("");
      } else if (key === "integrations") {
        const { data } = await sb.from("integrations").select("name, status").order("name");
        if (data?.length) rows = data.map((i) =>
          row(I.link, i.status === "connected" ? "up" : "", i.name, i.status === "connected" ? "Connected" : "Available",
            i.status === "connected" ? pill("delivered", "Connected") : '<button class="cbtn" data-connect>Connect</button>')
        ).join("");
      } else {
        return;
      }

      const target = dynEl.querySelector(".dlist");
      if (rows && target) target.innerHTML = rows;
    }

    root.querySelectorAll<HTMLElement>(".sb-nav .nav-item").forEach((it) => {
      if (it.hasAttribute("data-toggle")) return;
      const label = (it.textContent || "").trim();
      const key = LABELMAP[label];
      if (!key) return;
      it.setAttribute("data-view", key);
      on(it, "click", () => {
        root.querySelectorAll<HTMLElement>(".subnav a.on").forEach((x) => x.classList.remove("on"));
        show(key);
      });
    });
    root.querySelectorAll<HTMLAnchorElement>(".subnav a").forEach((a) => {
      const key = SUBMAP[(a.textContent || "").trim()];
      if (!key) return;
      a.setAttribute("data-view", key);
      on(a, "click", (e) => {
        e.preventDefault();
        root.querySelectorAll<HTMLElement>(".subnav a.on").forEach((x) => x.classList.remove("on"));
        a.classList.add("on");
        root.querySelectorAll<HTMLElement>(".sb-nav .nav-item.active").forEach((x) => x.classList.remove("active"));
        show(key);
      });
    });

    /* delegated interactions inside rendered views */
    // Job/finding rows open the Audit Detail (operator workflow, not static rows).
    const JOB_VIEWS = ["jobs", "atrisk", "disputes", "backup", "pricebook", "compliance", "recovery"];
    on(root, "click", (e) => {
      const target = e.target as HTMLElement;
      const rowEl = target.closest<HTMLElement>(".drow");
      if (rowEl && !target.closest("a, button, [data-connect], .cbtn")) {
        const key = dynEl?.getAttribute("data-view-key") || "";
        if (JOB_VIEWS.includes(key)) { window.location.href = "/audit"; return; }
      }
      const b = target.closest<HTMLElement>("[data-connect]");
      if (b && !b.classList.contains("done")) {
        b.classList.add("done");
        b.innerHTML = b.classList.contains("icon") ? I.check : I.check + " Done";
        return;
      }
      if (target.id === "fbSend") {
        const t = root.querySelector<HTMLTextAreaElement>("#fbText");
        target.textContent = "Sent — thank you";
        target.style.opacity = ".7";
        if (t) { t.value = ""; t.disabled = true; }
      }
    });

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
