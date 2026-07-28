import type { ComplianceStatus } from "./db";

/**
 * Shared status + readiness math.
 *
 * SOURCE OF TRUTH for per-item status is the SQL view
 * `saas_compliance_items_with_status`, computed against the CUSTOMER's local
 * day (America/Chicago — all current customers are West Texas), not UTC:
 *   expired  → expiration_date <  chicago_today
 *   expiring → expiration_date <= chicago_today + reminder_days
 *   valid    → otherwise
 *   none     → no expiration_date
 * An item expiring today stays valid ("Due soon") through the END of that day
 * local time — under UTC it flipped to expired around 6-7pm in the yard.
 * computeStatus() below is the TS twin. If you change one, change both.
 */

/** Today's date (YYYY-MM-DD) in the customers' timezone. */
export function localToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

/** ISO date + n days, pure string math on UTC-noon to dodge DST edges. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeStatus(
  expirationDate: string | null,
  reminderDays = 30,
  today: string = localToday(),
): ComplianceStatus {
  if (!expirationDate) return "none";
  if (expirationDate < today) return "expired";
  if (expirationDate <= addDaysIso(today, reminderDays)) return "expiring";
  return "valid";
}

/**
 * READINESS FORMULA — live records only:
 *   readiness = 0.7·certCurrency + 0.3·crewCurrency
 * where each input ∈ [0,1]:
 *   certCurrency = valid / (valid+expiring+expired+none) across unit+asset certs
 *   crewCurrency = valid / (valid+expiring+expired+none) across crew cards
 * Inputs with no data are EXCLUDED from the blend (weights renormalize) —
 * a shop with no crew cards on file yet isn't punished or flattered.
 *
 * The gear list is deliberately NOT an input. It's a reference, not a
 * judgment (see dispatch-check.ts), so scoring it would hand out free points
 * for pressing a button: every gear line records "ok" unless an asset is
 * flagged, which would inject a constant into the blend and inflate the
 * score for a shop whose paperwork is actually behind. Everything the score
 * counts is something a tile can also show as red — no invisible inputs.
 *
 * HARD CAP: if anything is unprovable (an expired cert anywhere, a cert with
 * no date on file, or an asset flagged missing), readiness is capped at 74% —
 * the amber band. 100% never lies, and the cap always has a visible cause.
 *
 * UNCONFIGURED: with no inputs at all (no certs, no crew cards) the honest
 * answer is "we don't know yet", never 100 — returns null and the UI renders
 * "Not set up yet".
 */
export function computeReadiness(inputs: {
  certCurrency: number | null;
  crewCurrency: number | null;
  hardFail: boolean;
}): number | null {
  const parts: { w: number; v: number }[] = [];
  if (inputs.certCurrency != null) parts.push({ w: 0.7, v: inputs.certCurrency });
  if (inputs.crewCurrency != null) parts.push({ w: 0.3, v: inputs.crewCurrency });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  let pct = Math.round((parts.reduce((s, p) => s + p.w * p.v, 0) / wSum) * 100);
  if (inputs.hardFail) pct = Math.min(pct, 74);
  return Math.max(0, Math.min(100, pct));
}

/** The one status vocabulary: Ready / Due soon / Not ready / Not set up
 *  (nothing tracked — never green). "Out" was removed with check-in/check-out:
 *  SYNNR tracks record currency, not physical possession. */
export type UnitState = "ready" | "due_soon" | "not_ready" | "not_setup";

/**
 * THE one "worst status" — every surface (crew chips, unit tiles, checkout)
 * ranks through this so the same record never reads two ways (walkthrough H1).
 *
 * Severity: expired (proven lapsed) > none (NO DATE ON FILE — can't prove it,
 * treated as failing, shows as "Missing") > expiring > valid.
 */
const WORST_RANK: Record<ComplianceStatus, number> = { expired: 0, none: 1, expiring: 2, valid: 3 };
export function worstStatus(statuses: ComplianceStatus[]): ComplianceStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((w, s) => (WORST_RANK[s] < WORST_RANK[w] ? s : w));
}

/** A compliance item that fails readiness: expired, or unverifiable (no date). */
export function isFailing(status: ComplianceStatus): boolean {
  return status === "expired" || status === "none";
}
