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

    /* operations-audit questionnaire (multi-step lead funnel) */
    const af = root.querySelector<HTMLElement>(".auditform");
    if (af) {
      const answers: Record<string, string> = {};
      const stepsEls = Array.from(af.querySelectorAll<HTMLElement>(".afstep"));
      const dotsEls = Array.from(af.querySelectorAll<HTMLElement>("#afSteps .afdot"));
      const backBtn = af.querySelector<HTMLButtonElement>("#afBack");
      const nextBtn = af.querySelector<HTMLButtonElement>("#afNext");
      const submitBtn = af.querySelector<HTMLButtonElement>("#afSubmit");
      const msg = af.querySelector<HTMLElement>("#afMsg");
      const total = stepsEls.length;
      let step = 1;

      const setMsg = (t: string) => { if (msg) msg.textContent = t; };
      const render = () => {
        stepsEls.forEach((s) => s.classList.toggle("on", +(s.getAttribute("data-step") || 0) === step));
        dotsEls.forEach((d, i) => d.classList.toggle("on", i < step));
        if (backBtn) backBtn.style.visibility = step === 1 ? "hidden" : "visible";
        const last = step === total;
        if (nextBtn) nextBtn.hidden = last;
        if (submitBtn) submitBtn.hidden = !last;
        setMsg("");
      };
      const valid = (): boolean => {
        if (step === 1 && !answers.serviceType) { setMsg("Pick the closest match."); return false; }
        if (step === 2 && !answers.fleetSize) { setMsg("How many trucks or crews?"); return false; }
        if (step === 3) {
          const v = (af.querySelector<HTMLTextAreaElement>("#afBottleneck")?.value || "").trim();
          if (v.length < 3) { setMsg("A line or two helps us prep your audit."); return false; }
          answers.bottleneck = v;
        }
        return true;
      };

      // single-select option groups (auto-advance on steps 1 & 2)
      af.querySelectorAll<HTMLElement>(".afopts").forEach((group) => {
        const field = group.getAttribute("data-field") || "";
        group.querySelectorAll<HTMLElement>(".afopt").forEach((opt) =>
          on(opt, "click", () => {
            group.querySelectorAll<HTMLElement>(".afopt").forEach((o) => o.classList.remove("on"));
            opt.classList.add("on");
            answers[field] = opt.getAttribute("data-v") || "";
            setMsg("");
            window.setTimeout(() => { if (step < 3) { step++; render(); } }, 180);
          })
        );
      });

      if (nextBtn) on(nextBtn, "click", () => { if (valid() && step < total) { step++; render(); } });
      if (backBtn) on(backBtn, "click", () => { if (step > 1) { step--; render(); } });

      if (submitBtn) on(submitBtn, "click", async () => {
        if (!valid()) return;
        const get = (id: string) => (af.querySelector<HTMLInputElement>(id)?.value || "").trim();
        const email = get("#afEmail");
        if (!/\S+@\S+\.\S+/.test(email)) { setMsg("Enter a valid work email."); return; }
        const payload = {
          serviceType: answers.serviceType, fleetSize: answers.fleetSize, bottleneck: answers.bottleneck,
          name: get("#afName"), company: get("#afCompany"), email, phone: get("#afPhone"),
        };
        submitBtn.disabled = true; submitBtn.textContent = "Sending…";
        try {
          const r = await fetch("/api/audit-request", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
          const data = await r.json();
          if (!r.ok || !data.ok) { setMsg(data.error || "Something went wrong — email cadencain@darkstarops.com."); submitBtn.disabled = false; submitBtn.textContent = "Request my audit"; return; }
          stepsEls.forEach((s) => (s.style.display = "none"));
          const nav2 = af.querySelector<HTMLElement>(".afnav"); if (nav2) nav2.style.display = "none";
          const dotsWrap = af.querySelector<HTMLElement>("#afSteps"); if (dotsWrap) dotsWrap.style.display = "none";
          setMsg("");
          const done = af.querySelector<HTMLElement>("#afDone"); if (done) done.hidden = false;
        } catch {
          setMsg("Couldn't reach SYNNR — try again, or email cadencain@darkstarops.com.");
          submitBtn.disabled = false; submitBtn.textContent = "Request my audit";
        }
      });

      render();
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
      dashboard: "Command", audits: "Jobs", pricebook: "Certs & inspections", risk: "Risk flags", packets: "Packets",
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
