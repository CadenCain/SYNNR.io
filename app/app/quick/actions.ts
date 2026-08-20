"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { canCreateBillable } from "@/lib/saas/billing-rules";
import { saasDb } from "@/lib/saas/db";
import { ownsParent, ownsStoragePath } from "@/lib/saas/own";

/**
 * Quick Action: put a truck/rig on the books from the phone.
 *
 * This exists because every other "add" path dead-ended for a shop on day one:
 * you can't add a cert without a unit, and you couldn't make a unit without
 * sitting down at a desktop. If there's no yard yet we make one, so a guy
 * standing in the yard can get his first truck in without any setup.
 */
export async function quickAddUnit(args: { name: string; type?: string }):
  Promise<{ ok: boolean; error?: string; unit?: { id: string; name: string; yardName: string } }> {
  const { company } = await requireCompany();
  if (!canCreateBillable(company.subscription_status)) return { ok: false, error: "Subscription needed to add to the yard — open Settings → Billing." };
  const name = args.name.trim();
  if (!name) return { ok: false, error: "Name the truck or rig." };

  const db = await saasDb();
  const { data: yardRow } = await db.from("saas_yards")
    .select("id, name").eq("company_id", company.id).order("created_at").limit(1).maybeSingle();
  let yard = yardRow as { id: string; name: string } | null;

  if (!yard) {
    const { data: made, error: yardErr } = await db.from("saas_yards")
      .insert({ company_id: company.id, name: "Main yard" }).select("id, name").single();
    if (yardErr) return { ok: false, error: yardErr.message };
    yard = made as { id: string; name: string };
  }

  const { data, error } = await db.from("saas_units")
    .insert({ company_id: company.id, yard_id: yard.id, name, type: args.type || "truck" })
    .select("id, name").single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/quick");
  revalidatePath("/app/yards");
  revalidatePath("/app");
  const u = data as { id: string; name: string };
  return { ok: true, unit: { id: u.id, name: u.name, yardName: yard.name } };
}

/** Quick Action: put a piece of gear on a truck from the phone. */
export async function quickAddAsset(args: { unit_id: string; name: string; category?: string; where?: string }):
  Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireCompany();
  if (!canCreateBillable(company.subscription_status)) return { ok: false, error: "Subscription needed to add to the yard — open Settings → Billing." };
  const name = args.name.trim();
  if (!args.unit_id || !name) return { ok: false, error: "Pick a truck and name the gear." };

  const db = await saasDb();
  if (!(await ownsParent(db, company.id, "unit", args.unit_id))) return { ok: false, error: "Pick one of your trucks." };
  const where = (args.where ?? "").trim();
  const { error } = await db.from("saas_assets").insert({
    company_id: company.id,
    unit_id: args.unit_id,
    name,
    category: args.category || "other",
    status: "in_service",
    // If they told us where it is while adding it, record that as the first
    // sighting rather than making them do a second trip through the app.
    ...(where ? {
      last_seen_where: where,
      last_seen_by: (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "someone",
      last_seen_at: new Date().toISOString(),
    } : {}),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/quick");
  revalidatePath("/app/yards");
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Quick Action: add a cert/inspection to a unit from the field, optionally
 * with a proof photo (already uploaded client-side to the proofs bucket).
 */
export async function quickAddCert(args: {
  unit_id: string;
  title: string;
  kind: string;
  expiration_date: string | null;
  storage_path?: string | null;
  content_type?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireCompany();
  if (!canCreateBillable(company.subscription_status)) return { ok: false, error: "Subscription needed to add to the yard — open Settings → Billing." };
  const title = args.title.trim();
  if (!args.unit_id || !title) return { ok: false, error: "Pick a unit and name the item." };

  const db = await saasDb();
  if (!(await ownsParent(db, company.id, "unit", args.unit_id))) return { ok: false, error: "Pick one of your trucks." };
  const { data, error } = await db
    .from("saas_compliance_items")
    .insert({
      company_id: company.id,
      parent_type: "unit",
      parent_id: args.unit_id,
      title,
      kind: args.kind || "cert",
      issued_date: new Date().toISOString().slice(0, 10),
      expiration_date: args.expiration_date,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (args.storage_path && ownsStoragePath(args.storage_path, company.id)) {
    await db.from("saas_attachments").insert({
      company_id: company.id,
      entity_type: "compliance_item",
      entity_id: (data as { id: string }).id,
      storage_path: args.storage_path,
      content_type: args.content_type ?? null,
      label: "proof",
    });
  }

  {
    const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
    const { logEvent } = await import("@/lib/saas/notify");
    void logEvent({ companyId: company.id, kind: "cert_added", actor, unitId: args.unit_id,
      message: `${title} added${actor ? ` by ${actor}` : ""}${args.expiration_date ? ` — expires ${args.expiration_date}` : ""}` });
  }
  revalidatePath("/app/quick");
  revalidatePath("/app");
  return { ok: true };
}
