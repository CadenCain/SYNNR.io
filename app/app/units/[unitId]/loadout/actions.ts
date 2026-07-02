"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/**
 * Loadout template editing (spec P1.2). Templates resolve
 * unit-specific → company type default → global seed; editing a seeded
 * template copies it to a unit-specific one first (copy-on-edit), so the
 * global starters stay pristine for everyone else.
 */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Ensure this unit has its own editable template; returns its id. */
async function ensureOwnTemplate(unitId: string): Promise<{ templateId?: string; error?: string }> {
  const { company } = await requireCompany();
  const db = await saasDb();

  const { data: unit } = await db.from("saas_units").select("id, name, type").eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (!unit) return { error: "unit not found" };
  const u = unit as { id: string; name: string; type: string };

  const { data: tpls } = await db
    .from("saas_loadout_templates").select("id, company_id, unit_id, unit_type")
    .or(`unit_id.eq.${unitId},unit_type.eq.${u.type}`);
  type Tpl = { id: string; company_id: string | null; unit_id: string | null; unit_type: string | null };
  const list = (tpls ?? []) as Tpl[];
  const own = list.find((t) => t.unit_id === unitId);
  if (own) return { templateId: own.id };

  // Copy-on-edit from the resolved source (company type default → global seed).
  const source = list.find((t) => t.company_id === company.id && t.unit_type === u.type)
    ?? list.find((t) => t.company_id === null && t.unit_type === u.type)
    ?? null;

  const { data: created, error } = await db
    .from("saas_loadout_templates")
    .insert({ company_id: company.id, unit_id: unitId, name: `${u.name} loadout` })
    .select("id").single();
  if (error) return { error: error.message };
  const templateId = (created as { id: string }).id;

  if (source) {
    const { data: items } = await db
      .from("saas_loadout_items").select("label, category, required, sort")
      .eq("template_id", source.id).order("sort");
    const rows = ((items ?? []) as { label: string; category: string | null; required: boolean; sort: number }[])
      .map((i) => ({ ...i, template_id: templateId }));
    if (rows.length) await db.from("saas_loadout_items").insert(rows);
  }
  return { templateId };
}

export async function customizeTemplate(fd: FormData) {
  const unitId = str(fd, "unit_id");
  await ensureOwnTemplate(unitId);
  revalidatePath(`/app/units/${unitId}/loadout`);
}

export async function addLoadoutItem(fd: FormData) {
  const unitId = str(fd, "unit_id");
  const label = str(fd, "label");
  if (!label) return;
  const { templateId, error } = await ensureOwnTemplate(unitId);
  if (error || !templateId) return;
  const db = await saasDb();
  const { data: maxRow } = await db
    .from("saas_loadout_items").select("sort").eq("template_id", templateId)
    .order("sort", { ascending: false }).limit(1).maybeSingle();
  await db.from("saas_loadout_items").insert({
    template_id: templateId,
    label,
    category: str(fd, "category") || null,
    required: fd.get("required") !== null ? fd.get("required") === "on" : true,
    sort: ((maxRow as { sort: number } | null)?.sort ?? 0) + 1,
  });
  revalidatePath(`/app/units/${unitId}/loadout`);
}

export async function deleteLoadoutItem(fd: FormData) {
  await requireCompany(); // RLS enforces template ownership
  const unitId = str(fd, "unit_id");
  const id = str(fd, "id");
  const db = await saasDb();
  await db.from("saas_loadout_items").delete().eq("id", id);
  revalidatePath(`/app/units/${unitId}/loadout`);
}

export async function toggleLoadoutRequired(fd: FormData) {
  await requireCompany();
  const unitId = str(fd, "unit_id");
  const id = str(fd, "id");
  const required = str(fd, "required") === "true";
  const db = await saasDb();
  await db.from("saas_loadout_items").update({ required: !required }).eq("id", id);
  revalidatePath(`/app/units/${unitId}/loadout`);
}

export async function moveLoadoutItem(fd: FormData) {
  await requireCompany();
  const unitId = str(fd, "unit_id");
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const db = await saasDb();
  const { data: me } = await db.from("saas_loadout_items").select("id, template_id, sort").eq("id", id).maybeSingle();
  if (!me) return;
  const m = me as { id: string; template_id: string; sort: number };
  const { data: neighbor } = await db
    .from("saas_loadout_items").select("id, sort")
    .eq("template_id", m.template_id)
    .order("sort", { ascending: dir === 1 })
    .gt("sort", dir === 1 ? m.sort : -1)
    .lt("sort", dir === 1 ? Number.MAX_SAFE_INTEGER : m.sort)
    .limit(1).maybeSingle();
  if (!neighbor) return;
  const n = neighbor as { id: string; sort: number };
  await db.from("saas_loadout_items").update({ sort: n.sort }).eq("id", m.id);
  await db.from("saas_loadout_items").update({ sort: m.sort }).eq("id", n.id);
  revalidatePath(`/app/units/${unitId}/loadout`);
}
