import { saasAdmin } from "./db";

/**
 * Clear an item's rows in saas_alerts_sent.
 *
 * WHY THIS EXISTS: the expiration sweep skips any item whose id already
 * appears in saas_alerts_sent (dedupe is per ITEM, not per cycle). So the
 * moment an expiration date changes, that log has to be cleared or the item
 * is permanently muted — the customer renews a BOP cert and never hears about
 * it again. That is the product's one promise, failing silently.
 *
 * Every path that writes a new expiration_date MUST call this:
 *   - renewComplianceItem  (camera renew)
 *   - updateComplianceItem (edit form)      <- was missing, items went mute
 *   - the CSV importer's update branch      <- was missing, same
 *
 * Service role on purpose: the alert log is cron-owned and members have no
 * delete policy on it. Best-effort — a failure here must never block a save,
 * but it is logged so it isn't invisible.
 */
export async function clearAlertLog(companyId: string, itemIds: string | string[]): Promise<void> {
  const ids = (Array.isArray(itemIds) ? itemIds : [itemIds]).filter(Boolean);
  if (ids.length === 0) return;
  try {
    const admin = saasAdmin();
    if (!admin) return;
    // Chunked: an import can renew hundreds of items in one commit.
    for (let i = 0; i < ids.length; i += 200) {
      await admin
        .from("saas_alerts_sent")
        .delete()
        .eq("company_id", companyId)
        .in("compliance_item_id", ids.slice(i, i + 200));
    }
  } catch (e) {
    console.error("[alert-log] clear failed:", e instanceof Error ? e.message : e);
  }
}
