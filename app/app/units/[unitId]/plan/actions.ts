"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { cleanPlanLines, getOpenPlan, planSummary } from "@/lib/saas/plans";

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "a manager";

/**
 * A manager plans a truck's next job: which packages, any extra pieces, and
 * a short note for the hand. One open plan per truck; saving again replaces
 * it. The load-out is checked against it on the server, whatever the phone
 * sends.
 */
export async function savePlan(input: { unitId: string; packageIds: string[]; lines: { label: string; qty: number }[]; note: string }): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireBillableCompany();
  if (company.role !== "owner" && company.role !== "admin") return { ok: false, error: "Only a manager can plan a load-out." };
  const db = await saasDb();
  const [{ data: unitRow }, { data: pkgRows }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("id", input.unitId).eq("company_id", company.id).maybeSingle(),
    db.from("saas_packages").select("id, name").eq("company_id", company.id).is("unit_id", null),
  ]);
  const unit = unitRow as { id: string; name: string } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };
  const pkgs = (pkgRows ?? []) as { id: string; name: string }[];
  const packageIds = [...new Set((input.packageIds ?? []).filter((id) => pkgs.some((x) => x.id === id)))].slice(0, 10);
  const lines = cleanPlanLines(input.lines ?? []);
  const note = String(input.note ?? "").trim().slice(0, 120) || null;
  if (!packageIds.length && !lines.length && !note) return clearPlan(unit.id);

  const actor = actorOf(user);
  const row = { package_ids: packageIds, lines, note, planned_by: actor, planned_by_user: user.id, created_at: new Date().toISOString() };
  const open = await getOpenPlan(db, company.id, unit.id);
  const { error } = open
    ? await db.from("saas_loadout_plans").update(row).eq("id", open.id).eq("company_id", company.id)
    : await db.from("saas_loadout_plans").insert({ company_id: company.id, unit_id: unit.id, ...row });
  if (error) return { ok: false, error: "Couldn't save the plan. Try again." };

  const what = planSummary({ packageIds, lines }, new Map(pkgs.map((x) => [x.id, x.name])));
  void logEvent({ companyId: company.id, kind: "plan_set", unitId: unit.id, actor,
    message: `${actor} planned ${unit.name}'s next job: ${what}${note ? `. "${note}"` : ""}` });
  revalidatePath("/app");
  revalidatePath(`/app/units/${unit.id}`);
  revalidatePath(`/app/units/${unit.id}/scan`);
  return { ok: true };
}

/** Take the plan off a truck: its next load-out goes back to the kit plus whatever the hand picks. */
export async function clearPlan(unitId: string): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireBillableCompany();
  if (company.role !== "owner" && company.role !== "admin") return { ok: false, error: "Only a manager can change a plan." };
  const db = await saasDb();
  const { data: unitRow } = await db.from("saas_units").select("id, name").eq("id", unitId).eq("company_id", company.id).maybeSingle();
  const unit = unitRow as { id: string; name: string } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };
  const { error, count } = await db.from("saas_loadout_plans").delete({ count: "exact" })
    .eq("company_id", company.id).eq("unit_id", unit.id).is("used_at", null);
  if (error) return { ok: false, error: "Couldn't clear the plan. Try again." };
  if (count) {
    const actor = actorOf(user);
    void logEvent({ companyId: company.id, kind: "plan_set", unitId: unit.id, actor, message: `${actor} cleared the plan for ${unit.name}` });
  }
  revalidatePath("/app");
  revalidatePath(`/app/units/${unit.id}`);
  revalidatePath(`/app/units/${unit.id}/scan`);
  return { ok: true };
}
