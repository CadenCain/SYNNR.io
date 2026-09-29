import type { SupabaseClient } from "@supabase/supabase-js";
import { localToday } from "./status";
import { judgeUnit, FAILING_GEAR, plainDate, type JItem } from "./judge";

/**
 * The readiness check: a RECORD-CURRENCY check, not a dispatch checklist.
 * It answers "will everything on record be current FOR THE JOB, and is it
 * assigned?" —
 *   · every cert/DOT item on the unit and its assets is current THROUGH the
 *     job date (a cert that's fine today but lapses before the job FAILS —
 *     "still active" is not "current for this job")
 *   · every assigned hand's cards are current through the job date
 *   · any asset the shop has FLAGGED missing / out of service fails
 * The gear list is a REFERENCE, not a gate: a line that isn't in the asset
 * book yet warns, it never fails a truck. And nobody is asked to confirm
 * they're physically holding an item — possession tracking was cut from
 * scope. SYNNR keeps up with records.
 *
 * Computed entirely server-side and used by both the page (display) and the
 * record action, so a client can never influence the verdict. No overrides:
 * a Not-ready result cannot be recorded as anything but Not ready.
 */

export interface CheckLine {
  source_type: "loadout_item" | "asset" | "cert" | "crew_cert";
  source_id: string | null;
  label: string;
  sub?: string;
  result: "ok" | "warn" | "missing" | "expired";
  detail?: string; // why it failed, human words
}

export interface DispatchComputation {
  unitName: string;
  yardId: string;
  jobDate: string;    // the date checked against (ISO); today if not specified
  isFutureJob: boolean;
  verdict: "ready" | "not_ready" | "not_setup";
  lines: CheckLine[];
  failures: string[];   // named failing lines for banners/alerts
  warnings: string[];   // heads-up (expires shortly after the job) + skipped-scope caveats
  notChecked: string[]; // what this check did NOT verify — shown on the public proof too
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ── Pure helpers ────────────────────────────────────────────────────────
 * The fleet-board tile (lib/saas/readiness.ts) and this check agree by
 * DESIGN, not by sharing a gate: both judge a truck on live records only.
 * These helpers exist to read the gear list for reference + warnings. */

export interface AssetLite { name: string; status: string }

/** Fuzzy record-match of a template line against the unit's asset list.
 *  Tiers: exact/substring first ("BOP #3" ↔ "BOP"), then distinctive-token
 *  overlap — hands name gear "BOP stack — 15k dual ram" while templates say
 *  "Pressure control package (BOP)", and that must still match. Generic
 *  filler words don't count as a match on their own. */
const GENERIC_TOKENS = new Set(["package", "kit", "set", "assembly", "unit", "equipment", "gear", "item", "spare", "misc", "the", "and", "for", "with"]);
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t) && !/^\d+$/.test(t));
export function matchAssetForLine<A extends AssetLite>(label: string, assets: A[]): A | null {
  const n = norm(label);
  const bySubstring = assets.find((a) => { const an = norm(a.name); return an === n || an.includes(n) || n.includes(an); });
  if (bySubstring) return bySubstring;
  const lineToks = new Set(tokens(label));
  if (lineToks.size === 0) return null;
  return assets.find((a) => tokens(a.name).some((t) => lineToks.has(t))) ?? null;
}

export interface TplLite { id: string; company_id: string | null; unit_id: string | null; unit_type: string | null }

/** Template precedence: unit-specific → company type default → global seed. */
export function resolveLoadoutTemplate<T extends TplLite>(tpls: T[], companyId: string, unitId: string, unitType: string): T | null {
  return (
    tpls.find((t) => t.unit_id === unitId) ??
    tpls.find((t) => t.company_id === companyId && t.unit_type === unitType) ??
    tpls.find((t) => t.company_id === null && t.unit_type === unitType) ??
    null
  );
}

/** Assigned hands with zero cert rows — each one fails the check. Pure so
 *  the boundary is pinned by tests, not read-and-hoped. */
export function crewWithNoCards(
  crewIds: string[],
  crewCerts: { parent_id: string }[],
  names: Map<string, string>,
): { crewId: string; label: string }[] {
  const withCards = new Set(crewCerts.map((c) => c.parent_id));
  return crewIds
    .filter((id) => !withCards.has(id))
    .map((id) => ({ crewId: id, label: `${names.get(id) ?? "assigned hand"}: no cards on file` }));
}

export async function computeDispatchCheck(
  db: SupabaseClient,
  companyId: string,
  unitId: string,
  jobDateArg?: string | null,
): Promise<DispatchComputation | null> {
  const today = localToday();
  // Clamp: a job date in the past is meaningless for a readiness check —
  // fall back to today. Anything today-or-later is honored.
  const jobDate = jobDateArg && jobDateArg >= today ? jobDateArg : today;
  const isFutureJob = jobDate > today;
  const { data: unitData } = await db
    .from("saas_units").select("id, name, type, yard_id")
    .eq("id", unitId).eq("company_id", companyId).maybeSingle();
  if (!unitData) return null;
  const unit = unitData as { id: string; name: string; type: string; yard_id: string };

  // Template resolution: unit-specific → company type default → global seed
  const { data: templates } = await db
    .from("saas_loadout_templates")
    .select("id, company_id, unit_id, unit_type")
    .or(`unit_id.eq.${unitId},unit_type.eq.${unit.type}`);
  const tpls = (templates ?? []) as TplLite[];
  const template = resolveLoadoutTemplate(tpls, companyId, unitId, unit.type);

  // Equipment only: the truck's own paper and the iron on it. Retired iron
  // (scrapped or sold) isn't on the truck in any way that counts.
  const [{ data: tplItems }, { data: assetData }] = await Promise.all([
    template
      ? db.from("saas_loadout_items").select("id, label, required, sort").eq("template_id", template.id).order("sort")
      : Promise.resolve({ data: [] }),
    db.from("saas_assets").select("id, name, status").eq("unit_id", unitId).eq("company_id", companyId).neq("status", "retired"),
  ]);
  const loadout = (tplItems ?? []) as { id: string; label: string; required: boolean; sort: number }[];
  const assets = (assetData ?? []) as { id: string; name: string; status: string }[];

  // Certs: the unit + its iron
  const assetIds = assets.map((a) => a.id);
  const COLS = "id, title, expiration_date, pending_until, reminder_days, parent_id";
  const [{ data: unitCerts }, { data: assetCerts }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select(COLS).eq("company_id", companyId).eq("parent_type", "unit").eq("parent_id", unitId),
    assetIds.length
      ? db.from("saas_compliance_items_with_status")
          .select(COLS).eq("company_id", companyId).eq("parent_type", "asset").in("parent_id", assetIds)
      : Promise.resolve({ data: [] }),
  ]);

  const lines: CheckLine[] = [];
  const warnings: string[] = [];

  // 1) Gear list vs the asset book. The gear list is a REFERENCE, not a gate:
  //    a line that simply isn't in the book yet is a heads-up, never a
  //    failure. Gear that IS flagged missing or red-tagged fails the truck
  //    through the rules below, whether or not it's on the list.
  for (const li of loadout) {
    const match = matchAssetForLine(li.label, assets);
    if (!match) {
      // A required line that isn't in the book must not wear green: a hand
      // scanning chips saw six OKs on a truck that wasn't ready.
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: li.required ? "warn" : "ok", detail: li.required ? "not in the asset book yet" : "optional, not in the asset book" });
      if (li.required) warnings.push(`${li.label} is on the gear list but not in the asset book yet. Add it so it's tracked.`);
    } else if (FAILING_GEAR.has(match.status)) {
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: "missing", detail: `${match.name} is flagged ${match.status === "out_of_service" ? "red-tagged" : "missing"}` });
    } else {
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: "ok", detail: `on the list (${match.name})` });
    }
  }

  // 2) The rules (lib/saas/judge.ts), against the JOB DATE: a cert that's
  //    fine today but lapses before the job fails. Heads-up window: 21 days
  //    past the job.
  const j = judgeUnit({
    unitItems: (unitCerts ?? []) as JItem[],
    assets,
    assetItems: (assetCerts ?? []) as JItem[],
    crew: [],
    crewItems: [],
  }, jobDate, today, { soonDays: 21 });

  const failures: string[] = [];
  for (const l of j.lines) {
    const source_type: CheckLine["source_type"] = l.kind === "asset" ? "asset" : l.kind === "cert" ? "cert" : "crew_cert";
    if (l.result === "ok" || l.result === "due_soon") {
      const exp = plainDate(l.expiration_date as string);
      lines.push({ source_type, source_id: l.id, label: l.label, result: "ok", detail: `good to ${exp}` });
      if (l.result === "due_soon") {
        warnings.push(isFutureJob
          ? `${l.label}: expires ${exp}, just after the job. Renew soon.`
          : `${l.label}: due soon (${exp})`);
      }
    } else if (l.result === "pending") {
      lines.push({ source_type, source_id: l.id, label: l.label, result: "warn", detail: l.detail });
      warnings.push(`${l.label}: ${l.detail}. The real cert still has to be uploaded.`);
    } else {
      lines.push({ source_type, source_id: l.id, label: l.kind === "crew" ? l.label.replace(/: no cards on file$/, "") : l.label, result: l.result, detail: l.detail });
      failures.push(l.kind === "crew" ? l.label
        : l.kind === "asset" ? `${l.label}: ${l.detail}`
        : l.result === "missing" ? `${l.label}: no expiration on file`
        : isFutureJob && l.expiration_date && l.expiration_date >= today ? `${l.label}: expires ${plainDate(l.expiration_date)}, before the job`
        : `${l.label}: expired`);
    }
  }

  // NO verdict on empty config: "configured" means the SHOP put data in
  // (certs on the truck or its iron), not merely that a seed template exists. A bare
  // unit used to read NOT ready and log miss_caught, inflating the counters
  // with value SYNNR never delivered.
  const verdict: DispatchComputation["verdict"] =
    j.verdict === "not_ready" ? "not_ready" : j.verdict === "not_setup" ? "not_setup" : "ready";

  // A "Ready" must never quietly mean "nothing was actually checked."
  // Anything this check skipped gets said out loud, on the app page AND on
  // the public proof link.
  const notChecked: string[] = [];
  warnings.push(...notChecked);

  return { unitName: unit.name, yardId: unit.yard_id, jobDate, isFutureJob, verdict, lines, failures, warnings, notChecked };
}
