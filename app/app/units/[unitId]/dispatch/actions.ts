"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { computeDispatchCheck } from "@/lib/saas/dispatch-check";
import { notifyEvent, logEvent } from "@/lib/saas/notify";

/**
 * Record a pre-dispatch check. The verdict and every line are RECOMPUTED
 * server-side at record time — nothing from the client is trusted, there is
 * no override, and a Not-ready result records as exactly that. A check with
 * nothing configured refuses to record (an empty pass is not a pass).
 * Records are append-only at the database level.
 */
export async function recordDispatchCheck(fd: FormData): Promise<void> {
  const { company, user } = await requireCompany();
  const unitId = String(fd.get("unit_id") ?? "");
  if (!unitId) return;
  const jobDate = String(fd.get("job_date") ?? "") || null;
  const db = await saasDb();

  // Recompute server-side against the SAME job date the button carried — the
  // client's shown verdict is never trusted.
  const comp = await computeDispatchCheck(db, company.id, unitId, jobDate);
  if (!comp) return;
  if (comp.verdict === "not_setup") return; // nothing to check — refuse a fake trail

  // Double-tap guard: an identical check recorded seconds ago means the button
  // fired twice, not that the yard ran two checks. One tap = one record.
  const { data: recent } = await db
    .from("saas_dispatch_checks")
    .select("id, status, started_at")
    .eq("unit_id", unitId).eq("type", "checkout")
    .gte("started_at", new Date(Date.now() - 30_000).toISOString())
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (recent && (recent as { status: string }).status === comp.verdict) {
    revalidatePath(`/app/units/${unitId}/dispatch`);
    return;
  }

  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null;

  const { data: check, error } = await db
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
    await db.from("saas_dispatch_check_items").insert(
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

  const forJob = comp.isFutureJob ? ` (for the ${comp.jobDate} job)` : "";
  const failLine = comp.failures.slice(0, 3).join("; ");
  if (comp.verdict === "ready") {
    void logEvent({ companyId: company.id, kind: "check_ready", unitId, actor, message: `${comp.unitName} passed its pre-dispatch check${forJob}` });
  } else {
    void logEvent({ companyId: company.id, kind: "check_not_ready", unitId, actor, message: `${comp.unitName} NOT ready${forJob} — ${failLine}` });
    void logEvent({ companyId: company.id, kind: "miss_caught", unitId, actor, message: `Caught before rollout on ${comp.unitName}${forJob}: ${failLine}` });
    void notifyEvent({ companyId: company.id, companyName: company.name, yardId: comp.yardId, message: `${comp.unitName} NOT ready${forJob} — ${failLine}` });
  }

  revalidatePath(`/app/units/${unitId}`);
  revalidatePath(`/app/units/${unitId}/dispatch`);
  revalidatePath("/app");
}
