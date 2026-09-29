"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { isRecentDuplicate } from "@/lib/saas/dedupe";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type Db = Awaited<ReturnType<typeof saasDb>>;

/**
 * "yard:<id>" or "unit:<id>" from the Where picker → the columns to write.
 * On a truck, the iron is also in that truck's yard. Null when the target
 * isn't this company's.
 */
async function resolveWhere(db: Db, companyId: string, where: string): Promise<{ yard_id: string | null; unit_id: string | null } | null> {
  const [kind, id] = where.split(":");
  if (!id) return { yard_id: null, unit_id: null };
  if (kind === "unit") {
    const { data } = await db.from("saas_units").select("id, yard_id").eq("id", id).eq("company_id", companyId).maybeSingle();
    const u = data as { id: string; yard_id: string } | null;
    return u ? { yard_id: u.yard_id, unit_id: u.id } : null;
  }
  if (kind === "yard") {
    const { data } = await db.from("saas_yards").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
    return data ? { yard_id: id, unit_id: null } : null;
  }
  return null;
}

/** Add one piece from the Equipment screen, then open it to add its paper. */
export async function addEquipment(fd: FormData) {
  const { company } = await requireBillableCompany();
  const name = str(fd, "name");
  const category = str(fd, "category") || "other";
  const identifier = str(fd, "identifier") || null;
  if (!name) return;
  const db = await saasDb();
  const where = await resolveWhere(db, company.id, str(fd, "where"));
  if (!where) return;
  if (await isRecentDuplicate(db, "saas_assets", { company_id: company.id, name, unit_id: where.unit_id })) {
    revalidatePath("/app");
    return; // double-tap echo
  }
  const { data, error } = await db.from("saas_assets")
    .insert({ company_id: company.id, name, category, identifier, ...where })
    .select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/app");
  redirect(`/app/assets/${(data as { id: string }).id}`);
}

/**
 * Move a piece to a yard or a truck, with an optional note ("rack 2").
 * Anyone on the crew can move iron. The database writes the history row
 * itself (migration 0010), so a move can't happen without a record.
 */
export async function moveEquipment(fd: FormData) {
  const { company, user } = await requireBillableCompany();
  const id = str(fd, "id");
  const note = str(fd, "note").slice(0, 120);
  if (!id) return;
  const db = await saasDb();
  const where = await resolveWhere(db, company.id, str(fd, "where"));
  if (!where) return;
  const by = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
  const { error } = await db.from("saas_assets").update({
    ...where,
    last_seen_where: note || null,
    last_seen_by: by,
    last_seen_at: new Date().toISOString(),
  }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/assets/${id}`);
  revalidatePath("/app");
}
