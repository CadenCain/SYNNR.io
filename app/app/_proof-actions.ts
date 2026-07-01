"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/** Create a shareable readiness-proof link. Returns the public URL. */
export async function createReadinessProof(args: {
  scope: "company" | "yard" | "unit";
  yardId?: string | null;
  unitId?: string | null;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { company, user } = await requireCompany();
  const db = await saasDb();
  const { data, error } = await db
    .from("saas_readiness_proofs")
    .insert({
      company_id: company.id,
      scope: args.scope,
      yard_id: args.yardId ?? null,
      unit_id: args.unitId ?? null,
      created_by: user.id,
    })
    .select("token")
    .single();
  if (error) return { ok: false, error: error.message };
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";
  return { ok: true, url: `${origin}/proof/${(data as { token: string }).token}` };
}

export async function revokeReadinessProof(fd: FormData) {
  const { company } = await requireCompany();
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const db = await saasDb();
  await db.from("saas_readiness_proofs")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/settings/proofs");
}
