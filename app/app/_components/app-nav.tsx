"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, Truck, CalendarClock, QrCode, Settings, Plus, LogOut, Search, FileCheck, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; icon: typeof Boxes; exact?: boolean; also?: string[] };

// Equipment first. Trucks own the yard, unit, and truck-check pages too.
const TRUCK_PAGES = ["/app/units", "/app/yards", "/app/dispatch", "/app/records"];
const MAIN: NavItem[] = [
  { href: "/app", label: "Equipment", icon: Boxes, exact: true, also: ["/app/assets"] },
  { href: "/app/trucks", label: "Trucks", icon: Truck, also: TRUCK_PAGES },
  { href: "/app/compliance", label: "Tests due", icon: CalendarClock },
  { href: "/app/tags", label: "QR tags", icon: QrCode },
];

// Phones: the three places a yard lives in, plus the button and More.
const TABS_LEFT: NavItem[] = [
  { href: "/app", label: "Equipment", icon: Boxes, exact: true, also: ["/app/assets"] },
  { href: "/app/trucks", label: "Trucks", icon: Truck, also: TRUCK_PAGES },
];
const TABS_RIGHT: NavItem[] = [
  { href: "/app/compliance", label: "Due", icon: CalendarClock },
];

function isActive(path: string, href: string, exact?: boolean, also: string[] = []) {
  const hit = (h: string) => path === h || path.startsWith(h + "/");
  return (exact ? path === href : hit(href)) || also.some(hit);
}

const MARK = (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#1d4ed8" />
  </svg>
);

export default function AppNav({ companyName, userName, companies = [], activeCompanyId, switchAction, reviewCount = null }: {
  companyName?: string; userName?: string;
  /** Uploads waiting on a manager. null = not a manager, no Review link. */
  reviewCount?: number | null;
  companies?: { id: string; name: string }[];
  activeCompanyId?: string;
  switchAction?: (fd: FormData) => Promise<void>;
}) {
  const path = usePathname() || "/app";
  const router = useRouter();
  const [more, setMore] = useState(false);
  const moreActive = ["/app/tags", "/app/review", "/app/settings", "/app/search"].some((h) => isActive(path, h));

  async function signOut() {
    const sb = getBrowserSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface px-3 py-4 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          {MARK}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-semibold tracking-tight">RollReady</div>
            {companyName ? <div className="line-clamp-2 text-xs leading-snug text-ink-faint" title={companyName}>{companyName}</div> : null}
          </div>
        </div>

        {/* Company switcher — hidden with one company. One user, many shops
            (spec §4): an unpaid company must never trap the login. */}
        {companies.length > 1 && switchAction ? (
          <form action={switchAction} className="mb-1">
            <select
              name="company_id"
              defaultValue={activeCompanyId}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-9 w-full rounded-lg border border-line-2 bg-coal px-2 text-sm text-ink-dim outline-none focus:border-bone"
              aria-label="Switch company"
            >
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </form>
        ) : null}

        {/* Search (jump to compliance list) */}
        <form
          action="/app/search"
          className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-coal px-3 py-2 text-sm text-ink-faint focus-within:border-bone"
        >
          <Search className="h-4 w-4" />
          <input
            name="q"
            placeholder="Search name or serial"
            className="w-full bg-transparent text-ink placeholder:text-ink-faint outline-none"
          />
          <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-ink-faint lg:inline">⌘K</kbd>
        </form>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {[...MAIN, ...(reviewCount === null ? [] : [{ href: "/app/review", label: "Review uploads", icon: FileCheck } as NavItem])].map((item) => {
            const active = isActive(path, item.href, item.exact, item.also);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-bone/10 font-medium text-bone" : "text-ink-dim hover:bg-elevated hover:text-ink",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active ? "text-bone" : "")} />
                <span className="flex-1">{item.label}</span>
                {item.href === "/app/review" && reviewCount ? (
                  <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-400">{reviewCount}</span>
                ) : null}
              </Link>
            );
          })}
          <div className="my-2 border-t border-line" />
          {(() => {
            const active = isActive(path, "/app/settings");
            return (
              <Link href="/app/settings" aria-current={active ? "page" : undefined}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-bone/10 font-medium text-bone" : "text-ink-dim hover:bg-elevated hover:text-ink")}>
                <Settings className={cn("h-[18px] w-[18px]", active ? "text-bone" : "")} />
                <span className="flex-1">Settings</span>
              </Link>
            );
          })()}
        </nav>

        <Link
          href="/app/quick"
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-bone px-3 py-2.5 text-sm font-medium text-coal transition-colors hover:bg-bone-soft"
        >
          <Plus className="h-[18px] w-[18px]" /> Quick action
        </Link>

        {userName ? (
          <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
            <Link href="/app/settings" title="Settings" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-0.5 hover:bg-elevated">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bone text-xs font-semibold text-coal">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{userName}</span>
            </Link>
            <button onClick={signOut} title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-elevated hover:text-ink">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </aside>

      {/* Mobile top bar — top padding respects the notch/status bar so the
          wordmark doesn't jam the top edge on a real phone. */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-surface/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        {MARK}
        <span className="font-semibold tracking-tight">RollReady</span>
        <Link href="/app/search" aria-label="Search" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-ink-dim hover:text-ink">
          <Search className="h-[18px] w-[18px]" />
        </Link>
        {userName ? (
          <Link href="/app/settings" aria-label="Settings" title={userName}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-elevated">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bone text-xs font-semibold text-coal">
              {userName.slice(0, 1).toUpperCase()}
            </span>
          </Link>
        ) : null}
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line bg-surface/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {TABS_LEFT.map((t) => <Tab key={t.href} {...t} active={isActive(path, t.href, t.exact, t.also)} />)}
        <Link href="/app/quick" className="flex flex-col items-center gap-1" aria-label="Quick action">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-bone text-coal shadow-lg shadow-slate-900/20">
            <Plus className="h-6 w-6" />
          </span>
        </Link>
        {TABS_RIGHT.map((t) => <Tab key={t.href} {...t} active={isActive(path, t.href, t.exact, t.also)} />)}
        <button type="button" onClick={() => setMore(true)} aria-label="More"
          className={cn("relative flex flex-col items-center gap-1 py-1 text-[11px]", moreActive ? "font-medium text-bone" : "text-ink-faint")}>
          <Menu className="h-5 w-5" />
          More
          {reviewCount ? <span className="absolute right-[22%] top-0 h-2 w-2 rounded-full bg-amber-500" aria-hidden /> : null}
        </button>
      </nav>

      {/* More: the rest of the app on a phone. */}
      {more ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close" onClick={() => setMore(false)} className="absolute inset-0 bg-slate-900/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-sm font-semibold text-ink-dim">{companyName ?? "Menu"}</span>
              <button type="button" onClick={() => setMore(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-dim hover:bg-elevated">
                <X className="h-5 w-5" />
              </button>
            </div>
            {[
              { href: "/app/tags", label: "QR tags", icon: QrCode },
              ...(reviewCount === null ? [] : [{ href: "/app/review", label: "Review uploads", icon: FileCheck }]),
              { href: "/app/search", label: "Search", icon: Search },
              { href: "/app/settings", label: "Settings", icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMore(false)}
                  className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 text-base", isActive(path, item.href) ? "bg-bone/10 font-medium text-bone" : "text-ink hover:bg-elevated")}>
                  <Icon className="h-5 w-5" />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/app/review" && reviewCount ? (
                    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">{reviewCount}</span>
                  ) : null}
                </Link>
              );
            })}
            <button type="button" onClick={signOut}
              className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-base text-ink-dim hover:bg-elevated">
              <LogOut className="h-5 w-5" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Boxes; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center gap-1 py-1 text-[11px]", active ? "font-medium text-bone" : "text-ink-faint")}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
