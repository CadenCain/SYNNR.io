"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * "Request access": goes to the form at the bottom of the homepage. On the
 * homepage it scrolls there itself every time. A plain link to #access does
 * nothing the second time, because the address already ends in #access, and
 * a visitor who scrolled back up to read was left with a dead button.
 */
export function AccessLink({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Link href="/#access" className={className}
      onClick={(e) => {
        const form = document.getElementById("access");
        if (!form) return; // another page: the link goes to the homepage's form
        e.preventDefault();
        form.scrollIntoView();
        // Someone on a keyboard goes with it. The section, not a field: a field would pop a phone's keyboard up over the page.
        form.focus({ preventScroll: true });
        window.history.replaceState(null, "", "#access");
      }}>
      {children}
    </Link>
  );
}
