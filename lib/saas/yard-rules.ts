import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The manager's switches (Settings → Rules) and who counts as a manager.
 * Kept apart from the upload pipeline so pages can read them without
 * pulling the photo reader into their bundle.
 */

export type Role = "owner" | "admin" | "member" | "crew_link";
export const isManagerRole = (r: Role | string) => r === "owner" || r === "admin";

export interface YardRules {
  handUploadsNeedOk: boolean; allowCertOnTheWay: boolean; outAlertDays: number; requireTagScan: boolean;
  /** Every load-out ends with a photo of the loaded truck (on by default). */
  requireLoadoutPhoto: boolean;
  /** Checking a piece by hand means typing the last 4 of its serial (off by default). */
  requireLast4: boolean;
  /**
   * The quick check (on by default): a short list per truck and job, "On
   * truck" taps, one photo, Ready. Off is the full check: every piece scanned
   * and its tests and paper checked before the truck can roll.
   */
  quickCheck: boolean;
}
export const DEFAULT_RULES: YardRules = { handUploadsNeedOk: false, allowCertOnTheWay: true, outAlertDays: 7, requireTagScan: false, requireLoadoutPhoto: true, requireLast4: false, quickCheck: true };

export async function getYardRules(db: SupabaseClient, companyId: string): Promise<YardRules> {
  const { data } = await db.from("saas_enforcement_settings")
    .select("hand_uploads_need_ok, allow_cert_on_the_way, out_alert_days, require_tag_scan, require_loadout_photo, require_last4, quick_check").eq("company_id", companyId).maybeSingle();
  const r = data as { hand_uploads_need_ok: boolean; allow_cert_on_the_way: boolean; out_alert_days: number | null; require_tag_scan: boolean | null; require_loadout_photo: boolean | null; require_last4: boolean | null; quick_check: boolean | null } | null;
  return {
    handUploadsNeedOk: r?.hand_uploads_need_ok ?? DEFAULT_RULES.handUploadsNeedOk,
    allowCertOnTheWay: r?.allow_cert_on_the_way ?? DEFAULT_RULES.allowCertOnTheWay,
    outAlertDays: r?.out_alert_days ?? DEFAULT_RULES.outAlertDays,
    requireTagScan: r?.require_tag_scan ?? DEFAULT_RULES.requireTagScan,
    requireLoadoutPhoto: r?.require_loadout_photo ?? DEFAULT_RULES.requireLoadoutPhoto,
    requireLast4: r?.require_last4 ?? DEFAULT_RULES.requireLast4,
    quickCheck: r?.quick_check ?? DEFAULT_RULES.quickCheck,
  };
}
