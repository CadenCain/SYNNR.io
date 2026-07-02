"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Warehouse, ShieldCheck, Bell, Settings, Plus, LogOut, Search, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";

const GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutGrid; exact?: boolean }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutGrid, exact: true },
      { href: "/app/compliance", label: "Compliance", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/app/yards", label: "Yards", icon: Warehouse },
      { href: "/app/crew", label: "Crew", icon: HardHat },
      { href: "/app/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/settings", label: "Settings", icon: Settings }],
  },
];

const TABS_LEFT = [
  { href: "/app", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/app/yards", label: "Yards", icon: Warehouse },
];
const TABS_RIGHT = [
  { href: "/app/alerts", label: "Alerts", icon: Bell },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function isActive(path: string, href: string, exact?: boolean) {
  return exact ? path === href : path === href || path.startsWith(href + "/");
}

const MARK = (
  <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
    <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
  </svg>
);

export default function AppNav({ companyName, userName, readiness }: { companyName?: string; userName?: string; readiness?: number | null }) {
  const pill =
    readiness == null
      ? null
      : readiness >= 90
        ? { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", txt: `${readiness}%` }
        : readiness >= 70
          ? { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", txt: `${readiness}%` }
          : { cls: "border-red-500/40 bg-red-500/10 text-red-400", txt: `${readiness}%` };
  const path = usePathname() || "/app";
  const router = useRouter();

  async function signOut() {
    const sb = getBrowserSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-coal px-3 py-4 md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4">
          {MARK}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="font-semibold tracking-tight">SYNNR</div>
            {companyName ? <div className="truncate text-xs text-ink-faint" title={companyName}>{companyName}</div> : null}
          </div>
          {pill ? <span title="Overall readiness" className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${pill.cls}`}>{pill.txt}</span> : null}
        </div>

        {/* Search (jump to compliance list) */}
        <form
          action="/app/search"
          className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-faint focus-within:border-line-2"
        >
          <Search className="h-4 w-4" />
          <input
            name="q"
            placeholder="Search trucks, crew, certs…"
            className="w-full bg-transparent text-ink placeholder:text-ink-faint outline-none"
          />
          <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-ink-faint lg:inline">⌘K</kbd>
        </form>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col gap-1">
              <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">{g.label}</div>
              {g.items.map((item) => {
                const active = isActive(path, item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active ? "bg-elevated text-ink" : "text-ink-dim hover:bg-white/[0.03] hover:text-ink",
                    )}
                  >
                    <Icon className={cn("h-[18px] w-[18px]", active ? "text-bone" : "")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <Link
          href="/app/quick"
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-bone px-3 py-2.5 text-sm font-medium text-coal transition-colors hover:bg-bone-soft"
        >
          <Plus className="h-[18px] w-[18px]" /> Quick action
        </Link>

        {userName ? (
          <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bone text-xs font-semibold text-coal">
              {userName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-ink" title={userName}>{userName}</span>
            <button onClick={signOut} title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-white/[0.03] hover:text-ink">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </aside>

      {/* Mobile top bar — top padding respects the notch/status bar so the
          wordmark doesn't jam the top edge on a real phone. */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-coal/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:hidden">
        {MARK}
        <span className="font-semibold tracking-tight">SYNNR</span>
        {pill ? <span className={`ml-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${pill.cls}`}>{pill.txt}</span> : null}
        {userName ? (
          <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-bone text-xs font-semibold text-coal" title={userName}>
            {userName.slice(0, 1).toUpperCase()}
          </span>
        ) : null}
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line bg-coal/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {TABS_LEFT.map((t) => <Tab key={t.href} {...t} active={isActive(path, t.href, t.exact)} />)}
        <Link href="/app/quick" className="flex flex-col items-center gap-1" aria-label="Quick action">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-bone text-coal shadow-lg shadow-black/40">
            <Plus className="h-6 w-6" />
          </span>
        </Link>
        {TABS_RIGHT.map((t) => <Tab key={t.href} {...t} active={isActive(path, t.href)} />)}
      </nav>
    </>
  );
}

function Tab({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutGrid; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex flex-col items-center gap-1 py-1 text-[11px]", active ? "text-ink" : "text-ink-faint")}>
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
