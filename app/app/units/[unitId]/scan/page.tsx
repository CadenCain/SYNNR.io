import { notFound } from "next/navigation";
import { localToday } from "@/lib/saas/status";
import { judgeItem, isNoPaper } from "@/lib/saas/judge";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getScanPieces } from "@/lib/saas/scan-pieces";
import { getOpenPlan } from "@/lib/saas/plans";
import { getYardRules } from "@/lib/saas/yard-rules";
import { fmtWhen } from "@/lib/saas/format";
import { readAll } from "@/lib/saas/read-all";
import { verdictOf, type LoadoutRecord } from "@/lib/saas/loadout-record";
import { PageHeader } from "@/components/ui/page-header";
import LoadoutScanner, { type KitLine, type PackageOption } from "./scanner";
import LockedCard from "../../../_components/locked-card";
import { isWritable } from "@/lib/saas/entitlements";
import { titled } from "@/lib/saas/page-title";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return titled("saas_units", unitId, (n) => `Load-out: ${n}`, "Load-out");
}

/** Load-out scan for one truck: prove what actually goes on it. */
export default async function LoadoutScanPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const [{ data: unitRow }, { pieces }, plan, rules, { data: lastRow }, { data: pkgRows }, { data: outRows }, { data: backRow }, { data: paperRows }, { data: taggedRows, error: taggedErr }] = await Promise.all([
    db.from("saas_units").select("id, name, yard_id").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    getScanPieces(db, company.id),
    getOpenPlan(db, company.id, unitId),
    getYardRules(db, company.id),
    db.from("saas_loadout_scans").select("id, finished_at, scanned_by, verdict, packages, pieces, not_scanned")
      .eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("saas_packages").select("id, name, unit_id, roll_checks, saas_package_lines(label, qty, sort)")
      .eq("company_id", company.id).or(`unit_id.is.null,unit_id.eq.${unitId}`).order("name"),
    db.from("saas_assets").select("id, out_since").eq("company_id", company.id).eq("unit_id", unitId).not("out_since", "is", null),
    db.from("saas_returns").select("finished_at").eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    // The truck's own paper (DOT and the like): the save blocks on it, so the phone says so up front.
    db.from("saas_compliance_items").select("id, title, expiration_date, reminder_days, pending_until, last_upload_id")
      .eq("company_id", company.id).eq("parent_type", "unit").eq("parent_id", unitId),
    // Has anything here ever been read off a tag? If not, an NFC phone checks pieces off like an iPhone.
    db.from("saas_assets").select("id").eq("company_id", company.id).or("tag_seen_at.not.is.null,nfc_uid.not.is.null").limit(1),
  ]);
  const today = localToday();
  const truckPaper = ((paperRows ?? []) as { id: string; title: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null }[])
    .map((it) => ({ it, r: judgeItem(it, today, today) }))
    .filter((x) => x.r.result === "expired" || x.r.result === "missing")
    .map((x) => ({ title: x.it.title, detail: isNoPaper(x.r) ? "has no cert attached" : x.r.detail }));
  // Marked "still out" at the last check-in: on the last job, not on this truck.
  const lastBack = (backRow as { finished_at: string } | null)?.finished_at ?? null;
  const stillOutIds = ((outRows ?? []) as { id: string; out_since: string }[]).filter((r) => lastBack && r.out_since < lastBack).map((r) => r.id);
  const unit = unitRow as { id: string; name: string; yard_id: string | null } | null;
  if (!unit) notFound();
  if (!isWritable(company.subscription_status, company.comped)) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={{ href: `/app/units/${unit.id}`, label: unit.name }} title={`Load-out: ${unit.name}`} />
        <LockedCard owner={company.role === "owner"} />
      </div>
    );
  }

  const last = lastRow as (Pick<LoadoutRecord, "id" | "finished_at" | "verdict" | "pieces" | "not_scanned"> & { scanned_by: string | null; packages: string[] | null }) | null;
  // Out on a job by the records (the same rule as finishLoadout): its newest
  // load-out rolled (READY, or on a manager's override) and nobody has
  // checked it in since. The hand says it's back before loading it out.
  // And which spares are in this truck's yard (on its racks, or on a truck
  // parked there), so the phone points a hand at the nearest one first.
  const rolled = last && !(lastBack && Date.parse(lastBack) > Date.parse(last.finished_at));
  const [{ data: ovRow }, { data: yardUnits }, yardSpares] = await Promise.all([
    rolled && verdictOf(last) !== "ready"
      ? db.from("saas_loadout_overrides").select("created_at").eq("company_id", company.id).eq("loadout_id", last.id).maybeSingle()
      : Promise.resolve({ data: null }),
    unit.yard_id ? db.from("saas_units").select("id").eq("company_id", company.id).eq("yard_id", unit.yard_id) : Promise.resolve({ data: [] }),
    unit.yard_id
      ? readAll<{ id: string }>((a, b) => db.from("saas_assets").select("id", { count: "exact" }).eq("company_id", company.id).eq("yard_id", unit.yard_id as string).is("unit_id", null).neq("status", "retired").order("id").range(a, b))
      : Promise.resolve([] as { id: string }[]),
  ]);
  const outSince = !last || !rolled ? null : verdictOf(last) === "ready" ? last.finished_at : (ovRow as { created_at: string } | null)?.created_at ?? null;
  const truckOut = last && outSince ? { since: outSince, sinceText: fmtWhen(outSince), by: last.scanned_by } : null;
  const nearTrucks = new Set(((yardUnits ?? []) as { id: string }[]).map((u) => u.id));
  const nearSpares = new Set(yardSpares.map((r) => r.id));
  const phonePieces = pieces.map((p) => ({ ...p, near: p.unitId ? nearTrucks.has(p.unitId) : nearSpares.has(p.id) }));
  type Pkg = { id: string; name: string; unit_id: string | null; roll_checks: string[] | null; saas_package_lines: (KitLine & { sort: number })[] | null };
  const linesOf = (x: Pkg): KitLine[] => [...(x.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }));
  const all = (pkgRows ?? []) as Pkg[];
  const kitRow = all.find((x) => x.unit_id === unit.id);
  const packages: PackageOption[] = all.filter((x) => !x.unit_id).map((x) => ({ id: x.id, name: x.name, lines: linesOf(x), checks: x.roll_checks ?? [] }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: `/app/units/${unit.id}`, label: unit.name }}
        title={`Load-out: ${unit.name}`}
        description={last
          ? `Last load-out: ${fmtWhen(last.finished_at)}${last.scanned_by ? ` by ${last.scanned_by}` : ""}${last.verdict ? `, ${last.verdict === "ready" ? "READY" : "NOT READY"}` : ""}.`
          : "No load-out scanned on this truck yet."}
      />
      <LoadoutScanner truck={{ id: unit.id, name: unit.name }} pieces={phonePieces}
        kit={kitRow ? linesOf(kitRow) : []} kitChecks={kitRow?.roll_checks ?? []} packages={packages} stillOutIds={stillOutIds} truckPaper={truckPaper}
        lastPackageIds={packages.filter((x) => (last?.packages ?? []).includes(x.name)).map((x) => x.id)}
        plan={plan ? { id: plan.id, by: plan.by, at: fmtWhen(plan.at), note: plan.note, job: plan.job, packageIds: plan.packageIds.filter((id) => packages.some((x) => x.id === id)), lines: plan.lines } : null}
        truckOut={truckOut}
        noTagsInUse={!taggedErr && (taggedRows ?? []).length === 0}
        tagRule={rules.requireTagScan}
        companyId={company.id}
        photoRule={rules.requireLoadoutPhoto ? (company.is_demo ? "optional" : "required") : "off"}
        last4={rules.requireLast4 && !company.is_demo}
        manager={company.role === "owner" || company.role === "admin"} />
    </div>
  );
}
