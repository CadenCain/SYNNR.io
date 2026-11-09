"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { cleanPlanLines, getTruckPlan, planSummary, rolledSince } from "@/lib/saas/plans";
import { fmtWhen } from "@/lib/saas/format";

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "a manager";

/**
 * A manager plans a truck's next job: which packages, any extra pieces, and
 * a short note for the hand. One open plan per truck; saving again replaces
 * it. The load-out is checked against it on the server, whatever the phone
 * sends. seenAt: when the manager opened the page. If the truck rolled since,
 * the save stops once to say so (the plan would be for its next job), and
 * hands back a new seenAt so tapping Save again keeps it.
 */
export async function savePlan(input: { unitId: string; packageIds: string[]; lines: { label: string; qty: number }[]; note: string; job?: string; leavesAt?: string | null; seenAt?: string | null }): Promise<{ ok: boolean; error?: string; seenAt?: string }> {
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
  const job = String(input.job ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null;
  // When it leaves: from a day ago to a month out, or not set.
  const leavesMs = input.leavesAt ? Date.parse(input.leavesAt) : NaN;
  const leaves_at = Number.isFinite(leavesMs) && leavesMs > Date.now() - 864e5 && leavesMs < Date.now() + 31 * 864e5 ? new Date(leavesMs).toISOString() : null;
  if (!packageIds.length && !lines.length && !note && !leaves_at && !job) return clearPlan(unit.id);

  // The truck rolled while the manager had the page open: this plan isn't for
  // the job that just left, it's for the next one. Say so once.
  const rolled = input.seenAt ? await rolledSince(db, company.id, unit.id, String(input.seenAt)) : null;
  if (rolled) {
    return { ok: false, seenAt: new Date().toISOString(),
      error: `${unit.name} already rolled, loaded out${rolled.by ? ` by ${rolled.by}` : ""} ${fmtWhen(rolled.at)}. This plan would be for its next job. Check when that job leaves, then tap Save the plan again.` };
  }

  const actor = actorOf(user);
  const row = { package_ids: packageIds, lines, note, job, leaves_at, planned_by: actor, planned_by_user: user.id, created_at: new Date().toISOString() };
  // Whenever it leaves (one open plan per truck): saving again replaces it.
  const open = await getTruckPlan(db, company.id, unit.id);
  const { error } = open
    ? await db.from("saas_loadout_plans").update(row).eq("id", open.id).eq("company_id", company.id)
    : await db.from("saas_loadout_plans").insert({ company_id: company.id, unit_id: unit.id, ...row });
  if (error) return { ok: false, error: "Couldn't save the plan. Try again." };

  const what = planSummary({ packageIds, lines }, new Map(pkgs.map((x) => [x.id, x.name])));
  void logEvent({ companyId: company.id, kind: "plan_set", unitId: unit.id, actor,
    message: `${actor} planned ${unit.name}'s next job: ${what}${note ? `. "${note}"` : ""}${leaves_at ? `. Leaves ${new Date(leaves_at).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}` });
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

/**
 * The job moved to another truck (this one's blocked or down): the plan goes
 * with it, as saved, and this truck goes back to its kit. A truck that already
 * has a plan of its own isn't overwritten: clear that one first.
 */
export async function movePlan(input: { unitId: string; toUnitId: string }): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireBillableCompany();
  if (company.role !== "owner" && company.role !== "admin") return { ok: false, error: "Only a manager can change a plan." };
  if (!input.toUnitId || input.toUnitId === input.unitId) return { ok: false, error: "Pick the truck the job is moving to." };
  const db = await saasDb();
  const { data: unitRows } = await db.from("saas_units").select("id, name").eq("company_id", company.id).in("id", [String(input.unitId), String(input.toUnitId)]);
  const trucks = (unitRows ?? []) as { id: string; name: string }[];
  const from = trucks.find((t) => t.id === input.unitId);
  const to = trucks.find((t) => t.id === input.toUnitId);
  if (!from || !to) return { ok: false, error: "That truck isn't in your account." };
  const [plan, there] = await Promise.all([getTruckPlan(db, company.id, from.id), getTruckPlan(db, company.id, to.id)]);
  if (!plan) return { ok: false, error: `${from.name} has no plan to move.` };
  const taken = `${to.name} already has a plan. Clear that one first, or pick another truck.`;
  if (there) return { ok: false, error: taken };
  // On the new truck from now: only its load-outs from here on count for it.
  const { error } = await db.from("saas_loadout_plans").update({ unit_id: to.id, created_at: new Date().toISOString() })
    .eq("id", plan.id).eq("company_id", company.id).eq("unit_id", from.id).is("used_at", null);
  if (error) return { ok: false, error: error.code === "23505" ? taken : "Couldn't move the plan. Try again." };

  const actor = actorOf(user);
  void logEvent({ companyId: company.id, kind: "plan_set", unitId: to.id, actor, message: `${actor} moved the plan from ${from.name} to ${to.name}` });
  revalidatePath("/app");
  for (const id of [from.id, to.id]) {
    revalidatePath(`/app/units/${id}`);
    revalidatePath(`/app/units/${id}/scan`);
  }
  return { ok: true };
}
