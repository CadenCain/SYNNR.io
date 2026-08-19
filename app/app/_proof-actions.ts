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

  // A proof's scope ids are queried later by the PUBLIC proof page with the
  // service role. A forged yardId/unitId here would therefore read another
  // company's data through that page — so both must be proven ours first.
  if (args.scope === "unit") {
    if (!args.unitId) return { ok: false, error: "pick a unit" };
    const { data: own } = await db.from("saas_units").select("id")
      .eq("id", args.unitId).eq("company_id", company.id).maybeSingle();
    if (!own) return { ok: false, error: "unit not found" };
  }
  if (args.scope === "yard") {
    if (!args.yardId) return { ok: false, error: "pick a yard" };
    const { data: own } = await db.from("saas_yards").select("id")
      .eq("id", args.yardId).eq("company_id", company.id).maybeSingle();
    if (!own) return { ok: false, error: "yard not found" };
  }

  const { data, error } = await db
    .from("saas_readiness_proofs")
    .insert({
      company_id: company.id,
      scope: args.scope,
      yard_id: args.scope === "yard" ? args.yardId : null,
      unit_id: args.scope === "unit" ? args.unitId : null,
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
