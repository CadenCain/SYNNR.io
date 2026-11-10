"use client";

import { useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/button";
import { fmtWhen } from "@/lib/saas/format";
import { LOADOUT_MAX_AGE, returnDraftOwner } from "./unsent-drafts";

/**
 * Load-outs and check-ins saved on this phone that never sent and are now too
 * old to. Past 18 hours the scan screens stop offering them, the board's "Not
 * sent yet" list (unsent-drafts.tsx) drops them, and the server won't take a
 * load-out that old. Instead of vanishing, each one shows here until the hand
 * clears it, so a manager hears what went on the truck. After 3 days they're
 * left alone. A load-out started 20 hours ago or more counts too, even if it
 * was worked on since: the server won't take it, so the scan screen and the
 * "Not sent yet" list drop it (loadoutDraftSendable in unsent-drafts.tsx).
 */
// The same 18 hours as unsent-drafts.tsx: change one, change both.
const FRESH = 18 * 3600e3;
const SHOW_FOR = 72 * 3600e3;
const CHANGED = "rr-drafts-changed";

export type NeverSent = { key: string; truckId: string | null; label: string; tell: string; count: number; savedAt: number };

/** The too-old, never-sent drafts in this phone's storage. */
export function readNeverSent(store: Pick<Storage, "length" | "key" | "getItem">, trucks: { id: string; name: string }[], now: number, companyId = ""): NeverSent[] {
  const out: NeverSent[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i) ?? "";
    const m = /^rr-(loadout|return)-(.+)$/.exec(k);
    if (!m || k.startsWith("rr-loadout-photo-")) continue;
    let d: { scans?: Record<string, unknown>; savedAt?: number; startedAt?: string } | null = null;
    try { d = JSON.parse(store.getItem(k) ?? "null"); } catch { continue; }
    const count = Object.keys(d?.scans ?? {}).length;
    const savedAt = Number(d?.savedAt ?? 0);
    const age = now - savedAt;
    // A load-out started too long ago for the server is never sent, however fresh.
    const started = m[1] === "loadout" ? Date.parse(String(d?.startedAt ?? "")) : NaN;
    const tooOld = age > FRESH || (Number.isFinite(started) && now - started >= LOADOUT_MAX_AGE);
    if (!d || !count || !(tooOld && age <= SHOW_FOR)) continue;
    const truck = trucks.find((t) => t.id === m[2]) ?? null;
    if (m[1] === "loadout") {
      if (truck) out.push({ key: k, truckId: truck.id, label: `A load-out of ${truck.name}`, tell: `Tell a manager what went on ${truck.name}.`, count, savedAt });
    } else if (!companyId || returnDraftOwner(m[2], trucks, companyId)) {
      out.push({ key: k, truckId: truck?.id ?? null, label: truck ? `A check-in of ${truck.name}` : "A check-in", tell: truck ? `Tell a manager what came back off ${truck.name}.` : "Tell a manager what came back.", count, savedAt });
    }
  }
  return out.sort((a, b) => a.savedAt - b.savedAt);
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGED, cb);
  return () => { window.removeEventListener("storage", cb); window.removeEventListener(CHANGED, cb); };
};

function clear(u: NeverSent) {
  try {
    localStorage.removeItem(u.key);
    // A load-out's truck photo is kept next to it.
    if (u.key.startsWith("rr-loadout-") && u.truckId) localStorage.removeItem(`rr-loadout-photo-${u.truckId}`);
  } catch { /* storage off */ }
  window.dispatchEvent(new Event(CHANGED));
}

export default function NeverSentDrafts({ trucks, companyId = "" }: { trucks: { id: string; name: string }[]; companyId?: string }) {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return JSON.stringify(readNeverSent(localStorage, trucks, Date.now(), companyId)); } catch { return "[]"; }
  }, () => "[]");
  const list = JSON.parse(raw) as NeverSent[];
  if (!list.length) return null;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-red-500/50 bg-red-500/[0.07] p-4">
      <div className="font-semibold text-red-400">Never sent, from this phone</div>
      {list.map((u) => (
        <div key={u.key} className="flex flex-col gap-2 rounded-xl border border-line-2 bg-surface p-3 text-sm">
          <p className="break-words">
            {u.label}: {u.count} {u.count === 1 ? "piece" : "pieces"} checked, last at {fmtWhen(new Date(u.savedAt).toISOString())}. It&apos;s too old to send now. <span className="font-semibold">{u.tell}</span>
          </p>
          <button type="button" onClick={() => clear(u)} className={buttonClass("outline", "lg", "h-12 self-start text-sm")}>Told a manager, clear it</button>
        </div>
      ))}
    </div>
  );
}
