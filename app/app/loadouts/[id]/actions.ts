"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { getLoadout, verdictOf, reasonsOf } from "@/lib/saas/loadout-record";

/**
 * Roll a NOT READY load-out anyway. Managers only, with a reason in a full
 * sentence. It goes on its own row next to the load-out (which itself never
 * changes), shows on the record and the proof link, and emails the office.
 */
export async function rollLoadoutAnyway(fd: FormData): Promise<void> {
  const { company, user } = await requireBillableCompany();
  if (company.role !== "owner" && company.role !== "admin") throw new Error("Only a manager can roll a NOT READY truck.");
  const id = String(fd.get("loadout_id") ?? "");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (!id) return;
  if (reason.length < 10) throw new Error("Write the reason in a full sentence. It goes on the record.");

  const db = await saasDb();
  const got = await getLoadout(db, { id, companyId: company.id });
  if (!got) redirect("/app/loadouts");
  if (verdictOf(got.rec) !== "not_ready" || got.override) redirect(`/app/loadouts/${id}`);

  const admin = saasAdmin();
  if (!admin) throw new Error("Something's down on our end. Try again in a minute.");
  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "A manager";
  const { error } = await admin.from("saas_loadout_overrides").insert({
    company_id: company.id, loadout_id: id, by_name: actor, by_user: user.id, reason,
  });
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);

  const why = reasonsOf(got.rec).slice(0, 3).join("; ");
  const message = `${got.rec.unit_name} rolled NOT READY on a manager override by ${actor}. Reason: "${reason}". Not ready because: ${why}`;
  void logEvent({ companyId: company.id, kind: "rolled_override", unitId: got.rec.unit_id, actor, message });
  void notifyEvent({ companyId: company.id, companyName: company.name, yardId: got.rec.yard_id, message });

  revalidatePath(`/app/loadouts/${id}`);
  revalidatePath("/app");
  redirect(`/app/loadouts/${id}`);
}
