"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

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
  const { company } = await requireCompany();
  const title = args.title.trim();
  if (!args.unit_id || !title) return { ok: false, error: "Pick a unit and name the item." };

  const db = await saasDb();
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

  if (args.storage_path) {
    await db.from("saas_attachments").insert({
      company_id: company.id,
      entity_type: "compliance_item",
      entity_id: (data as { id: string }).id,
      storage_path: args.storage_path,
      content_type: args.content_type ?? null,
      label: "proof",
    });
  }

  revalidatePath("/app/quick");
  revalidatePath("/app");
  return { ok: true };
}
