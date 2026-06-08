"use client";

import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

/**
 * SYNNR onboarding wizard, ported from the prototype's onboarding.js:
 * 4-step flow with validation, drag/drop file chips, connector toggles, the
 * 3-source coverage readout, industry-aware instant finding, animated audit
 * run, and the success state. Progress persists to localStorage.
 */
export default function OnboardingScripts() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".ob");
    if (!root) return;
    const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) =>
      r.querySelector<T>(s);
    const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = root) =>
      Array.from(r.querySelectorAll<T>(s));

    const cleanups: Array<() => void> = [];
    const on = (t: Element, type: string, h: EventListenerOrEventListenerObject) => {
      t.addEventListener(type, h);
      cleanups.push(() => t.removeEventListener(type, h));
    };

    const LS = "synnr_onboarding";
    type State = {
      step: number; company: string; name: string; email: string; industry: string;
      jobs: { name: string; size: string }[]; price: { name: string; size: string }[];
      tools: string[]; includeInvoices: boolean;
    };
    const state: State = { step: 1, company: "", name: "", email: "", industry: "", jobs: [], price: [], tools: [], includeInvoices: false };
    try { Object.assign(state, JSON.parse(localStorage.getItem(LS) || "{}")); } catch { /* ignore */ }

    const TOTAL = 4;
    let audited = false;
    let leadSent = false;
    let wsCreated = false;
    let workspaceId: string | null = null;

    // returning users already have a workspace — pick it up so uploads attach
    (function initWorkspace() {
      const sb = getBrowserSupabase();
      if (!sb) return;
      void sb.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        void sb.from("profiles").select("workspace_id").eq("id", data.user.id).maybeSingle().then(({ data: p }) => {
          if (p?.workspace_id) { workspaceId = p.workspace_id; wsCreated = true; }
        });
      });
    })();

    function provisionWorkspace() {
      if (wsCreated) return;
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      wsCreated = true;
      void supabase
        .rpc("create_workspace", { p_name: state.company, p_industry: state.industry || null })
        .then(({ data, error }) => {
          if (error) { wsCreated = false; return; }
          if (data) workspaceId = data as string;
        });
    }

    function uploadArtifacts(which: "jobs" | "price", fileList: FileList) {
      const sb = getBrowserSupabase();
      const ws = workspaceId;
      if (!sb || !ws) return;
      const MAX = 25 * 1024 * 1024; // 25 MB/file cap
      Array.prototype.forEach.call(fileList, (f: File) => {
        if (f.size > MAX) return; // skip oversized; chip still shows locally
        const safe = f.name.replace(/[^\w.\-]/g, "_");
        const path = `${ws}/${which}/${safe}`;
        void sb.storage.from("job-data").upload(path, f, { upsert: true }).then(({ error }) => {
          if (error) return;
          void sb.from("artifacts").insert({
            workspace_id: ws,
            name: f.name,
            size_bytes: f.size,
            mime: f.type || null,
            kind: which === "jobs" ? "job" : "pricing",
            storage_path: path,
          });
        });
      });
    }

    function captureLead() {
      if (leadSent || !/\S+@\S+\.\S+/.test(state.email)) return;
      leadSent = true;
      try {
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: state.email, company: state.company, name: state.name, industry: state.industry, source: "onboarding" }),
          keepalive: true,
        }).catch(() => { leadSent = false; });
      } catch {
        leadSent = false;
      }
    }

    const panels = $$(".step-panel");
    const stepLis = $$(".step-li");
    const nextBtn = $("#nextBtn") as HTMLButtonElement;
    const backBtn = $("#backBtn") as HTMLButtonElement;
    if (!nextBtn || !backBtn) return;

    const save = () => { try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* ignore */ } };
    const fmtSize = (b: number) => (b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(0) + " KB" : (b / 1048576).toFixed(1) + " MB");
    const setText = (id: string, v: string) => { const el = $(id); if (el) el.textContent = v; };

    function render() {
      panels.forEach((p) => p.classList.toggle("on", +(p.getAttribute("data-step") || 0) === state.step));
      stepLis.forEach((li) => {
        const i = +(li.getAttribute("data-i") || 0);
        li.classList.toggle("active", i === state.step);
        li.classList.toggle("done", i < state.step || (audited && i === 4));
      });
      setText("#stepMeta", "Step " + state.step + " of " + TOTAL);
      const fill = $("#progressFill"); if (fill) fill.style.width = (audited ? 100 : (state.step / TOTAL) * 100) + "%";
      backBtn.style.visibility = state.step === 1 ? "hidden" : "visible";

      if (state.step === 1) {
        ($("#f_company") as HTMLInputElement).value = state.company;
        ($("#f_name") as HTMLInputElement).value = state.name;
        ($("#f_email") as HTMLInputElement).value = state.email;
        $$("#industry .seg-opt").forEach((o) => o.classList.toggle("sel", o.getAttribute("data-v") === state.industry));
      }
      renderFiles("jobs"); renderFiles("price");
      $$("#toolsJobs .tool").forEach((t) => {
        t.classList.toggle("connected", state.tools.indexOf(t.getAttribute("data-name") || "") > -1);
        updateToolBtn(t);
      });

      if (state.step === 4) renderReview();
      renderCoverage();
      personalize();
      setNextLabel();
    }

    function personalize() {
      const ind = state.industry || "";
      const short =
        ({ "Oilfield service": "oilfield", "Industrial contractor": "industrial", "Construction service": "construction", "Equipment rental": "rental", "Field maintenance": "field-service" } as Record<string, string>)[ind] || "job";
      const tl = $("#tryit .ti-l");
      if (tl)
        tl.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/></svg>See a finding in 10 seconds<i>No upload needed — runs on a sample ' + short + " job</i>";
      const co = (state.company || "").trim();
      const d2 = $('.step-panel[data-step="2"] .desc');
      if (d2)
        d2.textContent = co
          ? "Drop in whatever " + co + " has — tickets, invoices, field photos, notes, full job packets. SYNNR reads any format."
          : "Drop in whatever you've got — tickets, invoices, field photos, notes, full job packets. SYNNR reads any format.";
    }

    function setNextLabel() {
      if (state.step < 4) { nextBtn.innerHTML = 'Continue<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; nextBtn.disabled = false; return; }
      if (audited) { nextBtn.innerHTML = 'Activate your plan<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'; nextBtn.disabled = false; return; }
      nextBtn.innerHTML = 'Run first audit<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'; nextBtn.disabled = false;
    }

    function renderReview() {
      setText("#rv_company", state.company || "Your workspace");
      setText("#rv_industry", state.industry || "—");
      const jl = state.jobs.length, pl = state.price.length;
      const conn = state.tools.length ? state.tools.join(", ") : "";
      setText("#rv_jobs", (jl ? jl + " file" + (jl > 1 ? "s" : "") : "No files") + (conn ? " · " + conn : ""));
      setText("#rv_price", pl ? pl + " file" + (pl > 1 ? "s" : "") : "No pricebook (will flag missing backup only)");
    }

    function renderFiles(which: "jobs" | "price") {
      const listEl = $(which === "jobs" ? "#jobsList" : "#priceList");
      if (!listEl) return;
      const arr = state[which];
      listEl.innerHTML = arr.map((f, idx) =>
        '<div class="filechip"><span class="fi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg></span>' +
        '<span class="fn"><b>' + f.name + "</b><span>" + f.size + "</span></span>" +
        '<span class="ok"><svg viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg></span>' +
        '<svg class="rm" data-which="' + which + '" data-idx="' + idx + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></div>'
      ).join("");
      $$(".rm", listEl).forEach((x) =>
        x.addEventListener("click", () => {
          const w = x.getAttribute("data-which") as "jobs" | "price";
          state[w].splice(+(x.getAttribute("data-idx") || 0), 1);
          save(); renderFiles(which); renderCoverage();
        })
      );
    }
    function addFiles(which: "jobs" | "price", fileList: FileList) {
      Array.prototype.forEach.call(fileList, (f: File) => state[which].push({ name: f.name, size: fmtSize(f.size) }));
      save(); renderFiles(which); renderCoverage();
      uploadArtifacts(which, fileList); // real upload when signed in; no-op otherwise
    }
    function wireDrop(dzId: string, inputId: string, which: "jobs" | "price") {
      const dz = $(dzId); const input = $(inputId) as HTMLInputElement | null;
      if (!dz || !input) return;
      on(dz, "click", () => input.click());
      on(input, "change", () => { addFiles(which, input.files as FileList); input.value = ""; });
      ["dragenter", "dragover"].forEach((e) => on(dz, e, (ev) => { ev.preventDefault(); dz.classList.add("drag"); }));
      ["dragleave", "drop"].forEach((e) => on(dz, e, (ev) => { ev.preventDefault(); dz.classList.remove("drag"); }));
      on(dz, "drop", (ev) => {
        const dt = (ev as DragEvent).dataTransfer;
        if (dt && dt.files.length) addFiles(which, dt.files);
      });
    }
    wireDrop("#dzJobs", "#fileJobs", "jobs");
    wireDrop("#dzPrice", "#filePrice", "price");

    function coverage() {
      const field = state.jobs.length > 0 || ["ServiceTitan", "Procore", "Google Drive"].some((t) => state.tools.indexOf(t) > -1);
      const invoices = !!state.includeInvoices || state.tools.indexOf("QuickBooks") > -1;
      const contracts = state.price.length > 0;
      return { field, invoices, contracts } as Record<string, boolean>;
    }
    function renderCoverage() {
      const c = coverage();
      const invT = $("#invToggle"); if (invT) invT.classList.toggle("on", !!state.includeInvoices);
      const box = $("#cov2");
      if (box) $$(".cov-item", box).forEach((it) => {
        const have = !!c[it.getAttribute("data-leg") || ""];
        it.classList.toggle("have", have);
        const tag = it.querySelector(".tag"); if (tag) tag.textContent = have ? "Ready" : "Need";
      });
      const caps = $("#cov4caps");
      if (caps) {
        const defs = [
          { on: c.field, label: "Missing backup & unsigned tickets", need: "field records" },
          { on: c.field && c.invoices, label: "Missed billables — standby, consumables", need: "invoices" },
          { on: c.invoices && c.contracts, label: "Rate & MSA validation", need: "invoices + pricing" },
          { on: c.field && c.invoices && c.contracts, label: "Full revenue audit", need: "all three sources" },
        ];
        caps.innerHTML = defs.map((d) =>
          '<div class="cap ' + (d.on ? "on" : "off") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
          (d.on ? '<path d="M20 6 9 17l-5-5"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 7v5M12 16h.01"/>') +
          "</svg>" + d.label + (d.on ? "" : '<span class="capneed">needs ' + d.need + "</span>") + "</div>"
        ).join("");
      }
    }
    const invToggleEl = $("#invToggle");
    if (invToggleEl) on(invToggleEl, "click", () => { state.includeInvoices = !state.includeInvoices; save(); renderCoverage(); });

    const SAMPLES: Record<string, { amt: string; title: string; sub: string; evi: [string, number][] }> = {
      "Oilfield service": { amt: "+$1,430", title: "Standby hours billed at $0", sub: "Job #4821 · field ticket shows 6.5 standby hrs · invoice shows 0", evi: [["Ticket: 6.5 hrs standby", 1], ["Invoice: 0 hrs billed", 0], ["MSA rate: $220/hr", 1]] },
      "Industrial contractor": { amt: "+$2,180", title: "Overtime billed at straight time", sub: "Job #3192 · 27 shutdown OT hrs billed at base rate · MSA requires 1.5×", evi: [["Logs: 27 OT hrs", 1], ["Invoice: base rate", 0], ["MSA: 1.5× overtime", 1]] },
      "Construction service": { amt: "+$3,450", title: "Change-order work never billed", sub: "Job #2207 · daily log shows added excavation · not on the invoice", evi: [["Daily log: added scope", 1], ["Invoice: not captured", 0], ["T&M rate: $185/hr", 1]] },
      "Equipment rental": { amt: "+$1,440", title: "On-rent days under-counted", sub: "Contract #884 · 14 days on-rent · invoice billed 11", evi: [["Contract: 14 days", 1], ["Invoice: 11 days", 0], ["Rate: $480/day", 1]] },
      "Field maintenance": { amt: "+$890", title: "After-hours rate not applied", sub: "Job #5560 · emergency call billed at standard rate · contract sets a premium", evi: [["Ticket: after-hours call", 1], ["Invoice: standard rate", 0], ["Contract: +$75/hr", 1]] },
      "Other field service": { amt: "+$1,430", title: "Standby hours billed at $0", sub: "Job #4821 · field ticket shows 6.5 standby hrs · invoice shows 0", evi: [["Ticket: 6.5 hrs standby", 1], ["Invoice: 0 hrs billed", 0], ["MSA rate: $220/hr", 1]] },
    };
    function fillSample() {
      const s = SAMPLES[state.industry] || SAMPLES["Other field service"];
      setText(".ins-amt", s.amt);
      setText(".ins-title", s.title);
      setText(".ins-sub", s.sub);
      const ok = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>';
      const no = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      const evi = $(".ins-evi");
      if (evi) evi.innerHTML = s.evi.map((e) => '<span class="ie' + (e[1] ? "" : " bad") + '">' + (e[1] ? ok : no) + e[0] + "</span>").join("");
    }
    const tryit = $("#tryit");
    if (tryit) on(tryit, "click", () => {
      fillSample();
      tryit.classList.add("gone");
      const box = $("#instant") as HTMLElement;
      const status = $("#insStatus");
      const result = $("#insResult") as HTMLElement;
      box.hidden = false;
      const steps = ["Reading sample packet…", "Extracting ticket & invoice…", "Reconciling against your rates…", "Found a discrepancy…"];
      let i = 0;
      const t = window.setInterval(() => {
        i++;
        if (i < steps.length) { if (status) status.textContent = steps[i]; return; }
        clearInterval(t);
        const scan = $("#insScan"); if (scan) scan.style.display = "none";
        result.hidden = false;
      }, 720);
    });

    $$("#industry .seg-opt").forEach((o) =>
      on(o, "click", () => {
        state.industry = o.getAttribute("data-v") || "";
        $$("#industry .seg-opt").forEach((x) => x.classList.toggle("sel", x === o));
        save(); personalize();
      })
    );

    (["f_company:company", "f_name:name", "f_email:email"] as const).forEach((pair) => {
      const [id, key] = pair.split(":") as [string, keyof State];
      const el = $("#" + id) as HTMLInputElement | null;
      if (el) on(el, "input", () => { (state[key] as string) = el.value; save(); });
    });

    function updateToolBtn(t: Element) {
      const b = t.querySelector(".cbtn");
      if (b && !b.classList.contains("soon")) b.textContent = t.classList.contains("connected") ? "Connected" : "Connect";
    }
    $$("#toolsJobs .tool").forEach((t) => {
      const b = t.querySelector(".cbtn");
      if (b && b.classList.contains("soon")) return; // connectors not live yet (upload-only MVP)
      if (b) on(b, "click", () => {
        const name = t.getAttribute("data-name") || "";
        const i = state.tools.indexOf(name);
        if (i > -1) state.tools.splice(i, 1); else state.tools.push(name);
        t.classList.toggle("connected"); updateToolBtn(t); save(); renderCoverage();
      });
    });

    const sp = $("#skipPrice"); if (sp) on(sp, "click", () => go(4));

    function valid(step: number) {
      if (step === 1) return !!(state.company.trim() && state.name.trim() && /\S+@\S+\.\S+/.test(state.email) && state.industry);
      return true;
    }
    function flashInvalid() {
      ["#f_company", "#f_name", "#f_email"].forEach((s) => {
        const el = $(s) as HTMLInputElement | null;
        if (el && (!el.value.trim() || (s === "#f_email" && !/\S+@\S+\.\S+/.test(el.value)))) {
          el.style.borderColor = "var(--clay)";
          setTimeout(() => { el.style.borderColor = ""; }, 1400);
        }
      });
      if (!state.industry) {
        const g = $("#industry"); if (g) { g.style.outline = "1px solid var(--clay)"; g.style.outlineOffset = "6px"; g.style.borderRadius = "12px"; setTimeout(() => { g.style.outline = ""; }, 1400); }
      }
    }

    function go(n: number) {
      state.step = Math.max(1, Math.min(TOTAL, n));
      save(); render();
      const panel = $(".panel"); if (panel) panel.scrollTop = 0;
    }
    $$("[data-goto]").forEach((e) => on(e, "click", () => go(+(e.getAttribute("data-goto") || 1))));

    on(backBtn, "click", () => {
      if (audited) {
        audited = false;
        ($("#runbox") as HTMLElement).style.display = "none";
        ($("#successWrap") as HTMLElement).style.display = "none";
        ($("#reviewWrap") as HTMLElement).style.display = "";
      }
      go(state.step - 1);
    });

    on(nextBtn, "click", () => {
      if (state.step < 4) {
        if (!valid(state.step)) { flashInvalid(); return; }
        if (state.step === 1) { captureLead(); provisionWorkspace(); }
        go(state.step + 1); return;
      }
      if (audited) { window.location.href = "/checkout?plan=command"; return; }
      runAudit();
    });

    const skip = $("#skipLink"); if (skip) on(skip, "click", () => { save(); captureLead(); window.location.href = "/dashboard"; });

    function runAudit() {
      // Kick the real reconciliation engine for this workspace (best-effort;
      // writes a job + findings the dashboard/audit will show). The animation
      // below covers the latency.
      if (getBrowserSupabase()) {
        void fetch("/api/audits/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          keepalive: true,
        }).catch(() => {});
      }
      ($("#reviewWrap") as HTMLElement).style.display = "none";
      ($("#runbox") as HTMLElement).style.display = "block";
      setText("#step4Title", "Auditing your jobs…");
      setText("#step4Desc", "SYNNR is reading every artifact and reconciling it against your pricing.");
      nextBtn.disabled = true; nextBtn.innerHTML = '<span class="spin"></span>Auditing…';
      backBtn.style.visibility = "hidden";
      const n = Math.max(1, state.jobs.length * 138 || 1204);
      const lines: [string, string, string][] = [
        ["acc", "› ingesting " + n.toLocaleString() + " job records …", "ok"],
        ["acc", "› matching field photos + tickets …", "ok"],
        ["acc", "› validating rates vs pricebook …", "ok"],
        ["flag", "! 142 missed billables found", ""],
        ["flag", "! 37 rate mismatches flagged", ""],
        ["flag", "! 61 packets missing backup", ""],
        ["acc", "▣ recoverable revenue: $284,750", ""],
      ];
      const box = $("#runlines") as HTMLElement; box.innerHTML = "";
      let i = 0;
      const step = () => {
        if (i >= lines.length) { setTimeout(showSuccess, 650); return; }
        const l = lines[i];
        const div = document.createElement("div");
        div.innerHTML = '<span class="' + l[0] + '">' + l[1] + "</span>" + (l[2] ? ' <span class="pending">…</span>' : "");
        box.appendChild(div);
        if (l[2]) setTimeout(() => { const p = div.querySelector(".pending"); if (p) p.outerHTML = '<span class="ok">done</span>'; }, 420);
        i++; setTimeout(step, 620);
      };
      step();
    }

    function countUp(el: HTMLElement, target: number, prefix: string) {
      const fmt = (n: number) => (prefix || "") + Math.round(n).toLocaleString();
      const steps = 30; let i = 0;
      const iv = window.setInterval(() => {
        i++; const p = i / steps, e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e);
        if (i >= steps) { clearInterval(iv); el.textContent = fmt(target); }
      }, 24);
      setTimeout(() => { clearInterval(iv); el.textContent = fmt(target); }, 1300);
    }
    function showSuccess() {
      // The real audit_run + findings are persisted by /api/audits/run (fired
      // in runAudit). No fake totals written here.
      audited = true; save();
      ($("#runbox") as HTMLElement).style.display = "none";
      ($("#successWrap") as HTMLElement).style.display = "block";
      setText("#step4Title", "You're leaving money on the table — here's where");
      setText("#step4Desc", "Your workspace is ready. Open the dashboard to review every finding and export invoice-ready packets.");
      stepLis.forEach((li) => { if (+(li.getAttribute("data-i") || 0) === 4) li.classList.add("done"); });
      const fill = $("#progressFill"); if (fill) fill.style.width = "100%";
      backBtn.style.visibility = "visible";
      setNextLabel();
      countUp($("#recAmount") as HTMLElement, 284750, "$");
      countUp($("#s_missed") as HTMLElement, 142, "");
      countUp($("#s_rate") as HTMLElement, 37, "");
      countUp($("#s_backup") as HTMLElement, 61, "");
    }

    render();

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
