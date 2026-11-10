import { expectedLines, type ExpectedLine } from "./loadout-lines";

/**
 * The quick check's rules, shared by the phone and the server: the short
 * list for a truck and job, how a line is named when the phone says it's on,
 * and what makes the truck READY.
 */

/** The list: the truck's kit, then each job list picked or planned, then the plan's extra lines. */
export function quickLines(input: { kit: { label: string; qty: number }[]; packages: { name: string; lines: { label: string; qty: number }[] }[]; planned?: { label: string; qty: number }[] }): ExpectedLine[] {
  return expectedLines({ kit: input.kit, packages: input.packages, planned: input.planned ?? [], quick: [] });
}

/** One line on the list, the same on the phone and the server (a label can be on the kit and a job list both). */
export const quickKey = (l: { label: string; source: string; package?: string }) => `${l.source}|${l.package ?? ""}|${l.label.trim().toLowerCase()}`;

/**
 * READY when every line on the list is on the truck, every check is tapped,
 * and the photo is in (when the yard asks for one). NOT READY says what's
 * missing, in the hand's words.
 */
export function quickVerdict(input: { lines: { label: string; qty: number; n: number }[]; notTapped: string[]; needPhoto: boolean; empty: boolean }): { verdict: "ready" | "not_ready"; reasons: string[] } {
  const reasons = [
    ...input.lines.filter((l) => l.n < l.qty).map((l) => `Not on the truck: ${l.label}${l.qty > 1 ? ` (${l.n} of ${l.qty})` : ""}`),
    ...input.notTapped.map((c) => `Not confirmed: ${c}`),
    ...(input.needPhoto ? ["No photo of the loaded truck"] : []),
    ...(input.empty ? ["This truck has no list yet. A manager sets it under Truck lists."] : []),
  ];
  return { verdict: reasons.length ? "not_ready" : "ready", reasons };
}
