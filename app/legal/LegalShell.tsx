import type { ReactNode } from "react";
import { SiteNav, SiteFooter } from "../_site/chrome";

/** Terms and Privacy: the site's own frame around one readable column. */
export function LegalShell({ title, updated, children }: { eyebrow?: string; title: string; updated: string; children: ReactNode }) {
  return (
    <div className="saas min-h-dvh bg-coal text-ink antialiased">
      <SiteNav />
      <article className="mx-auto w-full max-w-2xl px-5 py-14 md:px-0 md:py-20
        [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4
        [&_h2]:mt-10 [&_h2]:text-[17px] [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h2]:text-ink
        [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-[1.7] [&_p]:text-ink-dim
        [&_strong]:font-medium [&_strong]:text-ink">
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[40px]">{title}</h1>
        <div className="mt-3 text-[13px] text-ink-faint">Last updated {updated}</div>
        {children}
        {/* Not yet reviewed by a lawyer (see the flags at the top of terms/page.tsx). */}
      </article>
      <SiteFooter />
    </div>
  );
}
