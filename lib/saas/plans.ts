import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A truck's next job, planned by a manager: the packages it needs, any extra
 * pieces, and a short note for the hand. The hand at the truck can add to the
 * list but can't take anything off, and the server checks the load-out
 * against the plan no matter what the phone sends. Used up when the truck
 * rolls (READY, or a manager's override).
 */
export interface LoadoutPlan {
  id: string;
  unitId: string;
  packageIds: string[];
  lines: { label: string; qty: number }[];
  note: string | null;
  by: string | null;
  at: string;
}

type Row = { id: string; unit_id: string; package_ids: string[] | null; lines: { label: string; qty: number }[] | null; note: string | null; planned_by: string | null; created_at: string };
const PLAN_COLS = "id, unit_id, package_ids, lines, note, planned_by, created_at";
const toPlan = (r: Row): LoadoutPlan => ({
  id: r.id, unitId: r.unit_id, packageIds: r.package_ids ?? [], lines: cleanPlanLines(r.lines ?? []),
  note: r.note, by: r.planned_by, at: r.created_at,
});

/** Every open plan in the company, by truck. */
export async function getOpenPlans(db: SupabaseClient, companyId: string): Promise<Map<string, LoadoutPlan>> {
  const { data } = await db.from("saas_loadout_plans").select(PLAN_COLS).eq("company_id", companyId).is("used_at", null);
  return new Map(((data ?? []) as Row[]).map((r) => [r.unit_id, toPlan(r)]));
}

/** This truck's open plan, if a manager set one. */
export async function getOpenPlan(db: SupabaseClient, companyId: string, unitId: string): Promise<LoadoutPlan | null> {
  const { data } = await db.from("saas_loadout_plans").select(PLAN_COLS).eq("company_id", companyId).eq("unit_id", unitId).is("used_at", null).maybeSingle();
  return data ? toPlan(data as Row) : null;
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
