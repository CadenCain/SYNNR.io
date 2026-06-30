"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Warehouse, ShieldCheck, Bell, Settings, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** Desktop sidebar items. */
const SIDEBAR = [
  { href: "/app", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/app/yards", label: "Yards", icon: Warehouse },
  { href: "/app/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/app/alerts", label: "Alerts", icon: Bell },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

/** Mobile bottom tabs — center is the camera-first Quick Action. */
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

export default function AppNav({ companyName }: { companyName?: string }) {
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-coal p-4 md:flex">
        <Link href="/app" className="mb-1 flex items-center gap-2.5 px-2 py-1">
          {MARK}
          <span className="font-semibold tracking-tight">SYNNR</span>
        </Link>
        {companyName ? (
          <div className="mb-5 truncate px-2 text-xs text-ink-dim" title={companyName}>{companyName}</div>
        ) : (
          <div className="mb-5" />
        )}
        <nav className="flex flex-col gap-1">
          {SIDEBAR.map((item) => {
            const active = isActive(path, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-elevated text-ink" : "text-ink-dim hover:bg-surface hover:text-ink",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/app/quick"
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#e7ddc7] px-3 py-2.5 text-sm font-medium text-coal transition-colors hover:bg-[#f3ecdb]"
        >
          <Plus className="h-[18px] w-[18px]" /> Quick action
        </Link>
        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-dim transition-colors hover:bg-surface hover:text-ink"
        >
          <LogOut className="h-[18px] w-[18px]" /> Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-coal/90 px-4 py-3 backdrop-blur md:hidden">
        {MARK}
        <span className="font-semibold tracking-tight">SYNNR</span>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 items-end border-t border-line bg-coal/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {TABS_LEFT.map((t) => (
          <Tab key={t.href} {...t} active={isActive(path, t.href, t.exact)} />
        ))}
        {/* Center quick action */}
        <Link href="/app/quick" className="flex flex-col items-center gap-1" aria-label="Quick action">
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#e7ddc7] text-coal shadow-lg shadow-black/40">
            <Plus className="h-6 w-6" />
          </span>
        </Link>
        {TABS_RIGHT.map((t) => (
          <Tab key={t.href} {...t} active={isActive(path, t.href)} />
        ))}
      </nav>
    </>
  );
}

function Tab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1 py-1 text-[11px]",
        active ? "text-ink" : "text-ink-dim",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
