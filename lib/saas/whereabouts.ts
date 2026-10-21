/**
 * Where a piece of iron is, in the words a yard uses. Pure, so the board,
 * the equipment list, search, the alert email, and tests all say the same.
 *
 *   Red-tagged     taken out of service (wherever it sits)
 *   Missing        flagged missing
 *   Out too long   left on a load-out and not checked back in after the limit
 *   Out on job     left on a load-out, not back yet
 *   On truck       logged on a truck that's in the yard
 *   In yard        on a rack or spot in the yard
 */

export type Place = "red_tagged" | "missing" | "out_too_long" | "out" | "on_truck" | "in_yard" | "retired";

export const PLACE_LABEL: Record<Place, string> = {
  red_tagged: "Red-tagged",
  missing: "Missing",
  out_too_long: "Out too long",
  out: "Out on job",
  on_truck: "On truck",
  in_yard: "In yard",
  retired: "Retired",
};

/** Worst first, for sorting and for "what needs a look". */
export const PLACE_ORDER: Record<Place, number> = { red_tagged: 0, missing: 1, out_too_long: 2, out: 3, on_truck: 4, in_yard: 5, retired: 6 };

export const DEFAULT_OUT_ALERT_DAYS = 7;

/** Whole days since it left, counting a partial day as zero until 24 hours pass. */
export function daysOut(outSince: string | null | undefined, now: number): number {
  if (!outSince) return 0;
  return Math.max(0, Math.floor((now - Date.parse(outSince)) / 86400e3));
}

export function placeOf(
  a: { status: string; unit_id: string | null; out_since?: string | null },
  now: number,
  alertDays: number = DEFAULT_OUT_ALERT_DAYS,
): Place {
  if (a.status === "retired") return "retired";
  if (a.status === "out_of_service") return "red_tagged";
  if (a.status === "missing") return "missing";
  if (a.out_since) return daysOut(a.out_since, now) >= alertDays ? "out_too_long" : "out";
  return a.unit_id ? "on_truck" : "in_yard";
}

/**
 * Is a truck out on a job? It is from a load-out that rolled (READY, or NOT
 * READY on a manager's override) until somebody checks it back in. A NOT
 * READY load-out nobody overrode never left.
 */
export function truckOut(
  loadouts: { id: string; unit_id: string | null; finished_at: string; rolled: boolean }[],
  returns: { unit_id: string | null; finished_at: string }[],
): Map<string, { since: string; loadoutId: string }> {
  const lastReturn = new Map<string, string>();
  for (const r of returns) {
    if (r.unit_id && (!lastReturn.has(r.unit_id) || r.finished_at > lastReturn.get(r.unit_id)!)) lastReturn.set(r.unit_id, r.finished_at);
  }
  const out = new Map<string, { since: string; loadoutId: string }>();
  const latest = new Map<string, (typeof loadouts)[number]>();
  for (const l of loadouts) {
    if (l.unit_id && (!latest.has(l.unit_id) || l.finished_at > latest.get(l.unit_id)!.finished_at)) latest.set(l.unit_id, l);
  }
  for (const [unitId, l] of latest) {
    if (!l.rolled) continue;
    const back = lastReturn.get(unitId);
    if (!back || back < l.finished_at) out.set(unitId, { since: l.finished_at, loadoutId: l.id });
  }
  return out;
}
