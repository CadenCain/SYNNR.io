"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

/**
 * Keeps the load-out working with no signal (public/sw.js), and says so when
 * the phone is offline. Pages shown offline are the copy this phone saved
 * last; scans still save on the phone and send when signal comes back.
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

export default function OfflineSupport({ companyId }: { companyId: string }) {
  const online = useOnline();
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

  if (online) return null;
  return (
    <div role="status" className="flex items-start gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      <span><span className="font-semibold">No signal.</span> You&apos;re seeing what this phone saved last. Load-out scans still save on the phone and send when you&apos;re back in range.</span>
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
