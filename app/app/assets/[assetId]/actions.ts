"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { ownsStoragePath } from "@/lib/saas/own";

/** Set/replace an asset's primary photo (path already uploaded client-side). */
export async function setAssetPhoto(args: {
  assetId: string;
  storage_path: string;
  content_type?: string | null;
}) {
  const { company } = await requireCompany();
  if (!ownsStoragePath(args.storage_path, company.id)) throw new Error("bad photo path");
  const db = await saasDb();
  const { error } = await db
    .from("saas_assets")
    .update({ primary_photo_path: args.storage_path })
    .eq("id", args.assetId)
    .eq("company_id", company.id);
  if (error) throw new Error(error.message);
  await db.from("saas_attachments").insert({
    company_id: company.id,
    entity_type: "asset",
    entity_id: args.assetId,
    storage_path: args.storage_path,
    content_type: args.content_type ?? null,
    label: "photo",
  });
  revalidatePath(`/app/assets/${args.assetId}`);
}
