import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

/** The public site's top bar: the mark, log in, and the one thing to do. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-coal">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-5 md:px-10">
        <Link href="/" aria-label="SYNNR home"><Wordmark /></Link>
        <nav className="flex items-center gap-1.5 text-[13px]">
          <Link href="/#what" className="hidden h-9 items-center rounded-md px-3 text-ink-dim transition-colors hover:text-ink md:flex">What it does</Link>
          <Link href="/#wireline" className="hidden h-9 items-center rounded-md px-3 text-ink-dim transition-colors hover:text-ink md:flex">Wireline</Link>
          <span aria-hidden className="mx-2 hidden h-4 w-px bg-line-2 md:block" />
          <Link href="/login" className="flex h-9 items-center rounded-md px-3 text-ink-dim transition-colors hover:text-ink">Log in</Link>
          <Link href="/#access" className="flex h-9 items-center rounded-md bg-ink px-3.5 font-medium text-coal transition-colors hover:bg-white">Request access</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 text-[13px] text-ink-faint md:flex-row md:items-center md:justify-between md:px-10">
        <div className="flex flex-col gap-2">
          <Wordmark />
          <span>&copy; 2026 SYNNR · Darkstar Dynamics LLC</span>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href={OWNER_PHONE_TEL} className="transition-colors hover:text-ink">Call or text {OWNER_PHONE}</a>
          <Link href="/login" className="transition-colors hover:text-ink">Log in</Link>
          <Link href="/legal/terms" className="transition-colors hover:text-ink">Terms</Link>
          <Link href="/legal/privacy" className="transition-colors hover:text-ink">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
