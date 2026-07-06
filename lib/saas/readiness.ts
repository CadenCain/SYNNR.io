import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplianceStatus } from "./db";
import { computeReadiness, worstStatus, localToday, type UnitState } from "./status";

/**
 * One readiness engine for the whole app ("one source of truth"): the
 * dashboard KPIs, the fleet board tiles, and the sidebar pill all read this.
 * Unit state vocabulary: Ready / Due soon / Not ready / Not set up.
 *
 * SYNNR tracks RECORD CURRENCY, not physical possession — check-in/check-out
 * was deliberately cut from scope. A unit is:
 *   not_ready — an expired OR no-date ("Missing") cert on the unit, its
 *               assets, or assigned crew — or an asset flagged missing.
 *               An item we can't prove is an item that fails.
 *   due_soon  — anything expiring inside its reminder window
 *   ready     — everything current
 *   not_setup — nothing tracked at all; never reads green
 */
export interface UnitTile {
  id: string;
  name: string;
  type: string;
  yardName: string;
  state: UnitState;
  why: string;                        // one-line reason ("DOT expires in 8d")
  crewWorst: ComplianceStatus | null; // assigned-crew mini indicator
}

export interface CompanyReadiness {
  readiness: number | null;          // null = not set up yet
  counts: Record<ComplianceStatus, number>;
  units: UnitTile[];
  hardFail: boolean;
}

const daysUntil = (iso: string) => {
  const today = localToday();
  return Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400e3);
};

export async function getCompanyReadiness(db: SupabaseClient, companyId: string): Promise<CompanyReadiness> {
  const [{ data: itemData }, { data: unitData }, { data: assetData }, { data: ucData }, { data: coData }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, status, expiration_date, parent_type, parent_id").eq("company_id", companyId),
    db.from("saas_units").select("id, name, type, saas_yards(name)").eq("company_id", companyId).order("name"),
    db.from("saas_assets").select("id, name, unit_id, status").eq("company_id", companyId),
    db.from("saas_unit_crew").select("unit_id, crew_member_id").eq("company_id", companyId),
    db.from("saas_dispatch_checks").select("id, unit_id").eq("company_id", companyId)
      .eq("type", "checkout").order("started_at", { ascending: false }).limit(300),
  ]);

  type Item = { id: string; title: string; status: ComplianceStatus; expiration_date: string | null; parent_type: string; parent_id: string };
  const items = (itemData ?? []) as Item[];
  const counts = { expired: 0, expiring: 0, valid: 0, none: 0 } as Record<ComplianceStatus, number>;
  for (const i of items) counts[i.status]++;

  type UnitRow = { id: string; name: string; type: string; saas_yards: { name: string } | { name: string }[] | null };
  const unitRows = (unitData ?? []) as UnitRow[];
  const assets = (assetData ?? []) as { id: string; name: string; unit_id: string | null; status: string }[];
  const unitCrew = (ucData ?? []) as { unit_id: string; crew_member_id: string }[];

  // Indexes for per-unit rollups
  const assetsByUnit = new Map<string, typeof assets>();
  for (const a of assets) {
    if (!a.unit_id) continue;
    const arr = assetsByUnit.get(a.unit_id) ?? [];
    arr.push(a);
    assetsByUnit.set(a.unit_id, arr);
  }
  const itemsByParent = new Map<string, Item[]>();
  for (const i of items) {
    const arr = itemsByParent.get(i.parent_id) ?? [];
    arr.push(i);
    itemsByParent.set(i.parent_id, arr);
  }
  const crewByUnit = new Map<string, string[]>();
  for (const uc of unitCrew) {
    const arr = crewByUnit.get(uc.unit_id) ?? [];
    arr.push(uc.crew_member_id);
    crewByUnit.set(uc.unit_id, arr);
  }

  const units: UnitTile[] = unitRows.map((u) => {
    const yardName = (Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name) ?? "";
    const unitAssets = assetsByUnit.get(u.id) ?? [];
    const scope: Item[] = [
      ...(itemsByParent.get(u.id) ?? []),
      ...unitAssets.flatMap((a) => itemsByParent.get(a.id) ?? []),
      ...(crewByUnit.get(u.id) ?? []).flatMap((cid) => itemsByParent.get(cid) ?? []),
    ];
    const crewItems = (crewByUnit.get(u.id) ?? []).flatMap((cid) => itemsByParent.get(cid) ?? []);
    const crewWorst = worstStatus(crewItems.map((i) => i.status));

    const missingAsset = unitAssets.find((a) => a.status === "missing");
    const expired = scope.filter((i) => i.status === "expired").sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))[0];
    const noDate = scope.find((i) => i.status === "none");
    const expiring = scope.filter((i) => i.status === "expiring").sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))[0];

    let state: UnitState; let why: string;
    if (missingAsset) {
      state = "not_ready"; why = `${missingAsset.name} — missing`;
    } else if (expired) {
      const d = expired.expiration_date ? Math.abs(daysUntil(expired.expiration_date)) : 0;
      state = "not_ready"; why = `${expired.title} — expired${d ? ` ${d}d ago` : ""}`;
    } else if (noDate) {
      state = "not_ready"; why = `${noDate.title} — no expiration on file`;
    } else if (expiring) {
      const d = expiring.expiration_date ? daysUntil(expiring.expiration_date) : null;
      state = "due_soon"; why = `${expiring.title} expires${d !== null ? (d <= 0 ? " today" : ` in ${d}d`) : " soon"}`;
    } else if (scope.length === 0) {
      state = "not_setup"; why = "Nothing tracked yet";
    } else {
      state = "ready"; why = "All current";
    }
    return { id: u.id, name: u.name, type: u.type, yardName, state, why, crewWorst };
  });

  // Blended company score (formula in lib/saas/status.ts). Currency counts
  // EVERY item — a no-date "Missing" item is in the denominator and not the
  // numerator, so it drags the score exactly like an expired one.
  const split = (pred: (i: Item) => boolean) => {
    let valid = 0, total = 0;
    for (const i of items) if (pred(i)) { total++; if (i.status === "valid") valid++; }
    return { valid, total };
  };
  const gear = split((i) => i.parent_type !== "crew");
  const crew = split((i) => i.parent_type === "crew");

  // Loadout completeness from each unit's latest recorded pre-dispatch check
  // (computed record-currency lines — not possession confirmations).
  const latestByUnit = new Map<string, string>();
  for (const co of (coData ?? []) as { id: string; unit_id: string }[]) {
    if (!latestByUnit.has(co.unit_id)) latestByUnit.set(co.unit_id, co.id);
  }
  let loadoutOk = 0, loadoutTotal = 0, loadoutMissing = 0;
  if (latestByUnit.size > 0) {
    const { data: rows } = await db
      .from("saas_dispatch_check_items").select("result")
      .in("check_id", [...latestByUnit.values()])
      .in("source_type", ["loadout_item", "asset"]);
    for (const r of (rows ?? []) as { result: string }[]) {
      if (r.result === "ok") { loadoutOk++; loadoutTotal++; }
      else if (r.result === "missing") { loadoutMissing++; loadoutTotal++; }
      else if (r.result === "unconfirmed") { loadoutTotal++; } // historical rows
    }
  }

  const anyAssetMissing = assets.some((a) => a.status === "missing");
  // Hard cap when anything is unprovable: expired, no-date, missing asset,
  // or a required loadout line missing on the latest recorded check.
  const hardFail = counts.expired > 0 || counts.none > 0 || anyAssetMissing || loadoutMissing > 0;
  const readiness = computeReadiness({
    certCurrency: gear.total > 0 ? gear.valid / gear.total : null,
    loadoutCompleteness: loadoutTotal > 0 ? loadoutOk / loadoutTotal : null,
    crewCurrency: crew.total > 0 ? crew.valid / crew.total : null,
    hardFail,
  });

  return { readiness, counts, units, hardFail };
}

/**
 * Daily history snapshot: one row per company per day so KPI sparklines are
 * real. Called by the daily cron with the service-role client.
 */
export async function snapshotAllCompanies(admin: SupabaseClient): Promise<{ snapped: number; errors: string[] }> {
  const out = { snapped: 0, errors: [] as string[] };
  const { data: companies, error } = await admin.from("saas_companies").select("id");
  if (error) { out.errors.push(error.message); return out; }
  const day = localToday();
  const dayStart = `${day}T00:00:00Z`;
  for (const c of (companies ?? []) as { id: string }[]) {
    try {
      const rd = await getCompanyReadiness(admin, c.id);
      const { count } = await admin
        .from("saas_events").select("id", { count: "exact", head: true })
        .eq("company_id", c.id).eq("kind", "miss_caught").gte("created_at", dayStart);
      const { error: upErr } = await admin.from("saas_readiness_snapshots").upsert({
        company_id: c.id,
        day,
        readiness: rd.readiness,
        rolling: 0, // legacy column — possession tracking removed
        misses_caught: count ?? 0,
      }, { onConflict: "company_id,day" });
      if (upErr) out.errors.push(`${c.id}: ${upErr.message}`);
      else out.snapped++;
    } catch (e) {
      out.errors.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}
