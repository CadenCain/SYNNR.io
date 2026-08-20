/**
 * Entitlements — the owner's decisions from the 2026-08-19 spec, pure.
 *
 * THE MODEL IS A HARD CAP. The quantity picked at checkout is a paid
 * allowance; the customer creates up to that many yards and the app refuses
 * the next one until they raise the plan. This deliberately replaces the
 * earlier auto-scaling behavior: this buyer hates surprise invoices more
 * than he hates friction, so no yard creation may ever silently move the
 * bill. Comped companies bypass the cap entirely.
 */

export type Role = "owner" | "admin" | "member";

// ── Yard cap ────────────────────────────────────────────────────────────────

export interface CapState {
  atCap: boolean;
  remaining: number; // Infinity when comped
}

/** billableInUse counts real yards only (the demo yard is free and exempt). */
export function yardCapState(billableInUse: number, allowance: number, comped: boolean): CapState {
  if (comped) return { atCap: false, remaining: Infinity };
  const remaining = Math.max(0, allowance - billableInUse);
  return { atCap: remaining <= 0, remaining };
}

/** Lowering the allowance below yards-in-use is refused, never auto-deleted. */
export function canLowerAllowance(newAllowance: number, billableInUse: number): { ok: boolean; reason?: string } {
  if (newAllowance < 1) return { ok: false, reason: "The minimum plan is one yard." };
  if (newAllowance < billableInUse) {
    return {
      ok: false,
      reason: `You have ${billableInUse} yards. Delete ${billableInUse - newAllowance} before dropping to ${newAllowance}.`,
    };
  }
  return { ok: true };
}

// ── Read-only on lapse ──────────────────────────────────────────────────────

/** Anything but an active subscription is read-and-export only (owner's call:
 *  past_due pauses edits too — the banner sends them to fix the card).
 *  Comped companies are always writable. Nothing is ever deleted or locked
 *  out of READING; this gates writes only. */
export function isWritable(subscriptionStatus: string, comped: boolean): boolean {
  return comped || subscriptionStatus === "active";
}

export const READ_ONLY_MESSAGE =
  "Your subscription is paused. Your records are safe and exportable — update billing to start editing again.";

// ── Role matrix ─────────────────────────────────────────────────────────────

export type Action =
  | "view" | "export" | "run_check" | "renew" | "add_record" | "update_location"
  | "import_existing_yard" | "create_proof"
  | "delete_record" | "create_yard" | "delete_yard" | "import_new_yard"
  | "manage_team" | "revoke_proof" | "manage_alerts" | "rename_company" | "promote_admin"
  | "billing" | "transfer_ownership";

const MEMBER_ACTIONS = new Set<Action>([
  "view", "export", "run_check", "renew", "add_record", "update_location",
  "import_existing_yard", "create_proof",
]);
const ADMIN_ACTIONS = new Set<Action>([
  ...MEMBER_ACTIONS,
  "delete_record", "create_yard", "delete_yard", "import_new_yard",
  "manage_team", "revoke_proof", "manage_alerts", "rename_company", "promote_admin",
]);
const OWNER_ACTIONS = new Set<Action>([...ADMIN_ACTIONS, "billing", "transfer_ownership"]);

export function canPerform(role: Role, action: Action): boolean {
  if (role === "owner") return OWNER_ACTIONS.has(action);
  if (role === "admin") return ADMIN_ACTIONS.has(action);
  return MEMBER_ACTIONS.has(action);
}

/** The friendly wall, not a 500. */
export function roleBlockedMessage(action: Action): string {
  if (action === "billing" || action === "transfer_ownership")
    return "Only the account owner can do that.";
  return "Only an admin can do that. Ask whoever runs your account.";
}
