import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyEvent } from "./notify";
import { daysOut } from "./whereabouts";

/**
 * Iron out on a job past the company's limit, told to the managers once a
 * day in ONE email per company: what's newly over the limit, grouped by
 * truck. A piece is told about once per trip (out_alerted_at), so the same
 * valve doesn't nag every morning; checking it back in resets it.
 */

export interface OutPiece { id: string; name: string; identifier: string | null; unit_id: string | null; out_since: string }

/** "CT-08: 5 pieces, out 9 days · Lubricator #3 LB-813, out 12 days" */
export function outDigest(pieces: OutPiece[], unitName: Map<string, string>, now: number): string {
  const byTruck = new Map<string, OutPiece[]>();
  for (const p of pieces) { const k = p.unit_id ?? ""; byTruck.set(k, [...(byTruck.get(k) ?? []), p]); }
  const parts: string[] = [];
  for (const [unitId, list] of byTruck) {
    const days = Math.max(...list.map((p) => daysOut(p.out_since, now)));
    if (unitId) parts.push(`${unitName.get(unitId) ?? "A truck"}: ${list.length} ${list.length === 1 ? "piece" : "pieces"}, out ${days} days`);
    else for (const p of list) parts.push(`${p.name}${p.identifier ? ` ${p.identifier}` : ""}, out ${daysOut(p.out_since, now)} days`);
  }
  return parts.join(" · ");
}

export async function sweepOutTooLong(admin: SupabaseClient): Promise<{ companies: number; pieces: number; errors: string[] }> {
  const errors: string[] = [];
  let companies = 0, total = 0;
  const now = Date.now();
  const { data: cos } = await admin.from("saas_companies").select("id, name, subscription_status, comped, is_demo").eq("is_demo", false);
  for (const c of (cos ?? []) as { id: string; name: string; subscription_status: string; comped: boolean; is_demo: boolean }[]) {
    if (!(c.comped || c.subscription_status === "active" || c.subscription_status === "past_due")) continue;
    try {
      const { data: rules } = await admin.from("saas_enforcement_settings").select("out_alert_days").eq("company_id", c.id).maybeSingle();
      const limit = (rules as { out_alert_days: number } | null)?.out_alert_days ?? 7;
      const cutoff = new Date(now - limit * 86400e3).toISOString();
      const { data: rows } = await admin.from("saas_assets").select("id, name, identifier, unit_id, out_since, out_alerted_at")
        .eq("company_id", c.id).not("status", "in", "(retired,missing)").not("out_since", "is", null).lte("out_since", cutoff);
      const fresh = ((rows ?? []) as (OutPiece & { out_alerted_at: string | null })[])
        .filter((r) => !r.out_alerted_at || r.out_alerted_at < r.out_since);
      if (!fresh.length) continue;
      const unitIds = [...new Set(fresh.map((r) => r.unit_id).filter((x): x is string => Boolean(x)))];
      const { data: units } = unitIds.length ? await admin.from("saas_units").select("id, name").in("id", unitIds) : { data: [] };
      const names = new Map(((units ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]));
      await notifyEvent({
        companyId: c.id, companyName: c.name,
        message: `${fresh.length} ${fresh.length === 1 ? "piece" : "pieces"} out more than ${limit} days and not checked back in. ${outDigest(fresh, names, now)}`,
      });
      await admin.from("saas_assets").update({ out_alerted_at: new Date(now).toISOString() }).in("id", fresh.map((r) => r.id));
      await admin.from("saas_events").insert({ company_id: c.id, kind: "out_too_long", message: `Managers told: ${fresh.length} ${fresh.length === 1 ? "piece" : "pieces"} out more than ${limit} days. ${outDigest(fresh, names, now)}` });
      companies++; total += fresh.length;
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { companies, pieces: total, errors };
}
