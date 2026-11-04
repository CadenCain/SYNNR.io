"use client";

import { useEffect } from "react";

/**
 * The homepage's small bits of motion: the nav gets a backing once the page
 * scrolls, sections fade up as they come into view (not for anyone who asked
 * for less motion), and the phone menu closes when a link in it is tapped.
 */
export default function HomeMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".rr");
    if (!root) return;
    const nav = document.getElementById("rr-nav");
    const onScroll = () => nav?.classList.toggle("scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const menu = document.getElementById("rr-menu") as HTMLInputElement | null;
    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(".rr-mobile a"));
    const close = () => { if (menu) menu.checked = false; };
    links.forEach((a) => a.addEventListener("click", close));

    let io: IntersectionObserver | null = null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
      root.classList.add("rr-anim");
      io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io?.unobserve(e.target); }
      }, { rootMargin: "0px 0px -8% 0px" });
      root.querySelectorAll(".rv").forEach((el) => io?.observe(el));
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      links.forEach((a) => a.removeEventListener("click", close));
      io?.disconnect();
    };
  }, []);
  return null;
}
