import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplianceStatus } from "./db";
import { localToday, addDaysIso } from "./status";

/**
 * The pre-dispatch check, post scope-cut: a RECORD-CURRENCY check, not a
 * possession check. It answers "will everything on record be current FOR THE
 * JOB, and is it assigned?" —
 *   · every required loadout-template line is on the unit's asset list
 *     (and not flagged missing / out of service)
 *   · every cert/DOT item on the unit and its assets is current THROUGH the
 *     job date (a cert that's fine today but lapses before the job FAILS —
 *     "still active" is not "current for this job")
 *   · every assigned hand's cards are current through the job date
 * It does NOT ask anyone to confirm they're physically holding an item —
 * check-in/check-out was deliberately cut from scope.
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
  result: "ok" | "missing" | "expired";
  detail?: string; // why it failed, human words
}

export interface DispatchComputation {
  unitName: string;
  yardId: string;
  jobDate: string;    // the date checked against (ISO); today if not specified
  isFutureJob: boolean;
  verdict: "ready" | "not_ready" | "not_setup";
  lines: CheckLine[];
  failures: string[]; // named failing lines for banners/alerts
  warnings: string[]; // heads-up (expires shortly after the job)
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export async function computeDispatchCheck(
  db: SupabaseClient,
  companyId: string,
  unitId: string,
  jobDateArg?: string | null,
): Promise<DispatchComputation | null> {
  const today = localToday();
  // Clamp: a job date in the past is meaningless for a pre-dispatch check —
  // fall back to today. Anything today-or-later is honored.
  const jobDate = jobDateArg && jobDateArg >= today ? jobDateArg : today;
  const isFutureJob = jobDate > today;
  const warnHorizon = addDaysIso(jobDate, 21); // "renew soon" heads-up window
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
  type Tpl = { id: string; company_id: string | null; unit_id: string | null; unit_type: string | null };
  const tpls = (templates ?? []) as Tpl[];
  const template =
    tpls.find((t) => t.unit_id === unitId) ??
    tpls.find((t) => t.company_id === companyId && t.unit_type === unit.type) ??
    tpls.find((t) => t.company_id === null && t.unit_type === unit.type) ??
    null;

  const [{ data: tplItems }, { data: assetData }, { data: ucData }] = await Promise.all([
    template
      ? db.from("saas_loadout_items").select("id, label, required, sort").eq("template_id", template.id).order("sort")
      : Promise.resolve({ data: [] }),
    db.from("saas_assets").select("id, name, status").eq("unit_id", unitId).eq("company_id", companyId),
    db.from("saas_unit_crew").select("crew_member_id").eq("unit_id", unitId),
  ]);
  const loadout = (tplItems ?? []) as { id: string; label: string; required: boolean; sort: number }[];
  const assets = (assetData ?? []) as { id: string; name: string; status: string }[];
  const crewIds = ((ucData ?? []) as { crew_member_id: string }[]).map((r) => r.crew_member_id);

  // Certs: unit + its assets + assigned crew
  const assetIds = assets.map((a) => a.id);
  const [{ data: unitCerts }, { data: assetCerts }, { data: crewCerts }, { data: crewNames }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, expiration_date, status, parent_id").eq("parent_type", "unit").eq("parent_id", unitId),
    assetIds.length
      ? db.from("saas_compliance_items_with_status")
          .select("id, title, expiration_date, status, parent_id").eq("parent_type", "asset").in("parent_id", assetIds)
      : Promise.resolve({ data: [] }),
    crewIds.length
      ? db.from("saas_compliance_items_with_status")
          .select("id, title, expiration_date, status, parent_id").eq("parent_type", "crew").in("parent_id", crewIds)
      : Promise.resolve({ data: [] }),
    crewIds.length
      ? db.from("saas_crew_members").select("id, name").in("id", crewIds)
      : Promise.resolve({ data: [] }),
  ]);
  type Cert = { id: string; title: string; expiration_date: string | null; status: ComplianceStatus; parent_id: string };
  const assetName = new Map(assets.map((a) => [a.id, a.name]));
  const crewName = new Map(((crewNames ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const lines: CheckLine[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  // 1) Required loadout lines vs the asset list (record match, not possession)
  const normAssets = assets.map((a) => ({ ...a, n: norm(a.name) }));
  for (const li of loadout) {
    const n = norm(li.label);
    const match = normAssets.find((a) => a.n === n || a.n.includes(n) || n.includes(a.n));
    if (!match) {
      const result = li.required ? "missing" : "ok";
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result, detail: li.required ? "not on the asset list" : "optional — not on the asset list" });
      if (li.required) failures.push(`${li.label} — not on the asset list`);
    } else if (match.status !== "in_service") {
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: li.required ? "missing" : "ok", detail: `${match.name} is flagged ${match.status.replace(/_/g, " ")}` });
      if (li.required) failures.push(`${li.label} — ${match.name} flagged ${match.status.replace(/_/g, " ")}`);
    } else {
      lines.push({ source_type: "loadout_item", source_id: li.id, label: li.label, result: "ok", detail: `on the list (${match.name})` });
    }
  }

  // 2) Assets flagged missing/out of service (even if not on the template)
  for (const a of assets) {
    if (a.status === "missing") {
      lines.push({ source_type: "asset", source_id: a.id, label: a.name, result: "missing", detail: "flagged missing on the asset list" });
      failures.push(`${a.name} — flagged missing`);
    }
  }

  // 3) Paper — unit + asset certs, evaluated against the JOB DATE.
  //    A cert that's unexpired today but lapses before the job FAILS: "still
  //    active" is not "current for this job" (the whole point of Q1).
  const pushCert = (c: Cert, label: string, sourceType: "cert" | "crew_cert") => {
    if (c.expiration_date === null) {
      lines.push({ source_type: sourceType, source_id: c.id, label, result: "missing", detail: "no expiration on file" });
      failures.push(`${label} — no expiration on file`);
    } else if (c.expiration_date < jobDate) {
      // lapsed by the job. Word it by whether the job is today or future.
      const detail = isFutureJob
        ? `expires ${c.expiration_date} — before the ${jobDate} job`
        : `expired ${c.expiration_date}`;
      lines.push({ source_type: sourceType, source_id: c.id, label, result: "expired", detail });
      failures.push(isFutureJob ? `${label} — expires ${c.expiration_date}, before the job` : `${label} — expired`);
    } else {
      // current through the job. Heads-up if it lapses shortly after.
      lines.push({ source_type: sourceType, source_id: c.id, label, result: "ok", detail: `good to ${c.expiration_date}` });
      if (c.expiration_date <= warnHorizon) {
        warnings.push(isFutureJob
          ? `${label} — expires ${c.expiration_date}, just after the job. Renew soon.`
          : `${label} — due soon (${c.expiration_date})`);
      }
    }
  };
  for (const c of (unitCerts ?? []) as Cert[]) pushCert(c, c.title, "cert");
  for (const c of (assetCerts ?? []) as Cert[]) pushCert(c, `${c.title} (${assetName.get(c.parent_id) ?? "asset"})`, "cert");
  for (const c of (crewCerts ?? []) as Cert[]) pushCert(c, `${c.title} — ${crewName.get(c.parent_id) ?? "crew"}`, "crew_cert");

  // NO Ready on empty config: a check with nothing to check is not a pass.
  const configured = lines.length > 0;
  const verdict: DispatchComputation["verdict"] = !configured ? "not_setup" : failures.length > 0 ? "not_ready" : "ready";

  return { unitName: unit.name, yardId: unit.yard_id, jobDate, isFutureJob, verdict, lines, failures, warnings };
}
