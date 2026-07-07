"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { isRecentDuplicate } from "@/lib/saas/dedupe";

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
  if (await isRecentDuplicate(db, "saas_compliance_items", { company_id: company.id, parent_id, title, kind })) {
    if (redirectPath) revalidatePath(redirectPath);
    return; // double-tap echo
  }
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

  // Renewed = a fresh cycle: clear its alert-log rows so the NEXT expiry
  // alerts again (the dedup is per-item, not per-cycle). Service role — the
  // alert log is cron-owned and has no member delete policy.
  const adminForLog = saasAdmin();
  if (adminForLog) {
    await adminForLog.from("saas_alerts_sent").delete().eq("company_id", company.id).eq("compliance_item_id", args.itemId);
  }

  const { data: itemRow } = await db.from("saas_compliance_items").select("title").eq("id", args.itemId).maybeSingle();
  void logEvent({
    companyId: company.id,
    kind: "renewed",
    message: `${(itemRow as { title: string } | null)?.title ?? "Item"} renewed — good to ${args.expiration_date}`,
  });

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
  if (await isRecentDuplicate(db, "saas_assets", { company_id: company.id, name, unit_id })) {
    if (redirectPath) revalidatePath(redirectPath);
    return; // double-tap echo
  }
  const { error } = await db.from("saas_assets").insert({
    company_id: company.id, yard_id, unit_id, name, category, identifier,
  });
  if (error) throw new Error(error.message);
  if (redirectPath) revalidatePath(redirectPath);
}
