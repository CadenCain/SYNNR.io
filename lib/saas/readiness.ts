import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplianceStatus } from "./db";
import { computeReadiness, localToday, type UnitState } from "./status";
import { judgeUnit, pendingCovers, FAILING_GEAR, withSerial, type JItem } from "./judge";

/**
 * One readiness engine for the whole app ("one source of truth"): the
 * dashboard KPIs, the fleet board tiles, and the sidebar pill all read this.
 * Unit state vocabulary: Ready / Due soon / Not ready / Not set up.
 *
 * SYNNR KEEPS UP WITH EVERYBODY'S RECORDS — certs, cards, gear status —
 * it is not a dispatch checklist. The gear list is reference only (it warns,
 * it never gates), so the tile and the readiness check agree by design:
 * both fail a unit only on real record problems. A unit is:
 *   not_ready — the rules in lib/saas/judge.ts: an expired or no-date cert
 *               on the unit or its iron; iron flagged missing or red-tagged.
 *               An item we can't prove is an item that fails.
 *   due_soon  — anything expiring inside its reminder window, or a cert on the way
 *   ready     — everything current
 *   not_setup — nothing of the shop's tracked at all; never reads green
 */
export interface UnitTile {
  yardId: string;
  id: string;
  name: string;
  type: string;
  yardName: string;
  state: UnitState;
  why: string;                        // one-line reason ("DOT expires in 8d")
  crewWorst: ComplianceStatus | null; // always null now: crew cards aren't tracked
}

export interface CompanyReadiness {
  readiness: number | null;          // null = not set up yet
  counts: Record<ComplianceStatus, number>;
  units: UnitTile[];
  hardFail: boolean;
}

export async function getCompanyReadiness(db: SupabaseClient, companyId: string): Promise<CompanyReadiness> {
  // Equipment only: crew cards aren't part of the call, and retired iron
  // (scrapped or sold) is kept for the record but out of every count.
  const [{ data: itemData }, { data: unitData }, { data: assetData }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, status, expiration_date, reminder_days, pending_until, parent_type, parent_id")
      .eq("company_id", companyId).neq("parent_type", "crew"),
    db.from("saas_units").select("id, name, type, yard_id, saas_yards(name)").eq("company_id", companyId).order("name"),
    db.from("saas_assets").select("id, name, identifier, unit_id, status").eq("company_id", companyId).neq("status", "retired"),
  ]);

  type Item = JItem & { status: ComplianceStatus; parent_type: string; parent_id: string };
  const today = localToday();
  const liveAssetIds = new Set(((assetData ?? []) as { id: string }[]).map((a) => a.id));
  const items = ((itemData ?? []) as Item[]).filter((i) => i.parent_type !== "asset" || liveAssetIds.has(i.parent_id));
  // "Cert on the way" counts like due-soon everywhere: not failing, not
  // current. Once its window closes the view's own status takes over again.
  const effective = (i: Item): ComplianceStatus =>
    (i.status === "expired" || i.status === "none") && pendingCovers(i, today) ? "expiring" : i.status;
  const counts = { expired: 0, expiring: 0, valid: 0, none: 0 } as Record<ComplianceStatus, number>;
  for (const i of items) counts[effective(i)]++;

  type UnitRow = { id: string; name: string; type: string; yard_id: string; saas_yards: { name: string } | { name: string }[] | null };
  const unitRows = (unitData ?? []) as UnitRow[];
  // "2in 1502 plug valve PV-2231": the serial says which valve.
  const assets = ((assetData ?? []) as { id: string; name: string; identifier: string | null; unit_id: string | null; status: string }[])
    .map((a) => ({ ...a, name: withSerial(a.name, a.identifier) }));

  const group = <T,>(rows: T[], key: (r: T) => string | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const k = key(r); if (!k) continue; const a = m.get(k) ?? []; a.push(r); m.set(k, a); }
    return m;
  };
  const assetsByUnit = group(assets, (a) => a.unit_id);
  const itemsByParent = group(items, (i) => i.parent_id);

  const units: UnitTile[] = unitRows.map((u) => {
    const yardName = (Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name) ?? "";
    const unitAssets = assetsByUnit.get(u.id) ?? [];
    const j = judgeUnit({
      unitItems: itemsByParent.get(u.id) ?? [],
      assets: unitAssets,
      assetItems: unitAssets.flatMap((a) => itemsByParent.get(a.id) ?? []),
      crew: [],
      crewItems: [],
    }, today, today);
    const state: UnitState = j.verdict;
    return {
      id: u.id, yardId: u.yard_id, name: u.name, type: u.type, yardName, state, why: j.why,
      crewWorst: null,
    };
  });

  // Blended company score (formula in lib/saas/status.ts). Currency counts
  // EVERY item: a no-date "Missing" item is in the denominator and not the
  // numerator, so it drags the score exactly like an expired one.
  const split = (pred: (i: Item) => boolean) => {
    let valid = 0, total = 0;
    for (const i of items) if (pred(i)) { total++; if (effective(i) === "valid") valid++; }
    return { valid, total };
  };
  const gear = split(() => true);

  // Score = LIVE records only. Recorded checks don't feed it: a past check
  // can't make today's paperwork current. Hard cap when anything is
  // unprovable: expired, no date on file, or gear flagged missing or
  // red-tagged. Each of these also shows as a red tile, so the cap is never
  // a mystery.
  const anyGearDown = assets.some((a) => FAILING_GEAR.has(a.status));
  const hardFail = counts.expired > 0 || counts.none > 0 || anyGearDown;
  const readiness = computeReadiness({
    certCurrency: gear.total > 0 ? gear.valid / gear.total : null,
    crewCurrency: null,
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
