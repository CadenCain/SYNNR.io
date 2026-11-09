import type { SupabaseClient } from "@supabase/supabase-js";
import { localToday } from "./status";
import { judgeUnit, FAILING_GEAR, plainDate, withSerial, type JItem } from "./judge";
import { fmtWhen } from "./format";
import { verdictOf, reasonsOf, type LoadoutRecord } from "./loadout-record";
import { expectedLines, fillLines, shortLines, lineMatches, lineSourceLabel, pieceLabel, type ExpectedLine, type LinePiece } from "./loadout-lines";
import { cleanPlanLines } from "./plans";
import { readAll } from "./read-all";

/**
 * The readiness check: a RECORD-CURRENCY check, not a dispatch checklist.
 * It answers "will everything on record be current FOR THE JOB, and is it
 * assigned?" —
 *   · every cert/DOT item on the unit and its assets is current THROUGH the
 *     job date (a cert that's fine today but lapses before the job FAILS —
 *     "still active" is not "current for this job")
 *   · every assigned hand's cards are current through the job date
 *   · any asset the shop has FLAGGED missing / out of service fails
 *   · the truck's newest load-out came back NOT READY and nobody rolled it
 *     (the same "blocked" the board and the truck proof show)
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
  /** The truck's newest load-out and where it left the truck. Null if it was never loaded out. */
  loadout: TruckLoadout | null;
  /** Lines of the manager's plan the yard can't fill with good iron (also in warnings). */
  planShort: string[];
}

/** A manager can roll a NOT READY load-out only this long after it was saved:
 *  an override covers what's on the truck now, and a load-out is one shift's
 *  work (the scan refuses to save one started more than 20 hours ago too). */
export const ROLL_WINDOW_MS = 20 * 3600e3;
export const canStillRoll = (finishedAt: string, now: number = Date.now()) => now - Date.parse(finishedAt) <= ROLL_WINDOW_MS;

/**
 * The truck's newest load-out, read the way the board and the operator's
 * truck proof read it:
 *   blocked  came back NOT READY, nobody rolled it, not checked in since
 *   out      rolled (READY, or on a manager's override), not checked in since
 *   back     checked back in since
 */
export interface TruckLoadout {
  id: string;
  finishedAt: string;
  scannedBy: string | null;
  reasons: string[];
  state: "blocked" | "out" | "back";
  /** Blocked, and from this shift: a manager can still roll it from its record. */
  rollable: boolean;
}

export async function truckLoadout(db: SupabaseClient, companyId: string, unitId: string, now: number = Date.now()): Promise<TruckLoadout | null> {
  const { data } = await db.from("saas_loadout_scans").select("id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned")
    .eq("company_id", companyId).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle();
  const lo = data as Pick<LoadoutRecord, "id" | "finished_at" | "scanned_by" | "verdict" | "reasons" | "pieces" | "not_scanned"> | null;
  if (!lo) return null;
  const [{ data: ov }, { data: back }] = await Promise.all([
    db.from("saas_loadout_overrides").select("loadout_id").eq("company_id", companyId).eq("loadout_id", lo.id).maybeSingle(),
    db.from("saas_returns").select("finished_at").eq("company_id", companyId).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const backAt = (back as { finished_at: string } | null)?.finished_at ?? null;
  const isBack = Boolean(backAt && Date.parse(backAt) > Date.parse(lo.finished_at));
  const blocked = !isBack && !ov && verdictOf(lo) === "not_ready";
  return {
    id: lo.id, finishedAt: lo.finished_at, scannedBy: lo.scanned_by, reasons: reasonsOf(lo),
    state: isBack ? "back" : blocked ? "blocked" : "out",
    rollable: blocked && canStillRoll(lo.finished_at, now),
  };
}

/**
 * What the manager's plan takes from the yard that the yard can't give. The
 * truck's own iron fills the kit and the plan first (same matching as the
 * load-out, so a package's swivel is a second swivel, not the kit's); any
 * planned line still short needs good iron sitting free in the truck's yard.
 * One heads-up per line nobody can fill, naming a bad piece that would have
 * fit. Kit lines are left out: the kit already warns on its own. Pure.
 */
export function planShortInYard(input: {
  lines: ExpectedLine[];
  truck: LinePiece[];
  /** Free iron in the yard. bad: why it can't go, or null if it can. */
  yard: (LinePiece & { bad: string | null })[];
}): string[] {
  const good = input.yard.filter((p) => !p.bad);
  return shortLines(fillLines(input.lines, [...input.truck, ...good]))
    .filter((l) => l.source !== "kit")
    .map((l) => {
      const need = l.qty - l.filled.length;
      const badOne = input.yard.find((p) => p.bad && lineMatches(l.label, p.name));
      return `${lineSourceLabel(l)} needs ${l.label}${need > 1 ? ` (${need} more)` : ""}. No good one on the truck or free in the yard`
        + `${badOne ? `. The yard's ${pieceLabel(badOne)}: ${badOne.bad}` : ""}. The load-out will block without it.`;
    });
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

  // The truck's kit (what every load-out on it checks against). Here it's a
  // heads-up against what's logged on the truck; the load-out scan is where
  // a short kit blocks the truck.
  const { data: kitRow } = await db.from("saas_packages").select("id").eq("company_id", companyId).eq("unit_id", unitId).maybeSingle();
  const kitId = (kitRow as { id: string } | null)?.id ?? null;

  // Equipment only: the truck's own paper and the iron on it. Retired iron
  // (scrapped or sold) isn't on the truck in any way that counts.
  const [{ data: tplItems }, { data: assetData }] = await Promise.all([
    kitId
      ? db.from("saas_package_lines").select("id, label, qty, sort").eq("package_id", kitId).order("sort")
      : Promise.resolve({ data: [] }),
    db.from("saas_assets").select("id, name, identifier, status, category, needs_redress_since").eq("unit_id", unitId).eq("company_id", companyId).neq("status", "retired"),
  ]);
  const loadout = ((tplItems ?? []) as { id: string; label: string; qty?: number | null; sort: number }[]).map((l) => ({ ...l, required: true }));
  const rawAssets = (assetData ?? []) as { id: string; name: string; identifier: string | null; status: string; category: string; needs_redress_since: string | null }[];
  const assets = rawAssets.map((a) => ({ ...a, name: withSerial(a.name, a.identifier) }));

  // Certs: the unit + its iron
  const assetIds = assets.map((a) => a.id);
  const COLS = "id, title, expiration_date, pending_until, reminder_days, parent_id, last_upload_id";
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

  // 1) The kit vs the asset book. Here the kit is a REFERENCE, not a gate:
  //    a line that simply isn't in the book yet is a heads-up, never a
  //    failure. Gear that IS flagged missing or red-tagged fails the truck
  //    through the rules below, whether or not it's on the list.
  for (const li of loadout) {
    const match = matchAssetForLine(li.label, assets);
    if (!match) {
      // A required line that isn't in the book must not wear green: a hand
      // scanning chips saw six OKs on a truck that wasn't ready.
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: li.required ? "warn" : "ok", detail: li.required ? "not in the asset book yet" : "optional, not in the asset book" });
      if (li.required) warnings.push(`${li.label} is on ${unit.name}'s kit but isn't logged on the truck. The load-out scan will block it if it isn't scanned on.`);
    } else if (FAILING_GEAR.has(match.status)) {
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: "missing", detail: `${match.name} is flagged ${match.status === "out_of_service" ? "red-tagged" : "missing"}` });
    } else if (match.needs_redress_since) {
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: "missing", detail: `${match.name} needs redress` });
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
        : l.result === "missing" ? `${l.label}: ${l.detail}`
        : isFutureJob && l.expiration_date && l.expiration_date >= today ? `${l.label}: expires ${plainDate(l.expiration_date)}, before the job`
        : `${l.label}: expired`);
    }
  }

  // NO verdict on empty config: "configured" means the SHOP put data in
  // (certs on the truck or its iron), not merely that a seed template exists. A bare
  // unit used to read NOT ready and log miss_caught, inflating the counters
  // with value SYNNR never delivered.
  let verdict: DispatchComputation["verdict"] =
    j.verdict === "not_ready" ? "not_ready" : j.verdict === "not_setup" ? "not_setup" : "ready";

  // The newest load-out came back NOT READY, nobody rolled it, and it hasn't
  // been checked back in: the truck is blocked, whatever its paper says. The
  // board and the operator's truck proof already say so; green here would
  // have the office telling the yard "the app says it's ready".
  const lo = await truckLoadout(db, companyId, unitId);
  if (lo?.state === "blocked") {
    verdict = "not_ready";
    const why = lo.reasons.length ? `${lo.reasons[0]}${lo.reasons.length > 1 ? ` (and ${lo.reasons.length - 1} more)` : ""}` : "NOT READY";
    lines.unshift({ source_type: "loadout_item", source_id: lo.id, label: `Load-out ${fmtWhen(lo.finishedAt)}${lo.scannedBy ? ` by ${lo.scannedBy}` : ""}`, result: "missing", detail: `NOT READY: ${why}` });
    failures.unshift(`Blocked at load-out ${fmtWhen(lo.finishedAt)}: ${why}. ${lo.rollable ? "Fix it and scan again, or a manager rolls it from the load-out record." : "Scan it again."}`);
  }

  // The manager's plan for the next job: what it takes from the yard on top
  // of the truck's own iron, and whether the yard has good iron free to give.
  const planShort: string[] = [];
  if (verdict !== "not_setup") {
    const bad = new Set<string>();
    const certParent = new Map(((assetCerts ?? []) as JItem[]).map((c) => [c.id, c.parent_id ?? ""]));
    for (const f of j.failures) bad.add(f.kind === "asset" ? f.id : certParent.get(f.id) ?? "");
    const truck = rawAssets.filter((a) => !bad.has(a.id)).map((a) => ({ id: a.id, name: a.name, serial: a.identifier }));
    planShort.push(...await planWarnings(db, companyId, unit, jobDate, today, loadout.map((l) => ({ label: l.label, qty: l.qty ?? 1 })), truck));
    warnings.push(...planShort);
  }

  // A "Ready" must never quietly mean "nothing was actually checked."
  // Anything this check skipped gets said out loud, on the app page AND on
  // the public proof link.
  const notChecked: string[] = [];
  warnings.push(...notChecked);

  // The load-out scan is the proof of what's actually on the truck. Say so
  // when nobody has scanned this truck today; it's a heads-up, not a fail
  // (the records can still be current without a scan). A blocked one
  // already says "scan it again".
  if (verdict !== "not_setup" && lo?.state !== "blocked") {
    const at = lo?.finishedAt ?? null;
    const scannedToday = at && new Date(at).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }) === today;
    if (!scannedToday) warnings.push("Nobody has scanned this truck's load-out today. Scan it as it's loaded so you know what's actually on it.");
  }

  return { unitName: unit.name, yardId: unit.yard_id, jobDate, isFutureJob, verdict, lines, failures, warnings, notChecked, loadout: lo, planShort };
}

/**
 * The truck's open plan, if a manager set one, checked against the yard (see
 * planShortInYard). Free iron is the yard's iron on no truck, not out on a
 * job or signed out to someone, judged as of the job date (or the day the
 * plan leaves, if that's later). Nothing to read when there's no plan.
 */
async function planWarnings(
  db: SupabaseClient,
  companyId: string,
  unit: { id: string; yard_id: string },
  jobDate: string,
  today: string,
  kit: { label: string; qty: number }[],
  truck: LinePiece[],
): Promise<string[]> {
  // One open plan per truck (a unique index), and saving it again re-dates it,
  // so it's the newest one.
  const { data: planRows } = await db.from("saas_loadout_plans").select("package_ids, lines, leaves_at, used_at")
    .eq("company_id", companyId).eq("unit_id", unit.id).order("created_at", { ascending: false }).limit(5);
  const plan = ((planRows ?? []) as { package_ids: string[] | null; lines: unknown[] | null; leaves_at: string | null; used_at: string | null }[])
    .find((p) => !p.used_at);
  const pkgIds = plan?.package_ids ?? [];
  const planned = cleanPlanLines(plan?.lines ?? []);
  if (!plan || (!pkgIds.length && !planned.length)) return [];

  const { data: pkgRows } = pkgIds.length
    ? await db.from("saas_packages").select("id, name, saas_package_lines(label, qty, sort)").eq("company_id", companyId).in("id", pkgIds)
    : { data: [] };
  const packages = ((pkgRows ?? []) as { name: string; saas_package_lines: { label: string; qty: number; sort: number }[] | null }[])
    .map((p) => ({ name: p.name, lines: [...(p.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty })) }));
  const lines = expectedLines({ kit, packages, planned, quick: [] });
  // The truck alone fills it: nothing to take from the yard.
  const short = shortLines(fillLines(lines, truck)).filter((l) => l.source !== "kit");
  if (!short.length) return [];

  const yardRows = await readAll<{ id: string; name: string; identifier: string | null; status: string; category: string; needs_redress_since: string | null; out_since: string | null; out_with_user: string | null }>((a, b) =>
    db.from("saas_assets").select("id, name, identifier, status, category, needs_redress_since, out_since, out_with_user", { count: "exact" })
      .eq("company_id", companyId).eq("yard_id", unit.yard_id).is("unit_id", null).neq("status", "retired").order("id").range(a, b));
  const fits = yardRows.filter((a) => !a.out_since && !a.out_with_user && short.some((l) => lineMatches(l.label, a.name))).slice(0, 200);
  const { data: certRows } = fits.length
    ? await db.from("saas_compliance_items_with_status").select("id, title, expiration_date, pending_until, reminder_days, parent_id, last_upload_id")
        .eq("company_id", companyId).eq("parent_type", "asset").in("parent_id", fits.map((a) => a.id))
    : { data: [] };
  const certs = (certRows ?? []) as JItem[];
  const planDay = plan.leaves_at ? localToday(new Date(plan.leaves_at)) : jobDate;
  const asOf = planDay > jobDate ? planDay : jobDate;
  const yard = fits.map((a) => {
    const mine = certs.filter((c) => c.parent_id === a.id);
    const f = judgeUnit({ unitItems: [], assets: [a], assetItems: mine, crew: [], crewItems: [] }, asOf, today).failures[0];
    const bad = !f ? null : f.kind === "asset" ? f.detail : `${mine.find((c) => c.id === f.id)?.title ?? "test"} ${f.detail}`;
    return { id: a.id, name: a.name, serial: a.identifier, bad };
  });
  return planShortInYard({ lines, truck, yard });
}
