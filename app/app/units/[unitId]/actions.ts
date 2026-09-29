"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { clearAlertLog } from "@/lib/saas/alert-log";
import { logEvent } from "@/lib/saas/notify";
import { isRecentDuplicate } from "@/lib/saas/dedupe";
import { ownsParent, ownsStoragePath } from "@/lib/saas/own";
import { normalizeDateField } from "@/lib/saas/import-parse";
import { canPerform } from "@/lib/saas/entitlements";

export async function addComplianceItem(formData: FormData) {
  const { company } = await requireBillableCompany();
  const parent_type = String(formData.get("parent_type") ?? "unit");
  const parent_id = String(formData.get("parent_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "cert");
  // Impossible dates die here with the field named — past dates are LEGAL
  // (expired paper is the product's whole subject).
  const expiration_date = normalizeDateField(String(formData.get("expiration_date") ?? ""), "Expires");
  const issued_date = normalizeDateField(String(formData.get("issued_date") ?? ""), "Issued");
  const responsible_person = String(formData.get("responsible_person") ?? "").trim() || null;
  const redirectPath = String(formData.get("redirect_path") ?? "");
  if (!parent_id || !title) return;
  // Typed-in dates are a manager's (setup from the binder). A hand adds the
  // item with no date and uploads the cert photo.
  if ((expiration_date || issued_date) && !canPerform(company.role, "edit_records")) {
    throw new Error("Only a manager can type in a date. Add it with a photo of the cert instead.");
  }

  const db = await saasDb();
  // parent_type and parent_id come off the wire — prove the parent is ours
  // before hanging paper on it.
  if (!(await ownsParent(db, company.id, parent_type, parent_id))) return;
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

// Renewing moved to the photo upload (app/api/saas/certs/upload): the old
// camera-renew action let anyone type a new date with the photo optional.

export async function addAsset(formData: FormData) {
  const { company } = await requireBillableCompany();
  const yard_id = String(formData.get("yard_id") ?? "") || null;
  const unit_id = String(formData.get("unit_id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other");
  const identifier = String(formData.get("identifier") ?? "").trim() || null;
  const redirectPath = String(formData.get("redirect_path") ?? "");
  if (!name) return;

  const db = await saasDb();
  if (unit_id && !(await ownsParent(db, company.id, "unit", unit_id))) return;
  if (yard_id) {
    const { data: y } = await db.from("saas_yards").select("id").eq("id", yard_id).eq("company_id", company.id).maybeSingle();
    if (!y) return;
  }
  if (await isRecentDuplicate(db, "saas_assets", { company_id: company.id, name, unit_id })) {
    if (redirectPath) revalidatePath(redirectPath);
    return; // double-tap echo
  }
  const { data: created, error } = await db.from("saas_assets").insert({
    company_id: company.id, yard_id, unit_id, name, category, identifier,
  }).select("id").single();
  if (error) throw new Error(error.message);

  // Two photos at intake: the iron itself and its paperwork. Uploads ride the
  // session client, so storage RLS (company-prefixed paths) still applies.
  // Neither is required — the field rule everywhere in this app is "never
  // block the entry, flag the gap" — the asset shows amber until both exist.
  const assetId = (created as { id: string }).id;
  const shots: { field: string; label: "photo" | "paperwork" }[] = [
    { field: "photo", label: "photo" },
    { field: "paperwork", label: "paperwork" },
  ];
  for (const s of shots) {
    const f = formData.get(s.field);
    if (!(f instanceof File) || f.size === 0) continue;
    if (!f.type.startsWith("image/") || f.size > 15 * 1024 * 1024) continue; // wrong kind/huge: skip, stays flagged
    const safe = (f.name || `${s.label}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${company.id}/asset/${assetId}/${Date.now()}-${s.label}-${safe}`;
    const { error: upErr } = await db.storage.from("proofs").upload(path, f, { upsert: false, contentType: f.type });
    if (upErr) continue;
    await db.from("saas_attachments").insert({
      company_id: company.id, entity_type: "asset", entity_id: assetId,
      storage_path: path, content_type: f.type || null, label: s.label,
    });
    if (s.label === "photo") {
      await db.from("saas_assets").update({ primary_photo_path: path })
        .eq("id", assetId).eq("company_id", company.id);
    }
  }

  if (redirectPath) revalidatePath(redirectPath);
}
