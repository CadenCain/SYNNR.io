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
  if (!d) return "No date";
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Timestamps show in the yard's time. The Permian runs on Central, and these
 *  pages render on the server, which runs on UTC. Without the zone a check run
 *  at 5am showed as 10am. */
export const YARD_TZ = "America/Chicago";

/**
 * The US time zones a yard can run on (saas_yards.time_zone, migration 0035
 * holds the same list). Central is the default. A yard in Hobbs, NM is on
 * Mountain time: shown in Central, its 5:10 AM load-out read 6:10 AM.
 */
export const YARD_ZONES = [
  { tz: "America/Chicago", name: "Central", short: "CT" },
  { tz: "America/Denver", name: "Mountain", short: "MT" },
  { tz: "America/Phoenix", name: "Arizona", short: "MT" },
  { tz: "America/Los_Angeles", name: "Pacific", short: "PT" },
  { tz: "America/New_York", name: "Eastern", short: "ET" },
  { tz: "America/Anchorage", name: "Alaska", short: "AKT" },
] as const;

export function isYardZone(tz: unknown): tz is string {
  return typeof tz === "string" && YARD_ZONES.some((z) => z.tz === tz);
}
/** The yard's zone, or Central when it has none (or one we don't know). */
export function yardZone(tz?: string | null): string {
  return isYardZone(tz) ? tz : YARD_TZ;
}
/** "CT", "MT": said next to a time an outsider will hold up against his own clock. */
export function zoneShort(tz?: string | null): string {
  return YARD_ZONES.find((z) => z.tz === yardZone(tz))!.short;
}
/** "Central", "Mountain". */
export function zoneName(tz?: string | null): string {
  return YARD_ZONES.find((z) => z.tz === yardZone(tz))!.name;
}

/**
 * "Nov 12, 5:10 AM". Pass the yard's zone (even null, for Central) and it
 * reads in that zone with the zone on it: "Nov 12, 5:10 AM MT". Without it,
 * Central with no zone, as every screen has always shown.
 */
export function fmtWhen(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "No date";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  const s = dt.toLocaleString("en-US", { timeZone: tz === undefined ? YARD_TZ : yardZone(tz), month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return tz === undefined ? s : `${s} ${zoneShort(tz)}`;
}

/** "5:10 AM", or with the yard's zone passed, "5:10 AM MT". */
export function fmtTime(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "";
  const s = dt.toLocaleTimeString("en-US", { timeZone: tz === undefined ? YARD_TZ : yardZone(tz), hour: "numeric", minute: "2-digit" });
  return tz === undefined ? s : `${s} ${zoneShort(tz)}`;
}

export function fmtDay(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) return "No date";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", { timeZone: tz === undefined ? YARD_TZ : yardZone(tz), month: "short", day: "numeric", year: "numeric" });
}
