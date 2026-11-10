import type { YardScanPiece } from "@/lib/saas/scan-pieces";
import { requiredChecks } from "@/lib/saas/roll-checks";

/**
 * The load-out phone's small decisions, kept out of the screen so they can be
 * checked on their own: what it sends for pieces that didn't get scanned,
 * which spare it points a hand at, and how it catches up when a manager
 * changed the plan or the kit while the screen was open. None of this decides
 * READY: the server does that from the records.
 */

/**
 * A piece as the load-out phone has it. near: in this truck's yard (on its
 * racks, or on a truck parked there). held: the last save held it off the
 * truck because the records have it out somewhere else (see heldWhy).
 */
export type PhonePiece = YardScanPiece & { near?: boolean; held?: HeldWhy };
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

/** Why the server held a scanned piece off the truck (finishLoadout's notMovedWhy). */
export type HeldWhy = "out_on_job" | "signed_out" | "scanned_since" | "signed_out_until_ready";

const labelOf = (p: { name: string; serial: string | null }) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`;

/**
 * Scanned, but the server won't put it on this truck and blocks the load-out
 * until it's sorted out: it's on another truck's job that hasn't been checked
 * in, or it's been signed out to someone for more than a shift and was only
 * checked on by hand (its tag counts). What to say on its row, or null. The
 * phone goes by what the page loaded; the server decides at the save.
 */
export function heldWhy(p: PhonePiece, scan: { proof?: string } | undefined, truckId: string): string | null {
  if (!scan || p.unitId === truckId) return null;
  if (p.trip) return `On ${p.trip.truck}'s job from ${p.trip.sinceText}, and ${p.trip.truck} hasn't been checked in. Check ${p.trip.truck} in or use Move it on the piece.`;
  if (p.held === "out_on_job") return "Out on another truck's job by the records, and that truck hasn't been checked in. Check it in or use Move it on the piece.";
  if ((p.outWith?.long || p.held === "signed_out") && !scan.proof) {
    return `Signed out${p.outWith ? ` to ${p.outWith.name} since ${p.outWith.sinceText}` : " on a long run"}. Scan its tag, or check it in or use Move it on the piece.`;
  }
  return null;
}

/**
 * Why the server blocked this piece, by its answer: notMovedWhy, or (for a
 * resend, whose answer doesn't carry it) the reason that names the piece.
 */
export function blockedWhy(p: { id: string; name: string; serial: string | null }, why: Record<string, HeldWhy> | undefined, reasons: string[]): HeldWhy | null {
  if (why?.[p.id]) return why[p.id];
  const r = reasons.find((x) => x.includes(labelOf(p))) ?? "";
  return r.startsWith("Out on another truck's job:") ? "out_on_job" : r.startsWith("Signed out:") ? "signed_out"
    : r.startsWith("Scanned onto another truck after you:") ? "scanned_since" : null;
}

/**
 * After NOT READY, "Fix it and scan again" for a piece the server held that
 * isn't bad iron. It isn't taken off the truck: it stays checked on, and the
 * record somewhere else gets fixed, then the next save takes it. One scanned
 * onto another truck after this phone scanned it comes off the list, and a
 * fresh scan here clears it.
 */
export function heldFixText(p: PhonePiece, why: HeldWhy, truckName: string): string {
  const label = labelOf(p);
  if (why === "out_on_job") {
    return p.trip
      ? `${label} is still on ${p.trip.truck}'s trip: check ${p.trip.truck} in or use Move it on the piece, then scan it again here.`
      : `${label} is still out on another truck's job: check that truck in or use Move it on the piece, then scan it again here.`;
  }
  if (why === "signed_out") return `${label} is still signed out${p.outWith ? ` to ${p.outWith.name}` : ""}: scan its tag, or check it in or use Move it on the piece, then scan it again here.`;
  return `${label} was scanned onto another truck after you: scan it again if it's really on ${truckName}.`;
}

/** The truck by the records is out (it rolled, nobody checked it in since). ready: it rolled READY (not on a manager's OK). recent: under an hour ago. */
export interface TruckOut { since: string; sinceText: string; by: string | null; ready?: boolean; recent?: boolean; timeText?: string }

/**
 * The card before a load-out of a truck that's out by the records. One that
 * rolled minutes ago is most likely still in the yard (a piece got missed),
 * so it says so and offers to load it out again. Older, it's out on a job.
 */
export function truckOutCard(truckName: string, out: TruckOut): { title: string; text: string; button: string; recent: boolean } {
  if (out.recent) {
    const at = out.timeText ?? out.sinceText;
    return {
      title: `${truckName} was just loaded out`,
      text: out.ready === false
        ? `${truckName} rolled on a manager's OK at ${at}. Is it still in the yard? Scanning it again starts a new load-out and ends that trip. Sending a piece out to it? Use Move it on that piece.`
        : `${truckName} loaded out READY at ${at}${out.by ? ` by ${out.by}` : ""}. Is it still in the yard? Scanning it again starts a new load-out and ends that trip. Sending a piece out to it? Use Move it on that piece.`,
      button: "Yes, it's here: load it out again", recent: true,
    };
  }
  return {
    title: `${truckName} is out on a job`,
    text: `${truckName} is out on a job since ${out.sinceText}${out.by ? `, loaded by ${out.by}` : ""}. Only load it out once it's back in the yard.`,
    button: "It's back in the yard", recent: false,
  };
}

/** Packages as the phone knows them. */
export interface PhonePackage { id: string; name: string; lines: { label: string; qty: number }[]; checks?: string[] }

const unordered = (xs: string[]) => xs.map((x) => x.toLowerCase()).sort().join("\n");
const linesKey = (ls: { label: string; qty: number }[]) => unordered(ls.map((l) => `${l.label}\t${l.qty}`));

/**
 * The packages as the server checked the save against them: lines and roll
 * checks as they are now, and any it checked that this screen didn't know
 * (made after it opened). changed: a line or a check is different, or one is new.
 */
export function packagesCatchUp<T extends PhonePackage>(known: T[], server: PhonePackage[] | undefined): { packages: (T | PhonePackage)[]; changed: boolean } {
  if (!server?.length) return { packages: known, changed: false };
  const byId = new Map(server.map((x) => [x.id, x]));
  let changed = false;
  const packages: (T | PhonePackage)[] = known.map((x) => {
    const s = byId.get(x.id);
    if (!s) return x;
    if (linesKey(x.lines) !== linesKey(s.lines) || unordered(x.checks ?? []) !== unordered(s.checks ?? [])) changed = true;
    return { ...x, name: s.name, lines: s.lines, checks: s.checks ?? [] };
  });
  for (const s of server) {
    if (known.some((x) => x.id === s.id)) continue;
    packages.push({ id: s.id, name: s.name, lines: s.lines, checks: s.checks ?? [] });
    changed = true;
  }
  return { packages, changed };
}

/**
 * What the phone says when a save didn't get through. Its scans are on the
 * phone either way. "No signal" only when the phone has none: a failure with
 * signal says it couldn't reach RollReady.
 */
export function saveErrText(s: { withSignal: boolean; fails: number; slow: boolean; online: boolean }): string {
  return s.withSignal && s.fails >= 2
    ? "Couldn't reach RollReady. Your scans are saved on this phone. Reload the page and tap Pick it back up."
    : s.slow && s.online
      ? "Weak signal, still sending. Your scans are saved on this phone. Leave this screen open and it keeps trying."
      : s.online
        ? "Couldn't reach RollReady. Your scans are saved on this phone. Leave this screen open and it keeps trying."
        : "No signal. Your scans are saved on this phone. Leave this screen open and it sends when signal comes back, or open it again later from Load out.";
}

/** The truck's newest load-out, as the scan page read it. mine: this hand saved it. */
export interface LastLoadout { finishedAt: string; startedAt: string | null; by: string | null; ready: boolean; mine: boolean }

/**
 * A draft on this phone the server will refuse: someone loaded the truck out
 * (READY, or anyone else's load-out) after this draft was started. The
 * server's own rule (finishLoadout's stale check), so the hand doesn't
 * waste a try. A "Fix it and scan again" draft goes by a different rule and
 * is left to the server, and so is the draft's own record landing.
 */
export function draftOverrun(draft: { startedAt: string; keptSince?: string | null } | null, last: LastLoadout | null | undefined): LastLoadout | null {
  if (!draft || draft.keptSince || !last) return null;
  const started = Date.parse(draft.startedAt);
  if (!Number.isFinite(started) || !(Date.parse(last.finishedAt) > started)) return null;
  if (last.startedAt && Date.parse(last.startedAt) === started) return null;
  return last.ready || !last.mine ? last : null;
}
