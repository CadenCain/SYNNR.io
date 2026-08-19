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
