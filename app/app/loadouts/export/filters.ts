import { YARD_TZ } from "@/lib/saas/format";
import { addDaysIso } from "@/lib/saas/status";

/**
 * The load-out records filters, read the same way by the records page and
 * the spreadsheet, so "Download these" downloads exactly what the page shows
 * (all of it, past the newest 400): a yard, an answer, who loaded it, a date
 * range (yard days), and words in the job or well.
 */
export type LoadoutShow = "" | "ready" | "blocked" | "override";
export interface LoadoutFilters { yard: string; show: LoadoutShow; by: string; from: string; to: string; job: string }

type Params = Record<string, string | string[] | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const realDay = (d: string) => DAY.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;

export function loadoutFilters(sp: Params | URLSearchParams): LoadoutFilters {
  const one = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return String((Array.isArray(v) ? v[0] : v) ?? "").trim();
  };
  const show = one("show");
  let from = realDay(one("from")) ? one("from") : "";
  let to = realDay(one("to")) ? one("to") : "";
  // Typed backwards: the range is still the days between them.
  if (from && to && from > to) [from, to] = [to, from];
  return {
    yard: UUID.test(one("yard")) ? one("yard") : "",
    show: (["ready", "blocked", "override"] as const).find((x) => x === show) ?? "",
    by: one("by").slice(0, 120),
    from, to,
    job: one("job").replace(/\s+/g, " ").slice(0, 80),
  };
}

export const isFiltering = (f: LoadoutFilters) => Boolean(f.yard || f.show || f.by || f.from || f.to || f.job);

/** The same filters as a query string, for the download link ("" when there are none). */
export function filterQuery(f: LoadoutFilters): string {
  const q = new URLSearchParams();
  for (const k of ["yard", "show", "by", "from", "to", "job"] as const) if (f[k]) q.set(k, f[k]);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** How far the clock is from UTC in a zone at a moment, in ms. */
function zoneOffsetMs(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - ms;
}

/** Midnight at the start of a yard day, as a moment (ISO). */
export function dayStartIso(day: string, tz: string = YARD_TZ): string {
  const guess = Date.parse(`${day}T00:00:00Z`);
  let t = guess - zoneOffsetMs(guess, tz);
  // Across a clock change the offset at midnight differs from the guess's.
  const again = zoneOffsetMs(t, tz);
  if (again !== zoneOffsetMs(guess, tz)) t = guess - again;
  return new Date(t).toISOString();
}

/** The moments a from/to pair covers: from the start of `from` up to (not including) the day after `to`. */
export function rangeOf(f: Pick<LoadoutFilters, "from" | "to">): { gte: string | null; lt: string | null } {
  return { gte: f.from ? dayStartIso(f.from) : null, lt: f.to ? dayStartIso(addDaysIso(f.to, 1)) : null };
}

/** Words in the job or well, as a case-blind "contains" match: what was typed is taken as plain text. */
export const jobPattern = (job: string) => `%${job.replace(/\*/g, " ").replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
