"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Keeps the load-out working with no signal (public/sw.js), and says so when
 * the phone is offline. Pages shown offline are the copy this phone saved
 * last. Scans stay on the phone, and they only send while their screen is
 * open, so the banner says to open RollReady once back in range.
 *
 * On one bar the worker also shows the saved copy after 5 seconds. It marks
 * that copy, so even with signal the page says it's the saved copy and when
 * it was saved, then gets the latest by itself (once), with a button to try
 * again. An old board or scan page never passes for the live one.
 */
const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

const post = (msg: unknown) => {
  navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage(msg)).catch(() => {});
};

/** The page came from this phone's saved copy: which page, and when the server made it. */
export type SavedMark = { path: string; at: number | null; when: string };

/** " at 8:12 PM" today, " on Sun, Nov 8 at 8:12 PM" before today, "" when the time isn't known. */
export function savedWhen(at: number | null, now: number): string {
  if (at === null || !Number.isFinite(at)) return "";
  const d = new Date(at);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date(now).toDateString()) return ` at ${time}`;
  return ` on ${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${time}`;
}

/** The worker's mark (<meta name="rr-saved">), or null on a page that came from the network. */
export function readSavedMark(doc: Pick<Document, "querySelector">, now: number): SavedMark | null {
  const m = doc.querySelector('meta[name="rr-saved"]');
  if (!m) return null;
  const content = m.getAttribute("content");
  const at = content ? Number(content) : NaN;
  const ms = Number.isFinite(at) ? at : null;
  return { path: m.getAttribute("data-path") ?? "", at: ms, when: savedWhen(ms, now) };
}

// A string, so the snapshot stays the same between reads. Read once, as soon
// as this file loads: the mark belongs to this whole page load, and if React
// ever has to rebuild <head> it drops the worker's tag, but the page is still
// the saved copy.
let firstMark: string | null | undefined;
const markSnapshot = () => {
  if (firstMark === undefined) {
    const m = readSavedMark(document, Date.now());
    firstMark = m ? JSON.stringify(m) : null;
  }
  return firstMark;
};
if (typeof document !== "undefined") markSnapshot();
const noSubscribe = () => () => {};

/** Get the latest by itself only once per saved copy, so a page that can't load never reloads over and over. */
function firstTry(key: string): boolean {
  try {
    if (sessionStorage.getItem("rr-saved-tried") === key) return false;
    sessionStorage.setItem("rr-saved-tried", key);
    return true;
  } catch {
    return false;
  }
}

export default function OfflineSupport({ companyId }: { companyId: string }) {
  const online = useOnline();
  const pathname = usePathname();
  const router = useRouter();
  const raw = useSyncExternalStore(noSubscribe, markSnapshot, () => null);
  const mark = useMemo(() => (raw ? (JSON.parse(raw) as SavedMark) : null), [raw]);
  const [loading, start] = useTransition();
  // Once a refresh has finished, this page is the live one.
  const [askedForLatest, setAskedForLatest] = useState(false);
  if (loading && !askedForLatest) setAskedForLatest(true);
  const live = askedForLatest && !loading;
  const saved = mark && !live && mark.path === pathname ? mark : null;
  const tried = useRef(false);
  // A load-out or check-in screen keeps its list, plan and kit in the phone's
  // own state, seeded once, so a soft refresh would leave the saved copy's
  // list on screen with the banner gone. Those get a full reload; the hand's
  // scans are on the phone and offered back. Other pages refresh in place.
  const getLatest = () => {
    if (/\/(scan|return)$/.test(pathname)) window.location.reload();
    else start(() => router.refresh());
  };

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    // Switching companies on a shared phone: drop the other company's saved pages.
    try {
      const last = localStorage.getItem("rr-company");
      if (last && last !== companyId) post({ type: "forget" });
      localStorage.setItem("rr-company", companyId);
    } catch { /* storage off */ }
  }, [companyId]);

  // The saved copy is showing and there's signal: get the latest.
  useEffect(() => {
    if (!saved || !online || tried.current || !raw) return;
    tried.current = true;
    if (firstTry(raw)) getLatest();
    // getLatest only reads pathname and router, which are already here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, online, raw, router, pathname]);

  if (saved && online) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
        <span className="flex min-w-0 flex-1 items-start gap-2">
          <RefreshCw className={cn("mt-0.5 h-4 w-4 shrink-0", loading && "animate-spin")} />
          <span><span className="font-semibold">Weak signal.</span> This is the copy saved on this phone{saved.when}, not the latest.{loading ? " Getting the latest..." : null}</span>
        </span>
        {loading ? null : (
          <button type="button" onClick={getLatest}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-amber-500/50 px-4 font-semibold">
            Load the latest
          </button>
        )}
      </div>
    );
  }
  if (online) return null;
  return (
    <div role="status" className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      <span><span className="font-semibold">No signal.</span> You&apos;re seeing what this phone saved{saved ? saved.when : " last"}. Load-out and check-in scans are saved on this phone. Open RollReady when you&apos;re back in range to send them.</span>
    </div>
  );
}

/** On the Load out board: save every truck's scan page on this phone, every 20 minutes at most. */
export function WarmOffline({ urls, companyId }: { urls: string[]; companyId: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !navigator.onLine) return;
    try {
      const key = `rr-warm-${companyId}`;
      const last = Number(localStorage.getItem(key) ?? 0);
      if (Date.now() - last < 20 * 60e3) return;
      localStorage.setItem(key, String(Date.now()));
    } catch { /* storage off: warm anyway */ }
    post({ type: "warm", urls: ["/app", ...urls] });
  }, [urls, companyId]);
  return null;
}
