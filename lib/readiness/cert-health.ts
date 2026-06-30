/**
 * Tiny shared helper — given a date string (YYYY-MM-DD), classify a cert's
 * expiry as ok / warn / bad and return a label + badge className. Used in the
 * assets list and the outbound view so the visual language is consistent.
 *
 * Dates are compared in UTC. That's good enough: cert dates are calendar days,
 * not instants, and a one-day timezone error on "expires in 4 days vs 3" is
 * caught by the cron's tiered (30/14/3) generation, not this badge.
 */
export interface CertHealth {
  label: string;
  className: string;
  daysLeft: number;
}

export function certHealth(expiresAt: string, today: Date = new Date()): CertHealth {
  const exp = new Date(expiresAt + "T00:00:00Z").getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const daysLeft = Math.floor((exp - now) / 86400e3);
  if (daysLeft < 0) return { label: `${-daysLeft}d expired`, className: "op-badge op-badge-bad", daysLeft };
  if (daysLeft <= 3) return { label: `${daysLeft}d left`, className: "op-badge op-badge-bad", daysLeft };
  if (daysLeft <= 14) return { label: `${daysLeft}d left`, className: "op-badge op-badge-warn", daysLeft };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, className: "op-badge", daysLeft };
  return { label: "ok", className: "op-badge op-badge-good", daysLeft };
}

/** Convenience for badges that only need label+className. */
export function certHealthBadge(expiresAt: string): { label: string; className: string } {
  const h = certHealth(expiresAt);
  return { label: h.label, className: h.className };
}
