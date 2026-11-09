import type { YardScanPiece } from "@/lib/saas/scan-pieces";
import { requiredChecks } from "@/lib/saas/roll-checks";

/**
 * The load-out phone's small decisions, kept out of the screen so they can be
 * checked on their own: what it sends for pieces that didn't get scanned,
 * which spare it points a hand at, and how it catches up when a manager
 * changed the plan or the kit while the screen was open. None of this decides
 * READY: the server does that from the records.
 */

/** A piece as the load-out phone has it. near: in this truck's yard (on its racks, or on a truck parked there). */
export type PhonePiece = YardScanPiece & { near?: boolean };
export type Outcome = "yard" | "missing";

/**
 * Red on the phone and not scanned: the hand has to say what happened to it.
 * There's no default, so a bad piece left bolted on is never written down as
 * taken off.
 */
export const needsAnswer = (p: PhonePiece, outcomes: Record<string, Outcome>) => p.problem === "red" && !outcomes[p.id];

/**
 * What the phone says about pieces logged on the truck that didn't get
 * scanned. A piece already flagged missing isn't asked about (the server
 * takes it off the truck by itself), and a red one nobody answered for is
 * left out, so the server blocks on it as not scanned.
 */
export function notScannedFor(expected: PhonePiece[], scans: Record<string, unknown>, outcomes: Record<string, Outcome>): { assetId: string; outcome: Outcome }[] {
  return expected.filter((p) => !scans[p.id] && !p.missing && !needsAnswer(p, outcomes))
    .map((p) => ({ assetId: p.id, outcome: outcomes[p.id] ?? "yard" }));
}

/**
 * Where to send a hand for a spare, best first: on a rack in this yard, then
 * on a truck parked in this yard, then other yards' racks, then their trucks.
 * (Iron that's out on a job, signed out, or flagged missing isn't offered at all.)
 */
export const grabRank = (p: PhonePiece) => (p.near ? 0 : 2) + (p.unitId ? 1 : 0);

/** A spare a hand can go get right now: not on this truck, not bad, not out, not missing. */
export const grabbable = (p: PhonePiece, truckId: string) => p.unitId !== truckId && p.problem !== "red" && !p.out && !p.missing;

/** The plan as the phone shows it. at: as the page wrote it (fmtWhen). */
export interface ShownPlan { id?: string; by: string | null; at: string; job?: string | null; packageIds: string[]; lines: { label: string; qty: number }[] }
/** The plan as the server checked the save against it. */
export interface ServerPlan { id: string; atText: string; by: string | null; job: string | null; packageIds: string[]; lines: { label: string; qty: number }[] }

const planKey = (p: { at: string; job?: string | null; packageIds: string[]; lines: { label: string; qty: number }[] }) =>
  JSON.stringify([p.at, p.job ?? null, [...p.packageIds].sort(), p.lines]);

/**
 * A manager changed (or cleared) the plan while the screen was open. The new
 * plan's packages are locked on, a package only the old plan locked comes
 * off, and the hand is told the list changed.
 */
export function planCatchUp(input: { shown: ShownPlan | null; locked: string[]; packageIds: string[]; known: string[]; server: ServerPlan | null }):
  { packageIds: string[]; locked: string[]; dropped: string[]; plan: ShownPlan | null; note: string | null } {
  const { shown, server } = input;
  const locked = (server?.packageIds ?? []).filter((id) => input.known.includes(id));
  const oldOnly = input.locked.filter((id) => !locked.includes(id));
  const packageIds = [...new Set([...input.packageIds.filter((id) => !oldOnly.includes(id)), ...locked])];
  const plan: ShownPlan | null = server ? { id: server.id, by: server.by, at: server.atText, job: server.job, packageIds: locked, lines: server.lines } : null;
  let note: string | null = null;
  if (shown && !server) note = "The plan for this truck was cleared. This is the list now.";
  else if (server && plan && (!shown || (shown.id !== undefined && shown.id !== server.id) || planKey(shown) !== planKey(plan))) {
    note = `${server.by ?? "A manager"} ${shown ? "changed the plan" : "planned this job"} ${server.atText}. This is the new list.`;
  }
  return { packageIds, locked, dropped: oldOnly, plan, note };
}

/**
 * The truck kit's own checks, from every check the server asked for: what's
 * left once the picked packages' checks are taken out. A check a manager
 * renamed on the kit shows with its new name.
 */
export function kitChecksFrom(serverChecks: string[], packageChecks: (string[] | null | undefined)[]): string[] {
  const fromPackages = new Set(requiredChecks(...packageChecks).map((c) => c.toLowerCase()));
  return requiredChecks(serverChecks).filter((c) => !fromPackages.has(c.toLowerCase()));
}
