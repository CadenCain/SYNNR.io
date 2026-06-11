"use client";

import { useEffect } from "react";

/**
 * Marketing-page interactions, ported from the prototype's main-cryptix.js:
 * sticky nav, scroll reveals, count-up, testimonial carousel, pricing toggle,
 * FAQ accordion, smooth anchors, ROI calculator, hero dashboard period toggle
 * + view switching, and the monthly/yearly pricing cycle toggle.
 */
export default function MarketingScripts() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".mkt");
    if (!root) return;

    const cleanups: Array<() => void> = [];
    const on = <K extends keyof WindowEventMap>(
      target: Window | Document | Element,
      type: K | string,
      handler: EventListenerOrEventListenerObject,
      opts?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, handler, opts);
      cleanups.push(() => target.removeEventListener(type, handler, opts));
    };

    const allowMotion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (allowMotion) root.classList.add("js-anim");

    /* sticky nav */
    const nav = document.getElementById("nav");
    const onScrollNav = () => nav?.classList.toggle("scrolled", window.scrollY > 20);
    on(window, "scroll", onScrollNav, { passive: true });
    onScrollNav();

    /* reveals */
    const forceShow = (el: HTMLElement) => {
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = "none";
    };
    const reveals = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    let STALLED = false;
    const revealOne = (el: HTMLElement) => {
      el.classList.add("in");
      if (STALLED) {
        forceShow(el);
        return;
      }
      window.setTimeout(() => {
        if (parseFloat(getComputedStyle(el).opacity) < 0.99) {
          STALLED = true;
          forceShow(el);
          root.querySelectorAll<HTMLElement>(".reveal.in").forEach(forceShow);
        }
      }, 1100);
    };
    const revealCheck = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      for (let i = reveals.length - 1; i >= 0; i--) {
        const r = reveals[i].getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) {
          revealOne(reveals[i]);
          reveals.splice(i, 1);
        }
      }
    };
    on(window, "scroll", revealCheck, { passive: true });
    on(window, "resize", revealCheck);
    revealCheck();
    if (allowMotion)
      requestAnimationFrame(() => requestAnimationFrame(revealCheck));

    /* count-up */
    const animateCount = (el: HTMLElement) => {
      const target = parseFloat(el.getAttribute("data-count") || "0");
      const prefix = el.getAttribute("data-prefix") || "";
      const dur = 1400;
      let start: number | null = null;
      const fmt = (n: number) => prefix + Math.round(n).toLocaleString("en-US");
      const tick = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / dur, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * e);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = fmt(target);
      };
      requestAnimationFrame(tick);
      window.setTimeout(() => {
        if (el.hasAttribute("data-count")) el.textContent = fmt(target);
      }, 1500);
    };
    const counters = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));
    const counterCheck = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      for (let i = counters.length - 1; i >= 0; i--) {
        const r = counters[i].getBoundingClientRect();
        if (r.top < vh * 0.85 && r.bottom > 0) {
          animateCount(counters[i]);
          counters.splice(i, 1);
        }
      }
    };
    on(window, "scroll", counterCheck, { passive: true });
    counterCheck();

    /* testimonial carousel */
    const slides = Array.from(root.querySelectorAll<HTMLElement>(".tslide"));
    const dots = Array.from(root.querySelectorAll<HTMLElement>(".tnav .dots i"));
    let cur = 0;
    let timer: number | null = null;
    const show = (n: number) => {
      cur = (n + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("on", i === cur));
      dots.forEach((d, i) => d.classList.toggle("on", i === cur));
    };
    const next = () => show(cur + 1);
    const prev = () => show(cur - 1);
    const restart = () => {
      if (timer) clearInterval(timer);
      timer = window.setInterval(next, 6000);
    };
    const nb = document.getElementById("tnext");
    const pb = document.getElementById("tprev");
    if (nb) on(nb, "click", () => { next(); restart(); });
    if (pb) on(pb, "click", () => { prev(); restart(); });
    dots.forEach((d, i) => on(d, "click", () => { show(i); restart(); }));
    if (slides.length) restart();
    cleanups.push(() => { if (timer) clearInterval(timer); });

    /* pricing cycle toggle */
    const cycleBtns = Array.from(root.querySelectorAll<HTMLElement>(".toggle button"));
    const amounts = Array.from(root.querySelectorAll<HTMLElement>(".price .amt .n[data-m]"));
    cycleBtns.forEach((b) =>
      on(b, "click", () => {
        cycleBtns.forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        const yearly = b.getAttribute("data-cycle") === "yearly";
        amounts.forEach((a) => {
          const v = yearly ? a.getAttribute("data-y") : a.getAttribute("data-m");
          if (v) a.textContent = v;
        });
      })
    );

    /* faq accordion */
    root.querySelectorAll<HTMLElement>(".qa").forEach((qa) => {
      const btn = qa.querySelector("button");
      const ans = qa.querySelector<HTMLElement>(".ans");
      if (!btn || !ans) return;
      on(btn, "click", () => {
        const isOpen = qa.classList.contains("open");
        root.querySelectorAll<HTMLElement>(".qa.open").forEach((o) => {
          o.classList.remove("open");
          const a = o.querySelector<HTMLElement>(".ans");
          if (a) a.style.maxHeight = "";
        });
        if (!isOpen) {
          qa.classList.add("open");
          ans.style.maxHeight = ans.scrollHeight + "px";
        }
      });
    });

    /* smooth anchors */
    root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      on(a, "click", (e) => {
        const id = a.getAttribute("href") || "";
        if (id.length < 2) return;
        const t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        const y = t.getBoundingClientRect().top + window.scrollY - 88;
        window.scrollTo({ top: y, behavior: "smooth" });
      });
    });

    /* ROI calculator */
    const jobs = document.getElementById("roiJobs") as HTMLInputElement | null;
    const avg = document.getElementById("roiAvg") as HTMLInputElement | null;
    const leak = document.getElementById("roiLeak") as HTMLInputElement | null;
    if (jobs && avg && leak) {
      const f = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
      const setText = (id: string, v: string) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      const calc = () => {
        const j = +jobs.value, a = +avg.value, l = +leak.value;
        setText("roiJobsV", j.toLocaleString());
        setText("roiAvgV", f(a));
        setText("roiLeakV", l.toFixed(1) + "%");
        const leakMo = j * a * (l / 100);
        const recYr = leakMo * 0.6 * 12;
        const leakYr = leakMo * 12;
        const plan = j <= 500
          ? { name: "Recover", mo: 1500, key: "recover" }
          : { name: "Command", mo: 4500, key: "command" };
        const planYr = plan.mo * 12;
        const net = recYr - planYr;
        const mult = recYr / planYr;
        const weeks = (52 * planYr) / recYr;
        setText("roiRecovered", f(recYr));
        setText("roiLeakAnnual", f(leakYr));
        setText("roiPlan", plan.name + " · " + f(planYr) + "/yr");
        setText("roiNet", (net < 0 ? "-" : "") + f(Math.abs(net)));
        setText("roiMultiple", (mult >= 10 ? Math.round(mult) : mult.toFixed(1)) + "×");
        setText("roiPayback", weeks < 1 ? "< 1 week" : "~" + Math.round(weeks) + " weeks");
        const cta = document.getElementById("roiCta") as HTMLAnchorElement | null;
        if (cta) cta.href = "/checkout?plan=" + plan.key;
      };
      [jobs, avg, leak].forEach((s) => on(s, "input", calc));
      calc();
    }

    /* hero dashboard — period toggle + view switching */
    const lc = root.querySelector<SVGSVGElement>(".linechart svg");
    if (lc) {
      const paths = lc.querySelectorAll("path");
      const area = paths[0];
      const line = paths[1];
      const dot = lc.querySelector("circle");
      const amountEl =
        root.querySelector<HTMLElement>(".bc-amount [data-count]") ||
        root.querySelector<HTMLElement>(".bc-amount span");
      const deltaEl = root.querySelector<HTMLElement>(".bc-delta");
      const monthsEl = root.querySelector<HTMLElement>(".bc-months");
      const toggle = root.querySelectorAll<HTMLElement>(".period-toggle span");
      type P = { amt: number; delta: string; pts: number[]; lab: string[] };
      const DATA: Record<string, P> = {
        "1D": { amt: 3910, delta: "+4.2%", pts: [40, 35, 48, 42, 55, 50, 62, 58, 70], lab: ["9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p"] },
        "7D": { amt: 28400, delta: "+11.6%", pts: [30, 42, 38, 50, 46, 60, 72], lab: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
        "1M": { amt: 96750, delta: "+19.1%", pts: [28, 40, 35, 48, 52, 60, 68, 78], lab: ["Wk 1", "", "Wk 2", "", "Wk 3", "", "Wk 4", ""] },
        "1Y": { amt: 284750, delta: "+47.3%", pts: [30, 38, 33, 50, 44, 58, 52, 67, 60, 78, 72, 90], lab: ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"] },
      };
      const coords = (p: number[]) => {
        const n = p.length;
        return p.map((v, i) => [30 + (i / (n - 1)) * 700, 175 - (v / 100) * 130] as [number, number]);
      };
      const lp = (c: [number, number][]) =>
        c.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
      const ap = (c: [number, number][]) =>
        lp(c) + " L" + c[c.length - 1][0].toFixed(1) + ",190 L" + c[0][0].toFixed(1) + ",190 Z";
      const setPeriod = (k: string) => {
        const d = DATA[k];
        if (!d) return;
        const c = coords(d.pts);
        area?.setAttribute("d", ap(c));
        line?.setAttribute("d", lp(c));
        if (dot) {
          dot.setAttribute("cx", c[c.length - 1][0].toFixed(1));
          dot.setAttribute("cy", c[c.length - 1][1].toFixed(1));
        }
        if (amountEl) {
          amountEl.removeAttribute("data-count");
          amountEl.textContent = "$" + d.amt.toLocaleString("en-US");
        }
        if (deltaEl) deltaEl.textContent = d.delta;
        if (monthsEl)
          monthsEl.innerHTML = d.lab.map((l) => "<span>" + l + "</span>").join("");
        toggle.forEach((s) => s.classList.toggle("on", (s.textContent || "").trim() === k));
      };
      toggle.forEach((s) => {
        s.style.cursor = "pointer";
        on(s, "click", () => setPeriod((s.textContent || "").trim()));
      });
    }
    const TITLES: Record<string, string> = {
      dashboard: "Dashboard", audits: "Audits", pricebook: "Pricebook", risk: "Risk flags", packets: "Packets",
    };
    const titleEl = document.getElementById("appViewTitle");
    root.querySelectorAll<HTMLElement>(".app-nav a").forEach((a) =>
      on(a, "click", (e) => {
        e.preventDefault();
        const v = a.getAttribute("data-view") || "";
        root.querySelectorAll<HTMLElement>(".app-nav a.on").forEach((x) => x.classList.remove("on"));
        a.classList.add("on");
        root.querySelectorAll<HTMLElement>(".app-view").forEach((view) =>
          view.classList.toggle("on", view.getAttribute("data-view") === v)
        );
        if (titleEl && TITLES[v]) titleEl.textContent = TITLES[v];
      })
    );

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
