"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

// ── YARD ──
export async function updateYard(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const location = str(fd, "location") || null;
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_yards").update({ name, location }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/yards/${id}`);
}
export async function deleteYard(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const db = await saasDb();
  await db.from("saas_yards").delete().eq("id", id).eq("company_id", company.id);
  redirect("/app/yards");
}

// ── UNIT ──
export async function updateUnit(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const type = str(fd, "type") || "other";
  const identifier = str(fd, "identifier") || null;
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_units").update({ name, type, identifier }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/units/${id}`);
}
export async function deleteUnit(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const yard_id = str(fd, "yard_id");
  const db = await saasDb();
  await db.from("saas_units").delete().eq("id", id).eq("company_id", company.id);
  redirect(yard_id ? `/app/yards/${yard_id}` : "/app/yards");
}

// ── ASSET ──
export async function updateAsset(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const category = str(fd, "category") || "other";
  const identifier = str(fd, "identifier") || null;
  const status = str(fd, "status") || "in_service";
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_assets").update({ name, category, identifier, status }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/assets/${id}`);
}
export async function deleteAsset(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const unit_id = str(fd, "unit_id");
  const db = await saasDb();
  await db.from("saas_assets").delete().eq("id", id).eq("company_id", company.id);
  redirect(unit_id ? `/app/units/${unit_id}` : "/app/yards");
}

// ── COMPLIANCE ITEM ──
export async function updateComplianceItem(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const title = str(fd, "title");
  const kind = str(fd, "kind") || "cert";
  const issued_date = str(fd, "issued_date") || null;
  const expiration_date = str(fd, "expiration_date") || null;
  const redirectPath = str(fd, "redirect_path");
  if (!id || !title) return;
  const db = await saasDb();
  const { error } = await db.from("saas_compliance_items")
    .update({ title, kind, issued_date, expiration_date }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  if (redirectPath) revalidatePath(redirectPath);
}
export async function deleteComplianceItem(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const redirectPath = str(fd, "redirect_path");
  const db = await saasDb();
  await db.from("saas_compliance_items").delete().eq("id", id).eq("company_id", company.id);
  if (redirectPath) revalidatePath(redirectPath);
}
