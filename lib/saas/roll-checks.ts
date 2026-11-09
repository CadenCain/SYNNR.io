/**
 * Roll checks: up to three taps a manager puts on a job package or a truck
 * kit, things that can't be scanned but cost money when skipped ("BOP rams
 * closed for travel", "Everything strapped and padded"). The hand taps each
 * before the load-out saves. One that wasn't tapped makes the truck NOT READY.
 */

export const MAX_ROLL_CHECKS = 3;

/** A manager's list, cleaned: trimmed, short, no blanks or repeats, at most three. */
export function cleanChecks(raw: unknown[]): string[] {
  const out: string[] = [];
  for (const x of raw) {
    const s = String(x ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out.slice(0, MAX_ROLL_CHECKS);
}

/** Every check the truck's kit and the job's packages ask for, once each, in order. */
export function requiredChecks(...lists: (string[] | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const l of lists) for (const c of l ?? []) {
    const s = String(c).trim();
    if (s && !out.some((o) => o.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

/** The ones the hand didn't tap. */
export function missingChecks(required: string[], confirmed: string[]): string[] {
  const done = new Set(confirmed.map((c) => String(c).trim().toLowerCase()));
  return required.filter((r) => !done.has(r.toLowerCase()));
}
