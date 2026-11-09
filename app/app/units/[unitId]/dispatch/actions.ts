"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { localToday } from "@/lib/saas/status";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { computeDispatchCheck, truckLoadout } from "@/lib/saas/dispatch-check";
import { plainDate } from "@/lib/saas/judge";
import { notifyEvent, logEvent } from "@/lib/saas/notify";
import { rollLoadoutAnyway } from "../../../loadouts/[id]/actions";

/**
 * Record a readiness check. The verdict and every line are RECOMPUTED
 * server-side at record time — nothing from the client is trusted, there is
 * no override, and a Not-ready result records as exactly that. A check with
 * nothing configured refuses to record (an empty pass is not a pass).
 * Records are append-only at the database level.
 */
export async function recordDispatchCheck(fd: FormData): Promise<void> {
  const { company, user } = await requireBillableCompany();
  const unitId = String(fd.get("unit_id") ?? "");
  if (!unitId) return;
  const jobDate = String(fd.get("job_date") ?? "") || null;
  const db = await saasDb();

  // Recompute server-side against the SAME job date the button carried — the
  // client's shown verdict is never trusted.
  const comp = await computeDispatchCheck(db, company.id, unitId, jobDate);
  if (!comp) return;
  if (comp.verdict === "not_setup") return; // nothing to check — refuse a fake trail

  // Idempotence: one record per (unit, job date, verdict) per day. The old
  // 30-second guard let a re-tap a minute later write a second identical row,
  // and one truck then counted twice in "misses caught". Re-running after a
  // FIX still records (the verdict changed); re-tapping the same result lands
  // on the existing record.
  const dayStart = `${localToday()}T00:00:00Z`;
  const { data: recent } = await db
    .from("saas_dispatch_checks")
    .select("id, status")
    .eq("unit_id", unitId).eq("type", "checkout").eq("job_date", comp.jobDate)
    .gte("started_at", dayStart)
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (recent && (recent as { status: string }).status === comp.verdict) {
    redirect(`/app/records/${(recent as { id: string }).id}`);
  }

  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;

  // Written by the server, not the caller's session: the database only
  // accepts check records from here (migration 0009), so nobody can post a
  // "ready" record from a phone. The verdict above was computed server-side
  // under the caller's own RLS, and every id is this company's.
  const writer = saasAdmin();
  if (!writer) throw new Error("Something's down on our end. Try again in a minute.");
  const { data: check, error } = await writer
    .from("saas_dispatch_checks")
    .insert({
      company_id: company.id,
      unit_id: unitId,
      type: "checkout",
      performed_by: user.id,
      performed_by_name: actor,
      status: comp.verdict, // 'ready' | 'not_ready' — computed, never chosen
      job_date: comp.jobDate,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const checkId = (check as { id: string }).id;

  if (comp.lines.length) {
    await writer.from("saas_dispatch_check_items").insert(
      comp.lines.map((l) => ({
        check_id: checkId,
        company_id: company.id,
        source_type: l.source_type,
        source_id: l.source_id,
        label: l.label,
        result: l.result,
        note: l.detail ?? null,
      })),
    );
  }

  const forJob = comp.isFutureJob ? ` (for the ${plainDate(comp.jobDate)} job)` : "";
  const failLine = comp.failures.slice(0, 3).join("; ");
  if (comp.verdict === "ready") {
    void logEvent({ companyId: company.id, kind: "check_ready", unitId, actor, message: `${comp.unitName} checked READY${forJob}` });
  } else {
    void logEvent({ companyId: company.id, kind: "check_not_ready", unitId, actor, message: `${comp.unitName} checked NOT READY${forJob}. ${failLine}` });
    void logEvent({ companyId: company.id, kind: "miss_caught", unitId, actor, message: `Caught before rollout on ${comp.unitName}${forJob}. ${failLine}` });
    void notifyEvent({ companyId: company.id, companyName: company.name, yardId: comp.yardId, message: `${comp.unitName} checked NOT READY${forJob}. ${failLine}` });
  }

  revalidatePath(`/app/units/${unitId}`);
  revalidatePath(`/app/units/${unitId}/dispatch`);
  revalidatePath("/app");
  // The tap's feedback IS the record: land on the immutable check page.
  // Tapping and seeing nothing made testers tap again — and again.
  redirect(`/app/records/${checkId}`);
}

/**
 * A manager's override from the Paper check. A truck rolls only from a
 * load-out, so this rolls the truck's NOT READY load-out from this shift:
 * the same override the load-out record makes, with all the same checks
 * (one row next to that load-out, the iron on it out on the job, the plan
 * used up, one alert). The board, check-in, the morning email and both proof
 * links then tell one story. With no such load-out there's nothing to roll,
 * and nothing is recorded: the page says to scan the truck first.
 */
export async function rollAnyway(fd: FormData): Promise<void> {
  const { company } = await requireBillableCompany();
  if (company.role !== "owner" && company.role !== "admin") {
    throw new Error("Only a manager can roll a NOT READY truck.");
  }
  const unitId = String(fd.get("unit_id") ?? "");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (!unitId) return;
  if (reason.length < 10) throw new Error("Write the reason in a full sentence. It goes on the record.");
  const db = await saasDb();

  // Read under the caller's company: another company's truck has no load-out here.
  const lo = await truckLoadout(db, company.id, unitId);
  // The page named one load-out, and only that one rolls. If the truck moved
  // on since (a newer load-out, a check-in, someone else rolled it), or the
  // form named none (a tab opened before this change), nothing rolls.
  const shown = String(fd.get("loadout_id") ?? "");
  if (!lo || !lo.rollable || shown !== lo.id) redirect(`/app/units/${encodeURIComponent(unitId)}/dispatch?roll=none`);

  const roll = new FormData();
  roll.set("loadout_id", lo.id);
  roll.set("reason", reason);
  revalidatePath(`/app/units/${unitId}`);
  revalidatePath(`/app/units/${unitId}/dispatch`);
  await rollLoadoutAnyway(roll); // lands on the load-out record
}
