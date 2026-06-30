"use client";

import { useEffect } from "react";

/**
 * Cinematic scroll FX for the marketing homepage. Separate from
 * MarketingScripts so it can be reasoned about in isolation — and so dead
 * code in MarketingScripts (carousel/pricing toggle/etc. from the parked
 * marketplace) can be cleaned up later without touching the FX engine.
 *
 * All effects are:
 *   - GPU-safe (transform/opacity/filter/clip-path only)
 *   - reduced-motion gated (no-ops under prefers-reduced-motion)
 *   - one-shot (each element animates once via IntersectionObserver)
 *   - additive — every effect degrades to "element already visible" if the
 *     observer fires immediately or the JS never runs.
 */
export default function MarketingFx() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".mkt");
    if (!root) return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: Array<() => void> = [];

    /* ---------------------------------------------------------------------
     * 1. Atmospheric depth layers
     * Inject .fx-atmos > i.b1 + i.b2 into every section that opted in via
     * data-fx-atmos. Fades in once when the section enters viewport.
     * ------------------------------------------------------------------- */
    const atmosSections = Array.from(root.querySelectorAll<HTMLElement>("section[data-fx-atmos]"));
    for (const section of atmosSections) {
      if (section.querySelector(":scope > .fx-atmos")) continue; // already injected
      const wrap = document.createElement("div");
      wrap.className = "fx-atmos";
      wrap.setAttribute("aria-hidden", "true");
      const b1 = document.createElement("i");
      b1.className = "b1";
      const b2 = document.createElement("i");
      b2.className = "b2";
      wrap.append(b1, b2);
      section.prepend(wrap);
    }

    const atmosObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.querySelector(":scope > .fx-atmos")?.classList.add("in");
            atmosObserver.unobserve(e.target);
          }
        }
      },
      { rootMargin: "-10% 0px -10% 0px", threshold: 0 },
    );
    atmosSections.forEach((s) => atmosObserver.observe(s));
    cleanups.push(() => atmosObserver.disconnect());

    /* ---------------------------------------------------------------------
     * 2. Word-by-word headline reveal
     * Split [data-fx="words"] heading textContent into .fx-word spans, then
     * IO-toggle .in with a per-word delay. Removes .reveal first so the
     * existing whole-element fade doesn't double up.
     * ------------------------------------------------------------------- */
    const wordTargets = Array.from(root.querySelectorAll<HTMLElement>('[data-fx="words"]'));
    for (const el of wordTargets) {
      if (el.dataset.fxBuilt) continue;
      el.classList.remove("reveal");
      const text = el.textContent ?? "";
      el.textContent = "";
      const words = text.split(/(\s+)/);
      words.forEach((w) => {
        if (!w) return;
        const span = document.createElement("span");
        if (/^\s+$/.test(w)) {
          span.className = "fx-word fx-word-space";
          span.innerHTML = "&nbsp;";
        } else {
          span.className = "fx-word";
          span.textContent = w;
        }
        el.appendChild(span);
      });
      el.dataset.fxBuilt = "1";
    }

    const wordObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const target = e.target as HTMLElement;
          const spans = target.querySelectorAll<HTMLElement>(".fx-word");
          if (reducedMotion) {
            spans.forEach((s) => s.classList.add("in"));
          } else {
            spans.forEach((s, i) => {
              s.style.setProperty("--d", `${Math.min(i * 35, 700)}ms`);
              // Force the .in toggle next frame so the transition fires
              requestAnimationFrame(() => s.classList.add("in"));
            });
          }
          wordObserver.unobserve(target);
        }
      },
      { rootMargin: "0px 0px -15% 0px", threshold: 0.1 },
    );
    wordTargets.forEach((el) => wordObserver.observe(el));
    cleanups.push(() => wordObserver.disconnect());

    /* ---------------------------------------------------------------------
     * 3. Cost-of-miss row lighting
     * When the .miss-list enters viewport, light up each row with an 80ms
     * stagger. One-shot.
     * ------------------------------------------------------------------- */
    const missList = root.querySelector<HTMLElement>(".miss-list");
    if (missList) {
      const missObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            const items = Array.from(missList.querySelectorAll<HTMLElement>(".miss-item"));
            items.forEach((it, i) => {
              const delay = reducedMotion ? 0 : i * 90;
              window.setTimeout(() => it.classList.add("fx-row-lit"), delay);
            });
            missObserver.disconnect();
            return;
          }
        },
        { rootMargin: "0px 0px -20% 0px", threshold: 0.15 },
      );
      missObserver.observe(missList);
      cleanups.push(() => missObserver.disconnect());
    }

    /* ---------------------------------------------------------------------
     * 4. Pricing featured-tier rise
     * The Multi-Crew tier scales up + glow intensifies when the tiers grid
     * enters viewport.
     * ------------------------------------------------------------------- */
    const featuredTier = root.querySelector<HTMLElement>(".tier-featured");
    if (featuredTier) {
      const tiers = featuredTier.closest(".tiers") || featuredTier;
      const tierObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            window.setTimeout(() => featuredTier.classList.add("fx-rise"), 200);
            tierObserver.disconnect();
            return;
          }
        },
        { rootMargin: "0px 0px -20% 0px", threshold: 0.25 },
      );
      tierObserver.observe(tiers);
      cleanups.push(() => tierObserver.disconnect());
    }

    /* ---------------------------------------------------------------------
     * 5. Callout glow-up
     * The "One prevented NPT day" callout brightens when in view.
     * ------------------------------------------------------------------- */
    const callouts = Array.from(root.querySelectorAll<HTMLElement>(".callout"));
    if (callouts.length) {
      const calloutObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("fx-glow");
              calloutObserver.unobserve(e.target);
            }
          }
        },
        { rootMargin: "0px 0px -25% 0px", threshold: 0.2 },
      );
      callouts.forEach((c) => calloutObserver.observe(c));
      cleanups.push(() => calloutObserver.disconnect());
    }

    /* ---------------------------------------------------------------------
     * 6. Final-CTA bleed reveal
     * The audit headline wipes up from bottom when the final card scrolls in.
     * We add .fx-bleed to the headline up front (so it's clipped) then add
     * .in to wipe it open.
     * ------------------------------------------------------------------- */
    const finalDisplay = root.querySelector<HTMLElement>(".final-card .display");
    if (finalDisplay) {
      finalDisplay.classList.add("fx-bleed");
      const finalObserver = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              requestAnimationFrame(() => finalDisplay.classList.add("in"));
              finalObserver.disconnect();
              return;
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.35 },
      );
      finalObserver.observe(finalDisplay);
      cleanups.push(() => finalObserver.disconnect());
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
