import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cert-expiration sweep. Scans rd_asset_certs (and later rd_person_certs) and
 * upserts an `rd_alerts` row at the 30 / 14 / 3 / 0 day tiers. Dedup is
 * enforced by a UNIQUE index on `dedup_key`, so re-running the sweep is safe.
 *
 * dedup_key shape: `cert_expiring:{cert_id}:{tier}` — one alert per cert per
 * tier, ever. If the operator dismisses one, it stays dismissed even if the
 * sweep runs again.
 */

const TIERS = [
  { days: 30, label: "expires in 30 days" as const },
  { days: 14, label: "expires in 14 days" as const },
  { days: 3, label: "expires in 3 days" as const },
  { days: 0, label: "expires TODAY" as const },
];

export interface SweepResult {
  scanned_asset_certs: number;
  inserted_alerts: number;
  duplicate_alerts: number;
  errors: string[];
}

/** Calendar-day arithmetic in UTC — cert expiry is a calendar date. */
function isoDay(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export async function sweepExpirations(db: SupabaseClient): Promise<SweepResult> {
  const today = new Date();
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + 31); // 30-day tier + 1 day grace
  const todayIso = isoDay(today);
  const horizonIso = isoDay(horizon);

  const result: SweepResult = {
    scanned_asset_certs: 0,
    inserted_alerts: 0,
    duplicate_alerts: 0,
    errors: [],
  };

  // Pull every live cert expiring inside the horizon, joined with its asset's
  // shop_id (needed for the alert row + the contact phone).
  const { data, error } = await db
    .from("rd_asset_certs")
    .select(`
      id, cert_type, expires_at,
      rd_assets!inner ( id, asset_code, shop_id, deleted_at,
        rd_shops!inner ( id, name, primary_contact_phone )
      )
    `)
    .is("deleted_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", isoDay(new Date(today.getTime() - 86400e3 * 1))) // give 1d grace past due
    .lte("expires_at", horizonIso);

  if (error) {
    result.errors.push(`scan: ${error.message}`);
    return result;
  }

  type Row = {
    id: string;
    cert_type: string;
    expires_at: string;
    rd_assets: {
      id: string;
      asset_code: string;
      shop_id: string;
      deleted_at: string | null;
      rd_shops: { id: string; name: string; primary_contact_phone: string | null };
    };
  };
  // Supabase's typed select can return a singular nested object as an array;
  // normalize defensively. Cast through unknown because the inferred join
  // shape doesn't overlap with our Row type until after flattening.
  const rows = ((data ?? []) as unknown[]).map((raw) => {
    const r = raw as { id: string; cert_type: string; expires_at: string; rd_assets: unknown };
    const a = r.rd_assets as Row["rd_assets"] | Row["rd_assets"][];
    const asset = Array.isArray(a) ? a[0] : a;
    const s = (asset as { rd_shops: unknown }).rd_shops as Row["rd_assets"]["rd_shops"] | Row["rd_assets"]["rd_shops"][];
    const shop = Array.isArray(s) ? s[0] : s;
    return { id: r.id, cert_type: r.cert_type, expires_at: r.expires_at, rd_assets: { ...asset, rd_shops: shop } } as Row;
  });

  const liveCerts = rows.filter((r) => !r.rd_assets.deleted_at);
  result.scanned_asset_certs = liveCerts.length;

  for (const cert of liveCerts) {
    const expDays = Math.floor(
      (new Date(cert.expires_at + "T00:00:00Z").getTime() -
        new Date(todayIso + "T00:00:00Z").getTime()) /
        86400e3,
    );

    // Pick the lowest tier this cert qualifies for that we haven't already
    // alerted. We don't generate ALL tiers retroactively — only the "best fit
    // for today." E.g. a cert expiring in 5 days lands in the 14-day bucket
    // (not 30), since 14 is the nearest reached tier.
    const tier = pickTier(expDays);
    if (!tier) continue;

    const dedup_key = `cert_expiring:${cert.id}:${tier.days}`;
    const shop = cert.rd_assets.rd_shops;
    const message = `[SYNNR] ${cert.rd_assets.asset_code} ${cert.cert_type} ${tier.label} (${cert.expires_at}). Reply OK to acknowledge or QUESTION if this is wrong.`;

    const { error: insErr } = await db.from("rd_alerts").insert({
      shop_id: shop.id,
      alert_type: expDays < 0 ? "cert_expired" : "cert_expiring",
      asset_cert_id: cert.id,
      asset_id: cert.rd_assets.id,
      due_at: cert.expires_at,
      dedup_key,
      to_phone: shop.primary_contact_phone,
      message,
      status: "pending",
    });
    if (insErr) {
      // Postgres unique violation = already alerted; not an error.
      if (insErr.code === "23505" || /duplicate key/i.test(insErr.message)) {
        result.duplicate_alerts++;
      } else {
        result.errors.push(`insert ${dedup_key}: ${insErr.message}`);
      }
    } else {
      result.inserted_alerts++;
    }
  }

  return result;
}

function pickTier(daysLeft: number): { days: number; label: string } | null {
  // Past due → use day-0 tier (still "today's outbound") so it surfaces.
  if (daysLeft < 0) return { days: 0, label: "expires TODAY" };
  if (daysLeft === 0) return TIERS[3];
  if (daysLeft <= 3) return TIERS[2];
  if (daysLeft <= 14) return TIERS[1];
  if (daysLeft <= 30) return TIERS[0];
  return null;
}
