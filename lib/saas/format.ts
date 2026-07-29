/**
 * How old is a "last seen" note, and should it be trusted?
 *
 * THE RULE THAT KEEPS THIS ALIVE: a location note must advertise its own age.
 * Every yard-tracking system dies the same way — the data goes stale, someone
 * drives to where it says, the gear isn't there, and from then on nobody
 * believes any of it. A note that says "6 days ago" is still useful. A note
 * that silently presents 6-week-old information as fact is what kills trust.
 *
 * fresh  (<= 2 days) — act on it
 * aging  (3-13 days) — probably right, worth confirming
 * stale  (>= 14 days) — treat as a hint, not an answer
 */
export type SeenAge = { label: string; tone: "fresh" | "aging" | "stale" };

export function seenAge(iso: string | null | undefined, now: Date = new Date()): SeenAge | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return null;
  const days = Math.floor((now.getTime() - t) / 86400e3);
  if (days <= 0) return { label: "today", tone: "fresh" };
  if (days === 1) return { label: "yesterday", tone: "fresh" };
  if (days < 14) return { label: `${days}d ago`, tone: days <= 2 ? "fresh" : "aging" };
  if (days < 60) return { label: `${days}d ago`, tone: "stale" };
  const months = Math.round(days / 30);
  return { label: `${months}mo ago`, tone: "stale" };
}

/** Display formatting for date-only strings (YYYY-MM-DD).
 *  Parsed as LOCAL midnight — `new Date("2026-08-14")` alone is UTC midnight,
 *  which renders as the previous day anywhere west of Greenwich. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
