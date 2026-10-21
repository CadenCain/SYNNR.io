"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Light or dark for the app and the sign-in pages. Auto follows the phone
 * (dark at night when the phone goes dark). The choice lives on this phone,
 * and THEME_SCRIPT applies it before the first paint so the page never
 * flashes the wrong color. The marketing site and proof links stay light.
 */
export type ThemeChoice = "light" | "dark" | "system";
const KEY = "rr-theme";
const EVENT = "rr-theme";
const DARK = "(prefers-color-scheme: dark)";

/** Runs in <head> before anything paints. Same rule as applyTheme. */
export const THEME_SCRIPT = `(function(){try{if(!/^\\/(app|login|signup|forgot|reset|onboarding|invite)(\\/|$)/.test(location.pathname))return;var t=localStorage.getItem("${KEY}");if(t==="dark"||((!t||t==="system")&&matchMedia("${DARK}").matches))document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch { return "system"; }
}

function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia(DARK).matches);
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(DARK);
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  mq.addEventListener("change", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); mq.removeEventListener("change", cb); };
}

/** Keeps the page in the chosen theme while it's open; light again when it goes (back to the marketing site). */
export function ThemeSync() {
  useEffect(() => {
    const sync = () => applyTheme(readChoice());
    sync();
    const off = subscribe(sync);
    return () => { off(); document.documentElement.removeAttribute("data-theme"); };
  }, []);
  return null;
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: SunMoon },
];

/** Light / Dark / Auto. */
export function ThemePicker({ className }: { className?: string }) {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);
  function pick(c: ThemeChoice) {
    try { localStorage.setItem(KEY, c); } catch { /* storage off: this page only */ }
    applyTheme(c);
    window.dispatchEvent(new Event(EVENT));
  }
  return (
    <div role="radiogroup" aria-label="Light or dark" className={cn("grid grid-cols-3 gap-1 rounded-lg border border-line bg-coal p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value} onClick={() => pick(value)}
          title={value === "system" ? "Follows your phone or computer" : undefined}
          className={cn("flex min-h-10 items-center justify-center gap-1.5 rounded-md text-sm",
            choice === value ? "bg-surface font-medium text-ink shadow-sm" : "text-ink-dim hover:text-ink")}>
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}
