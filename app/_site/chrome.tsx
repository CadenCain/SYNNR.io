import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";
import { AccessLink } from "./access-link";
import { wrap } from "./ui";

/** The public site's top bar: the mark, where to read more, log in, and the way in. Nothing in it has a color. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-coal">
      <div className={`${wrap} flex h-14 items-center justify-between`}>
        <Link href="/" aria-label="SYNNR home" className="flex h-10 items-center"><Wordmark plain /></Link>
        <nav className="flex items-center gap-1 text-[13px]">
          <Link href="/product" className="hidden h-10 items-center px-3 text-ink-dim transition-colors hover:text-ink md:flex">How it works</Link>
          <Link href="/security" className="hidden h-10 items-center px-3 text-ink-dim transition-colors hover:text-ink md:flex">Your data</Link>
          <Link href="/login" className="flex h-10 items-center px-3 text-ink-dim transition-colors hover:text-ink">Log in</Link>
          <AccessLink className="ml-2 flex h-9 items-center rounded-sm border border-line-2 px-3.5 text-ink transition-colors hover:border-ink-faint">Request access</AccessLink>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className={`${wrap} pb-12`}>
        <div className="flex flex-col gap-8 border-t border-line pt-8 text-[13px] text-ink-faint md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <Wordmark plain />
            <span>&copy; 2026 SYNNR · Darkstar Dynamics LLC</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-7">
            <a href={OWNER_PHONE_TEL} className="flex min-h-10 items-center transition-colors hover:text-ink">Call or text {OWNER_PHONE}</a>
            <Link href="/product" className="flex min-h-10 items-center transition-colors hover:text-ink">How it works</Link>
            <Link href="/security" className="flex min-h-10 items-center transition-colors hover:text-ink">Your data</Link>
            <Link href="/login" className="flex min-h-10 items-center transition-colors hover:text-ink">Log in</Link>
            <Link href="/legal/terms" className="flex min-h-10 items-center transition-colors hover:text-ink">Terms</Link>
            <Link href="/legal/privacy" className="flex min-h-10 items-center transition-colors hover:text-ink">Privacy</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
