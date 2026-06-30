"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

export async function addComplianceItem(formData: FormData) {
  const { company } = await requireCompany();
  const parent_type = String(formData.get("parent_type") ?? "unit");
  const parent_id = String(formData.get("parent_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "cert");
  const expiration_date = String(formData.get("expiration_date") ?? "").trim() || null;
  const issued_date = String(formData.get("issued_date") ?? "").trim() || null;
  const responsible_person = String(formData.get("responsible_person") ?? "").trim() || null;
  const redirectPath = String(formData.get("redirect_path") ?? "");
  if (!parent_id || !title) return;

  const db = await saasDb();
  const { error } = await db.from("saas_compliance_items").insert({
    company_id: company.id, parent_type, parent_id, kind, title,
    issued_date, expiration_date, responsible_person,
  });
  if (error) throw new Error(error.message);
  if (redirectPath) revalidatePath(redirectPath);
}

/** Camera-first renewal: bump the dates and (optionally) attach the new proof. */
export async function renewComplianceItem(args: {
  itemId: string;
  expiration_date: string;
  issued_date?: string | null;
  storage_path?: string | null;
  content_type?: string | null;
  redirectPath?: string;
}) {
  const { company } = await requireCompany();
  const db = await saasDb();

  const { error: upErr } = await db
    .from("saas_compliance_items")
    .update({
      expiration_date: args.expiration_date,
      issued_date: args.issued_date ?? new Date().toISOString().slice(0, 10),
    })
    .eq("id", args.itemId)
    .eq("company_id", company.id);
  if (upErr) throw new Error(upErr.message);

  if (args.storage_path) {
    await db.from("saas_attachments").insert({
      company_id: company.id,
      entity_type: "compliance_item",
      entity_id: args.itemId,
      storage_path: args.storage_path,
      content_type: args.content_type ?? null,
      label: "proof",
    });
  }
  if (args.redirectPath) revalidatePath(args.redirectPath);
}

export async function addAsset(formData: FormData) {
  const { company } = await requireCompany();
  const yard_id = String(formData.get("yard_id") ?? "") || null;
  const unit_id = String(formData.get("unit_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const identifier = String(formData.get("identifier") ?? "").trim() || null;
  const redirectPath = String(formData.get("redirect_path") ?? "");
  if (!name) return;

  const db = await saasDb();
  const { error } = await db.from("saas_assets").insert({
    company_id: company.id, yard_id, unit_id, name, category, identifier,
  });
  if (error) throw new Error(error.message);
  if (redirectPath) revalidatePath(redirectPath);
}
