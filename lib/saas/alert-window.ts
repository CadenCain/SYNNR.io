import { addDaysIso } from "./status";

/**
 * The sweep's due-window predicate, extracted pure so the exact boundary a
 * customer's $10k rides on is pinned by tests instead of read-and-hoped.
 *
 * An item is DUE for an alert when, on the customer's local day:
 *   - it has no expiration on file (unverifiable = failing = alert), or
 *   - it expires on or before today+leadDays (expired counts — a lapsed cert
 *     that somehow never alerted must not stay silent), and
 *   - it has not already been alerted (one alert per item; renewal clears the
 *     log and re-arms it).
 */
export function alertHorizon(todayIso: string, leadDays: number): string {
  return addDaysIso(todayIso, leadDays);
}

export function isAlertDue(
  expirationIso: string | null,
  todayIso: string,
  leadDays: number,
  alreadyAlerted: boolean,
): boolean {
  if (alreadyAlerted) return false;
  if (expirationIso === null) return true;
  return expirationIso <= alertHorizon(todayIso, leadDays);
}

/**
 * One more alert after it runs out. The heads-up goes out about leadDays
 * ahead; without this a test that lapsed while the truck sat never showed up
 * in anyone's mail again. Due once it has expired (its date is before today)
 * when every alert so far went out while it was still good: lastAlertDay is
 * the yard-time day of the newest one, null when it never alerted. An item
 * whose first alert went out after it ran out already said EXPIRED.
 */
export function isExpiredAlertDue(
  expirationIso: string | null,
  todayIso: string,
  lastAlertDay: string | null,
): boolean {
  if (expirationIso === null || lastAlertDay === null) return false;
  return expirationIso < todayIso && lastAlertDay <= expirationIso;
}

/**
 * The morning run (expiration alerts + the managers' morning email) lands at
 * 4 AM yard time all year, ahead of the 4:30 load-out rush. Vercel's cron
 * clock is UTC and doesn't move for daylight time, so vercel.json fires at
 * both 09:00 and 10:00 UTC and only the one that is 4 AM in America/Chicago
 * does the work: 09:00 UTC on daylight time, 10:00 UTC on standard time.
 * Exactly one of the two is 4 AM on any day, the change-over Sundays too.
 */
export const MORNING_RUN_HOUR = 4;

export function isMorningRunHour(now: Date = new Date()): boolean {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" })
    .formatToParts(now).find((p) => p.type === "hour")?.value;
  return Number(hour) === MORNING_RUN_HOUR;
}

/**
 * Where today's morning run starts, in UTC: 08:00, ahead of 4 AM yard time on
 * either clock (09:00 UTC daylight, 10:00 UTC standard). The run's "already
 * ran today" check and the watchdog both look from here, so yesterday's run,
 * even a ?force=1 re-run late in the day, never counts for today.
 */
export function morningRunWindowStart(now: Date = new Date()): Date {
  const d = new Date(now.getTime());
  d.setUTCHours(8, 0, 0, 0);
  return d;
}
