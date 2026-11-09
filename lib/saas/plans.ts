import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A truck's next job, planned by a manager: the packages it needs, any extra
 * pieces, and a short note for the hand. The hand at the truck can add to the
 * list but can't take anything off, and the server checks the load-out
 * against the plan no matter what the phone sends. Used up when the truck
 * rolls (READY, or a manager's override). A plan that leaves more than 18
 * hours from now is for a later job, and one that was to leave more than a
 * day ago is old: neither locks the load-out happening now.
 */
export interface LoadoutPlan {
  id: string;
  unitId: string;
  packageIds: string[];
  lines: { label: string; qty: number }[];
  note: string | null;
  /** Which job or well it's for: goes on the record and the operator's proof link. */
  job: string | null;
  by: string | null;
  at: string;
  /** When the job is supposed to leave. Past it with no load-out that rolled = nobody scanned it out. */
  leavesAt: string | null;
}

type Row = { id: string; unit_id: string; package_ids: string[] | null; lines: { label: string; qty: number }[] | null; note: string | null; job: string | null; planned_by: string | null; created_at: string; leaves_at: string | null };
const PLAN_COLS = "id, unit_id, package_ids, lines, note, job, planned_by, created_at, leaves_at";
const toPlan = (r: Row): LoadoutPlan => ({
  id: r.id, unitId: r.unit_id, packageIds: r.package_ids ?? [], lines: cleanPlanLines(r.lines ?? []),
  note: r.note, job: r.job ?? null, by: r.planned_by, at: r.created_at, leavesAt: r.leaves_at,
});

/** A plan starts to count this long before it leaves. Further out, it's for a later job. */
export const PLAN_AHEAD_MS = 18 * 3600e3;
/** A plan whose leave time is more than this far past is old: it stops locking the truck's next load-out. */
export const PLAN_OLD_MS = 24 * 3600e3;

/**
 * Is this plan for the load-out happening now? "later": it leaves more than
 * 18 hours from now (Friday's plan for Monday's job, and the truck goes out on
 * a call Saturday). "old": it was to leave more than a day ago and never
 * rolled. "now": anything else, or no leave time set.
 */
export function planTiming(plan: Pick<LoadoutPlan, "leavesAt">, now: number): "now" | "later" | "old" {
  const leaves = plan.leavesAt ? Date.parse(plan.leavesAt) : NaN;
  if (!Number.isFinite(leaves)) return "now";
  if (leaves - now > PLAN_AHEAD_MS) return "later";
  if (now - leaves > PLAN_OLD_MS) return "old";
  return "now";
}

/**
 * Was this load-out for the plan's job? Only one that finished once the plan
 * counted: after it was made, and no more than 18 hours before it leaves.
 * Saturday's on-call load-out isn't for Monday's planned job.
 */
export function loadoutForPlan(plan: Pick<LoadoutPlan, "at" | "leavesAt">, loadout: { finished_at: string } | null): boolean {
  if (!loadout) return false;
  const made = Date.parse(plan.at);
  const leaves = plan.leavesAt ? Date.parse(plan.leavesAt) : NaN;
  const from = Math.max(Number.isFinite(made) ? made : -Infinity, Number.isFinite(leaves) ? leaves - PLAN_AHEAD_MS : -Infinity);
  return Date.parse(loadout.finished_at) > from;
}

/**
 * A planned job whose leave time has passed without a load-out that rolled:
 * the red line on the board and in the morning email. Null while it's on time.
 * lastLoadout: this truck's newest load-out, if any. Only one that was for
 * this job counts (see loadoutForPlan).
 */
export function lateLine(plan: Pick<LoadoutPlan, "at" | "leavesAt">, lastLoadout: { finished_at: string; rolled: boolean } | null, now: number, timeText: (iso: string) => string): string | null {
  const leaves = plan.leavesAt ? Date.parse(plan.leavesAt) : NaN;
  if (!plan.leavesAt || !Number.isFinite(leaves) || leaves > now) return null;
  const since = loadoutForPlan(plan, lastLoadout) ? lastLoadout : null;
  if (since?.rolled) return null;
  if (now - leaves > PLAN_OLD_MS) return `Was planned to leave ${timeText(plan.leavesAt)}, more than a day ago. That plan doesn't lock a load-out any more. Set a new time or clear it.`;
  return since
    ? `Was planned to leave ${timeText(plan.leavesAt)}. Still NOT READY.`
    : `Was planned to leave ${timeText(plan.leavesAt)}. Nobody has scanned it out.`;
}

/** Every open plan in the company, by truck, whenever it leaves (the board shows them all). */
export async function getOpenPlans(db: SupabaseClient, companyId: string): Promise<Map<string, LoadoutPlan>> {
  const { data } = await db.from("saas_loadout_plans").select(PLAN_COLS).eq("company_id", companyId).is("used_at", null);
  return new Map(((data ?? []) as Row[]).map((r) => [r.unit_id, toPlan(r)]));
}

/** This truck's open plan, whenever it leaves: the one a manager sees, edits, or clears. */
export async function getTruckPlan(db: SupabaseClient, companyId: string, unitId: string): Promise<LoadoutPlan | null> {
  const { data } = await db.from("saas_loadout_plans").select(PLAN_COLS).eq("company_id", companyId).eq("unit_id", unitId).is("used_at", null).maybeSingle();
  return data ? toPlan(data as Row) : null;
}

/**
 * The plan this truck's load-out right now is checked against: its open plan,
 * unless that one is for a later job or old (see planTiming). A plan it skips
 * stays open, and a load-out without it doesn't use it up.
 */
export async function getOpenPlan(db: SupabaseClient, companyId: string, unitId: string, now: number = Date.now()): Promise<LoadoutPlan | null> {
  const plan = await getTruckPlan(db, companyId, unitId);
  return plan && planTiming(plan, now) === "now" ? plan : null;
}

/**
 * The truck rolled (its newest load-out went READY, or rolled on a manager's
 * override) after sinceIso: when, and who loaded it out. Null if not.
 */
export async function rolledSince(db: SupabaseClient, companyId: string, unitId: string, sinceIso: string): Promise<{ at: string; by: string | null } | null> {
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) return null;
  const { data } = await db.from("saas_loadout_scans").select("id, finished_at, verdict, scanned_by")
    .eq("company_id", companyId).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle();
  const last = data as { id: string; finished_at: string; verdict: string | null; scanned_by: string | null } | null;
  if (!last) return null;
  let at: string | null = last.verdict === "ready" ? last.finished_at : null;
  if (!at) {
    const { data: ov } = await db.from("saas_loadout_overrides").select("created_at").eq("company_id", companyId).eq("loadout_id", last.id).maybeSingle();
    at = (ov as { created_at: string } | null)?.created_at ?? null;
  }
  return at && Date.parse(at) > since ? { at, by: last.scanned_by } : null;
}

/** Extra lines as typed: trimmed, 1 to 99 each, at most 30. */
export function cleanPlanLines(lines: unknown[]): { label: string; qty: number }[] {
  return (Array.isArray(lines) ? lines : []).slice(0, 30)
    .map((l) => l as { label?: unknown; qty?: unknown })
    .map((l) => ({ label: String(l.label ?? "").trim().slice(0, 80), qty: Math.min(99, Math.max(1, Math.floor(Number(l.qty)) || 1)) }))
    .filter((l) => l.label);
}

/** "Flowback package, 2in 1502 plug valve × 2" */
export function planSummary(plan: Pick<LoadoutPlan, "packageIds" | "lines">, packageNames: Map<string, string>): string {
  const parts = [
    ...plan.packageIds.map((id) => packageNames.get(id)).filter((n): n is string => Boolean(n)),
    ...plan.lines.map((l) => `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`),
  ];
  return parts.join(", ") || "just the truck's kit";
}
