import { addDaysIso } from "./status";

/**
 * THE readiness rules. One pure function, used by the fleet-board tiles
 * (lib/saas/readiness.ts), the readiness check (lib/saas/dispatch-check.ts)
 * and the public proof link, so a truck can never read green on one screen
 * and red on another. Before this there were three copies and they
 * disagreed: red-tagged gear failed the check only if it matched a gear-list
 * line, and a hand with no cards failed the check but not the tile or the
 * proof link.
 *
 * A truck is NOT READY, as of a date, when any of these is true:
 *   · a cert on the truck, its gear, or its assigned crew has no date on file
 *   · one of those expires before that date
 *   · a piece of its gear is flagged missing or out of service (red-tagged)
 *   · an assigned hand has no cards on file at all
 * unless the lapsed cert is "cert on the way" (a manager accepted retest
 * evidence) and that 7-day window still covers the date. That shows yellow,
 * named, and never hides: once the window closes it's red again on its own.
 *
 * Nothing tracked at all = NOT SET UP, never green.
 */

export interface JItem {
  id: string;
  title: string;
  expiration_date: string | null;
  pending_until?: string | null;
  reminder_days?: number | null;
  parent_id?: string;
}
export interface JAsset { id: string; name: string; status: string }
export interface JCrew { id: string; name: string }

export interface UnitScope {
  unitItems: JItem[];
  assets: JAsset[];
  assetItems: JItem[]; // parent_id = asset id
  crew: JCrew[];
  crewItems: JItem[];  // parent_id = crew id
}

export type LineResult = "ok" | "due_soon" | "pending" | "expired" | "missing";

export interface JLine {
  kind: "cert" | "crew_cert" | "asset" | "crew";
  id: string;
  label: string;
  result: LineResult;
  detail: string;
  expiration_date: string | null;
}

export interface Judgment {
  verdict: "ready" | "due_soon" | "not_ready" | "not_setup";
  lines: JLine[];
  failures: JLine[];
  pending: JLine[];
  dueSoon: JLine[];
  /** One line for a tile: the worst reason. */
  why: string;
}

export const FAILING_GEAR = new Set(["missing", "out_of_service"]);

/** "2in 1502 plug valve" + "PV-2231" → "2in 1502 plug valve PV-2231" (unless the name already says it). */
export function withSerial(name: string, serial: string | null | undefined): string {
  return serial && !name.includes(serial) ? `${name} ${serial}` : name;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-09-23" → "Sep 23, 2026": how dates read everywhere a person sees them. */
export function plainDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return m && d ? `${MON[m - 1]} ${d}, ${y}` : iso;
}

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400e3);

/** Is "cert on the way" covering this item on this date? */
export function pendingCovers(item: Pick<JItem, "pending_until">, asOf: string): boolean {
  return Boolean(item.pending_until && item.pending_until >= asOf);
}

/**
 * Judge one cert as of a date.
 *   asOf     the job date (today for the board)
 *   today    the yard's calendar day, for "expired N days ago" wording
 *   soonDays how far ahead counts as "due soon" (the item's reminder window
 *            on the board; a fixed 21 days after the job on a check)
 */
export function judgeItem(item: JItem, asOf: string, today: string, soonDays?: number): { result: LineResult; detail: string } {
  const exp = item.expiration_date;
  const failing = exp === null || exp < asOf;
  if (failing && pendingCovers(item, asOf)) {
    return { result: "pending", detail: `retested, cert on the way (counts through ${plainDate(item.pending_until as string)})` };
  }
  if (exp === null) return { result: "missing", detail: "no expiration on file" };
  if (exp < asOf) {
    if (asOf > today && exp >= today) return { result: "expired", detail: `expires ${plainDate(exp)}, before the ${plainDate(asOf)} job` };
    const ago = days(exp, today);
    return { result: "expired", detail: `expired ${plainDate(exp)}${ago > 0 ? ` (${ago}d ago)` : ""}` };
  }
  const window = soonDays ?? item.reminder_days ?? 30;
  if (exp <= addDaysIso(asOf, window)) {
    const d = days(today, exp);
    return { result: "due_soon", detail: d <= 0 ? "expires today" : `expires ${plainDate(exp)} (in ${d}d)` };
  }
  return { result: "ok", detail: `good to ${plainDate(exp)}` };
}

/** Short wording for a tile: "BOP test: expired 6d ago". */
function shortWhy(l: JLine, today: string): string {
  if (l.kind === "crew") return l.label;
  if (l.kind === "asset") return `${l.label}: ${l.detail === "flagged missing" ? "missing" : "red-tagged"}`;
  if (l.result === "pending") return `${l.label}: cert on the way`;
  if (l.result === "missing") return `${l.label}: no expiration on file`;
  const exp = l.expiration_date as string;
  if (l.result === "expired") {
    const ago = days(exp, today);
    return ago > 0 ? `${l.label}: expired ${ago}d ago` : `${l.label}: expires before the job`;
  }
  const d = days(today, exp);
  return `${l.label} expires ${d <= 0 ? "today" : `in ${d}d`}`;
}

export function judgeUnit(scope: UnitScope, asOf: string, today: string, opts: { soonDays?: number } = {}): Judgment {
  const lines: JLine[] = [];
  const assetName = new Map(scope.assets.map((a) => [a.id, a.name]));
  const crewName = new Map(scope.crew.map((c) => [c.id, c.name]));

  // Gear flagged missing or red-tagged fails the truck, whatever list it's on.
  for (const a of scope.assets) {
    if (a.status === "missing") lines.push({ kind: "asset", id: a.id, label: a.name, result: "missing", detail: "flagged missing", expiration_date: null });
    else if (a.status === "out_of_service") lines.push({ kind: "asset", id: a.id, label: a.name, result: "missing", detail: "red-tagged (out of service)", expiration_date: null });
  }

  const push = (i: JItem, label: string, kind: JLine["kind"]) => {
    const j = judgeItem(i, asOf, today, opts.soonDays);
    lines.push({ kind, id: i.id, label, result: j.result, detail: j.detail, expiration_date: i.expiration_date });
  };
  for (const i of scope.unitItems) push(i, i.title, "cert");
  for (const i of scope.assetItems) push(i, `${i.title} (${assetName.get(i.parent_id ?? "") ?? "gear"})`, "cert");
  for (const i of scope.crewItems) push(i, `${i.title} (${crewName.get(i.parent_id ?? "") ?? "crew"})`, "crew_cert");

  // An assigned hand with no cards at all can't be proven, so they fail.
  const withCards = new Set(scope.crewItems.map((i) => i.parent_id));
  for (const c of scope.crew) {
    if (!withCards.has(c.id)) lines.push({ kind: "crew", id: c.id, label: `${c.name}: no cards on file`, result: "missing", detail: "no cards on file", expiration_date: null });
  }

  const failures = lines.filter((l) => l.result === "missing" || l.result === "expired");
  const pending = lines.filter((l) => l.result === "pending");
  const dueSoon = lines.filter((l) => l.result === "due_soon");
  const tracked = scope.unitItems.length + scope.assetItems.length + scope.crewItems.length + scope.crew.length;

  let verdict: Judgment["verdict"];
  if (failures.length > 0) verdict = "not_ready";
  else if (tracked === 0) verdict = "not_setup";
  else if (pending.length > 0 || dueSoon.length > 0) verdict = "due_soon";
  else verdict = "ready";

  // The tile's one-liner: gear problems first, then the oldest lapse, then
  // anything with no date, then a hand with no cards, then pending, then the
  // soonest due.
  const prio = (l: JLine) =>
    l.kind === "asset" ? 0
    : l.result === "expired" ? 1
    : l.kind === "crew" ? 3
    : l.result === "missing" ? 2
    : l.result === "pending" ? 4 : 5;
  const worst = lines
    .filter((l) => l.result !== "ok")
    .sort((a, b) => prio(a) - prio(b) || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))[0];
  const why = !worst ? (tracked === 0 ? "Nothing tracked yet" : "All current") : shortWhy(worst, today);

  return { verdict, lines, failures, pending, dueSoon, why };
}
