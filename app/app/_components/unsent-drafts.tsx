"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/**
 * Load-outs and check-ins saved on this phone that never reached RollReady
 * (no signal, then the hand left the screen). They only send while their
 * screen is open, so the board says so: one tap opens it and it sends.
 */

type Unsent = { href: string; label: string; count: number };
const noSubscribe = () => () => {};
const FRESH = 18 * 3600e3;

function read(trucks: { id: string; name: string }[]): string {
  const out: Unsent[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      const m = /^rr-(loadout|return)-(.+)$/.exec(k);
      if (!m || k.startsWith("rr-loadout-photo-")) continue;
      const d = JSON.parse(localStorage.getItem(k) ?? "null") as { scans?: Record<string, unknown>; savedAt?: number } | null;
      const count = Object.keys(d?.scans ?? {}).length;
      if (!d || !count || Date.now() - (d.savedAt ?? 0) > FRESH) continue;
      const truck = trucks.find((t) => t.id === m[2]);
      if (m[1] === "loadout" && truck) out.push({ href: `/app/units/${truck.id}/scan`, label: `A load-out of ${truck.name}`, count });
      else if (m[1] === "return") out.push({ href: truck ? `/app/units/${truck.id}/return` : "/app/return", label: truck ? `A check-in of ${truck.name}` : "A check-in", count });
    }
  } catch { /* storage off */ }
  return JSON.stringify(out);
}

export default function UnsentDrafts({ trucks }: { trucks: { id: string; name: string }[] }) {
  const raw = useSyncExternalStore(noSubscribe, () => read(trucks), () => "[]");
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
