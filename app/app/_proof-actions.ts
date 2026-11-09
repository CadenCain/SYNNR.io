"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";

/** Create a shareable readiness-proof link. Returns the public URL. */
export async function createReadinessProof(args: {
  scope: "company" | "yard" | "unit";
  yardId?: string | null;
  unitId?: string | null;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { company, user } = await requireBillableCompany();
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
  assertCan(company, "revoke_proof");
  const id = String(fd.get("id") ?? "");
  if (!id) return;
  const db = await saasDb();
  await db.from("saas_readiness_proofs")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/settings/proofs");
}

/** Shut off (or turn back on) the operator link a load-out made. Managers only. */
export async function setLoadoutLink(fd: FormData) {
  const { company, user } = await requireCompany();
  assertCan(company, "revoke_proof");
  const id = String(fd.get("loadout_id") ?? "");
  const off = String(fd.get("off") ?? "") === "1";
  const admin = saasAdmin();
  if (!id || !admin) return;
  const db = await saasDb();
  const { data: rec } = await db.from("saas_loadout_scans").select("id").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!rec) return;
  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "A manager";
  if (off) await admin.from("saas_loadout_link_offs").upsert({ loadout_id: id, company_id: company.id, off_by: actor }, { onConflict: "loadout_id" });
  else await admin.from("saas_loadout_link_offs").delete().eq("loadout_id", id).eq("company_id", company.id);
  revalidatePath("/app/settings/proofs");
  revalidatePath(`/app/loadouts/${id}`);
}
