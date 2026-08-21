"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { clearAlertLog } from "@/lib/saas/alert-log";
import { logEvent } from "@/lib/saas/notify";
import { isRecentDuplicate } from "@/lib/saas/dedupe";
import { ownsParent, ownsStoragePath } from "@/lib/saas/own";
import { normalizeDateField } from "@/lib/saas/import-parse";

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

/** Camera-first renewal: bump the dates and (optionally) attach the new proof. */
export async function renewComplianceItem(args: {
  itemId: string;
  expiration_date: string;
  issued_date?: string | null;
  storage_path?: string | null;
  content_type?: string | null;
  redirectPath?: string;
}) {
  const { company, user } = await requireCompany();
  const db = await saasDb();

  const expiration = normalizeDateField(args.expiration_date, "New expiration date");
  if (!expiration) throw new Error("New expiration date: set the date off the new cert.");
  // Fingerprints: read the OLD date first so the feed can show old → new.
  // A renewal with no proof photo wears the flag until proof lands — the
  // answer to "what stops somebody just typing a new date before a job?"
  const { data: beforeRow } = await db.from("saas_compliance_items")
    .select("title, expiration_date").eq("id", args.itemId).eq("company_id", company.id).maybeSingle();
  const before = beforeRow as { title: string; expiration_date: string | null } | null;
  const hasProof = Boolean(args.storage_path && ownsStoragePath(args.storage_path, company.id));
  const { error: upErr } = await db
    .from("saas_compliance_items")
    .update({
      expiration_date: expiration,
      issued_date: normalizeDateField(args.issued_date, "Issued") ?? new Date().toISOString().slice(0, 10),
      renewed_without_proof: !hasProof,
    })
    .eq("id", args.itemId)
    .eq("company_id", company.id);
  if (upErr) throw new Error(upErr.message);

  if (args.storage_path && ownsStoragePath(args.storage_path, company.id)) {
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
  await clearAlertLog(company.id, args.itemId);

  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
  void logEvent({
    companyId: company.id,
    kind: "renewed",
    actor,
    message: `${before?.title ?? "Item"} renewed: ${before?.expiration_date ?? "no date"} → ${expiration}${actor ? `, by ${actor}` : ""}${hasProof ? " — proof photo attached" : " — NO PROOF ATTACHED"}`,
  });

  if (args.redirectPath) revalidatePath(args.redirectPath);
}

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
