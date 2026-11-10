"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Brain, Settings, LogOut, Menu, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Wordmark } from "@/components/wordmark";

type Chat = { id: string; title: string };

/**
 * The frame around everything: who you are and which company, a new chat,
 * your chats, the Brain, and Settings. Nothing else. On a phone it folds
 * into a top bar and a drawer.
 */
export default function SynnrNav({ companyName, userName, companies = [], activeCompanyId, switchAction, chats = [] }: {
  companyName: string;
  userName: string;
  companies?: { id: string; name: string }[];
  activeCompanyId?: string;
  switchAction?: (fd: FormData) => Promise<void>;
  chats?: Chat[];
}) {
  const path = usePathname() || "/app";
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    // A shared phone: the next person mustn't pick up this one's drafts.
    try {
      for (const k of Object.keys(localStorage)) if (/^(rr|synnr)-/.test(k)) localStorage.removeItem(k);
    } catch { /* storage off */ }
    const sb = getBrowserSupabase();
    if (sb) await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  // The phone menu, while open: Escape closes it and the page behind holds still.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = was; };
  }, [open]);

  // Home and New chat both mean a clean bar, even when a chat is already open.
  const fresh = () => { setOpen(false); window.dispatchEvent(new Event("synnr:new-chat")); };

  const body = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link href="/app" onClick={fresh} aria-label="SYNNR home"><Wordmark /></Link>
        {companies.length > 1 && switchAction ? (
          <form action={switchAction} className="mt-3">
            <select name="company_id" defaultValue={activeCompanyId} aria-label="Switch company"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-9 w-full rounded-md border border-line bg-surface px-2 text-[13px] text-ink-dim outline-none focus:border-line-2">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </form>
        ) : (
          <div className="mt-2 truncate text-[13px] text-ink-faint" title={companyName}>{companyName}</div>
        )}
      </div>

      <div className="px-3">
        <Link href="/app" onClick={fresh}
          className="flex h-9 items-center gap-2 rounded-md border border-line-2 px-3 text-[13px] font-medium text-ink transition-colors hover:bg-elevated">
          <Plus className="h-4 w-4" /> New chat
        </Link>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        <div className="px-2 pb-2 text-[12px] font-medium text-ink-faint">Chats</div>
        {chats.length ? chats.map((c) => (
          <Link key={c.id} href={`/app/c/${c.id}`} onClick={() => setOpen(false)}
            className={cn("flex h-8 items-center gap-2 truncate rounded-md px-2 text-[13px] transition-colors",
              path === `/app/c/${c.id}` ? "bg-elevated text-ink" : "text-ink-dim hover:bg-elevated hover:text-ink")}>
            <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">{c.title}</span>
          </Link>
        )) : <p className="px-2 text-[13px] leading-relaxed text-ink-faint">Your chats show up here.</p>}
      </div>

      <nav className="border-t border-line px-3 py-3">
        {[
          { href: "/app/brain", label: "The Brain", icon: Brain },
          { href: "/app/settings", label: "Settings", icon: Settings },
        ].map((item) => {
          const active = path === item.href || path.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
              className={cn("flex h-9 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors",
                active ? "bg-elevated text-ink" : "text-ink-dim hover:bg-elevated hover:text-ink")}>
              <Icon className="h-4 w-4" /> {item.label}
            </Link>
          );
        })}
        <div className="mt-2 flex items-center gap-2.5 px-2 pt-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-[12px] font-semibold text-ink-dim">
            {userName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">{userName}</span>
          <button type="button" onClick={signOut} title="Log out" aria-label="Log out"
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-elevated hover:text-ink">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </nav>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-line bg-coal md:block">{body}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-coal/90 px-4 backdrop-blur md:hidden">
        <Link href="/app" onClick={fresh} aria-label="SYNNR home"><Wordmark /></Link>
        <button type="button" onClick={() => setOpen(true)} aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-md text-ink-dim hover:bg-elevated hover:text-ink">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-y-0 left-0 w-[82%] max-w-xs border-r border-line bg-coal">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:bg-elevated hover:text-ink">
              <X className="h-5 w-5" />
            </button>
            {body}
          </div>
        </div>
      ) : null}
    </>
  );
}
