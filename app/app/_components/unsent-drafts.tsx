"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Load-outs and check-ins saved on this phone that never reached RollReady
 * (no signal, then the hand left the screen). They only send while their
 * screen is open, so the board says so: one tap opens it and it sends. One
 * this list drops (not worked on in 18 hours, or a load-out the server won't
 * take) shows in never-sent-drafts.tsx instead, for up to 3 days.
 */

type Unsent = { href: string; label: string; count: number };
const noSubscribe = () => () => {};
// The same 18 hours as never-sent-drafts.tsx: change one, change both.
const FRESH = 18 * 3600e3;
/** The server won't take a load-out started longer ago than this (scan/actions.ts finishLoadout). */
export const LOADOUT_MAX_AGE = 20 * 3600e3;

/**
 * Can this load-out draft still send? It has scans, was worked on in the last
 * 18 hours, and started less than 20 hours ago. Picking a draft up and
 * putting it down again doesn't buy it more time: the server goes by when
 * the load-out started.
 */
export function loadoutDraftSendable(d: { scans?: Record<string, unknown>; savedAt?: number; startedAt?: string } | null, now: number): boolean {
  if (!d || !Object.keys(d.scans ?? {}).length || now - (d.savedAt ?? 0) > FRESH) return false;
  const started = Date.parse(String(d.startedAt ?? ""));
  return !Number.isFinite(started) || now - started < LOADOUT_MAX_AGE;
}

/**
 * Whose check-in draft is this? A truck on this board, or this company's
 * loose-iron check-in ("yard-<company>", or plain "yard" from before drafts
 * were kept per company). Another company's draft isn't listed: opening it
 * here would show an empty screen.
 */
export function returnDraftOwner(suffix: string, trucks: { id: string; name: string }[], companyId: string): { truck: { id: string; name: string } | null } | null {
  const truck = trucks.find((t) => t.id === suffix);
  if (truck) return { truck };
  if (suffix === "yard" || (companyId && suffix === `yard-${companyId}`)) return { truck: null };
  return null;
}

function read(trucks: { id: string; name: string }[], companyId: string): string {
  const out: Unsent[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      const m = /^rr-(loadout|return)-(.+)$/.exec(k);
      if (!m || k.startsWith("rr-loadout-photo-")) continue;
      const d = JSON.parse(localStorage.getItem(k) ?? "null") as { scans?: Record<string, unknown>; savedAt?: number; startedAt?: string } | null;
      const count = Object.keys(d?.scans ?? {}).length;
      if (!d || !count || Date.now() - (d.savedAt ?? 0) > FRESH) continue;
      // A load-out too old for the server to take isn't "open and send".
      if (m[1] === "loadout" && !loadoutDraftSendable(d, Date.now())) continue;
      const truck = trucks.find((t) => t.id === m[2]);
      if (m[1] === "loadout" && truck) out.push({ href: `/app/units/${truck.id}/scan`, label: `A load-out of ${truck.name}`, count });
      else if (m[1] === "return" && returnDraftOwner(m[2], trucks, companyId)) out.push({ href: truck ? `/app/units/${truck.id}/return` : "/app/return", label: truck ? `A check-in of ${truck.name}` : "A check-in", count });
    }
  } catch { /* storage off */ }
  return JSON.stringify(out);
}

export default function UnsentDrafts({ trucks, companyId = "" }: { trucks: { id: string; name: string }[]; companyId?: string }) {
  const raw = useSyncExternalStore(noSubscribe, () => read(trucks, companyId), () => "[]");
  const list = JSON.parse(raw) as Unsent[];
  if (!list.length) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-4">
      <div className="font-semibold">Not sent yet, from this phone</div>
      {list.map((u) => (
        <Link key={u.href} href={u.href} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line-2 bg-surface px-3 text-sm hover:bg-elevated">
          <span className="min-w-0">{u.label}: {u.count} {u.count === 1 ? "piece" : "pieces"} checked</span>
          <span className="shrink-0 font-semibold text-bone">Open and send</span>
        </Link>
      ))}
    </div>
  );
}
