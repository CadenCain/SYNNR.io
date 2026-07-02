import type { ComplianceStatus } from "./db";

/**
 * Shared status + readiness math.
 *
 * SOURCE OF TRUTH for per-item status is the SQL view
 * `saas_compliance_items_with_status`:
 *   expired  → expiration_date <  current_date
 *   expiring → expiration_date <= current_date + reminder_days
 *   valid    → otherwise
 *   none     → no expiration_date
 * computeStatus() below is the TS twin of that definition — used only where a
 * live client-side calc is needed (the dispatch Ready banner). If you change
 * one, change both.
 */
export function computeStatus(
  expirationDate: string | null,
  reminderDays = 30,
  today: Date = new Date(),
): ComplianceStatus {
  if (!expirationDate) return "none";
  const exp = new Date(expirationDate + "T00:00:00Z").getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (exp < now) return "expired";
  if (exp <= now + reminderDays * 86400e3) return "expiring";
  return "valid";
}

/**
 * READINESS FORMULA (documented per spec §8):
 *   readiness = 0.5·certCurrency + 0.3·loadoutCompleteness + 0.2·crewCurrency
 * where each input ∈ [0,1]:
 *   certCurrency        = valid / (valid+expiring+expired) across unit+asset certs
 *   loadoutCompleteness = required-ok / required-total on each unit's latest
 *                         check-out, averaged across units that have one
 *   crewCurrency        = valid / (valid+expiring+expired) across crew certs
 * Inputs with no data are EXCLUDED from the blend (weights renormalize) —
 * a shop that hasn't run a check-out yet isn't punished or flattered.
 *
 * HARD CAP: if anything required is hard-failing (an expired cert anywhere, a
 * required loadout item missing on a latest check-out, or an asset flagged
 * missing), readiness is capped at 74% — the amber band. 100% never lies.
 *
 * UNCONFIGURED: with no inputs at all (no certs, no checks, no crew cards)
 * the honest answer is "we don't know yet", never 100 — returns null and the
 * UI renders "Not set up yet".
 */
export function computeReadiness(inputs: {
  certCurrency: number | null;
  loadoutCompleteness: number | null;
  crewCurrency: number | null;
  hardFail: boolean;
}): number | null {
  const parts: { w: number; v: number }[] = [];
  if (inputs.certCurrency != null) parts.push({ w: 0.5, v: inputs.certCurrency });
  if (inputs.loadoutCompleteness != null) parts.push({ w: 0.3, v: inputs.loadoutCompleteness });
  if (inputs.crewCurrency != null) parts.push({ w: 0.2, v: inputs.crewCurrency });
  if (parts.length === 0) return null;
  const wSum = parts.reduce((s, p) => s + p.w, 0);
  let pct = Math.round((parts.reduce((s, p) => s + p.w * p.v, 0) / wSum) * 100);
  if (inputs.hardFail) pct = Math.min(pct, 74);
  return Math.max(0, Math.min(100, pct));
}

/** The one status vocabulary (spec §2.3): Ready / Due soon / Not ready / Out /
 *  Not set up (nothing tracked — never green). */
export type UnitState = "ready" | "due_soon" | "not_ready" | "out" | "not_setup";

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
