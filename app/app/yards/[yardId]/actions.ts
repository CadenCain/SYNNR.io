"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { isYardZone } from "@/lib/saas/format";
import { updateYard } from "@/app/app/_actions";

/**
 * Save the yard: its name and place (updateYard), then its clock. A yard in
 * Hobbs, NM is on Mountain time, and the operator's proof link shows its
 * times in that zone. Managers only, this company's yard only, and only a
 * zone from the list (YARD_ZONES).
 */
export async function saveYard(formData: FormData) {
  await updateYard(formData);
  const id = String(formData.get("id") ?? "");
  const tz = String(formData.get("time_zone") ?? "");
  if (!id || !isYardZone(tz) || tz === String(formData.get("time_zone_was") ?? "")) return;
  const { company } = await requireBillableCompany();
  assertCan(company, "create_yard");
  const db = await saasDb();
  const { error } = await db.from("saas_yards").update({ time_zone: tz }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/yards/${id}`);
}
