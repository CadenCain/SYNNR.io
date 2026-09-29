import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The manager's switches (Settings → Rules) and who counts as a manager.
 * Kept apart from the upload pipeline so pages can read them without
 * pulling the photo reader into their bundle.
 */

export type Role = "owner" | "admin" | "member" | "crew_link";
export const isManagerRole = (r: Role | string) => r === "owner" || r === "admin";

export interface YardRules { handUploadsNeedOk: boolean; allowCertOnTheWay: boolean }
export const DEFAULT_RULES: YardRules = { handUploadsNeedOk: false, allowCertOnTheWay: true };

export async function getYardRules(db: SupabaseClient, companyId: string): Promise<YardRules> {
  const { data } = await db.from("saas_enforcement_settings")
    .select("hand_uploads_need_ok, allow_cert_on_the_way").eq("company_id", companyId).maybeSingle();
  const r = data as { hand_uploads_need_ok: boolean; allow_cert_on_the_way: boolean } | null;
  return {
    handUploadsNeedOk: r?.hand_uploads_need_ok ?? DEFAULT_RULES.handUploadsNeedOk,
    allowCertOnTheWay: r?.allow_cert_on_the_way ?? DEFAULT_RULES.allowCertOnTheWay,
  };
}
