import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getScanPieces } from "@/lib/saas/scan-pieces";
import { getOpenPlan } from "@/lib/saas/plans";
import { getYardRules } from "@/lib/saas/yard-rules";
import { fmtWhen } from "@/lib/saas/format";
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
  const [{ data: unitRow }, { pieces }, plan, rules, { data: lastRow }, { data: pkgRows }, { data: outRows }, { data: backRow }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    getScanPieces(db, company.id),
    getOpenPlan(db, company.id, unitId),
    getYardRules(db, company.id),
    db.from("saas_loadout_scans").select("finished_at, scanned_by, verdict, packages")
      .eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("saas_packages").select("id, name, unit_id, roll_checks, saas_package_lines(label, qty, sort)")
      .eq("company_id", company.id).or(`unit_id.is.null,unit_id.eq.${unitId}`).order("name"),
    db.from("saas_assets").select("id, out_since").eq("company_id", company.id).eq("unit_id", unitId).not("out_since", "is", null),
    db.from("saas_returns").select("finished_at").eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Marked "still out" at the last check-in: on the last job, not on this truck.
  const lastBack = (backRow as { finished_at: string } | null)?.finished_at ?? null;
  const stillOutIds = ((outRows ?? []) as { id: string; out_since: string }[]).filter((r) => lastBack && r.out_since < lastBack).map((r) => r.id);
  const unit = unitRow as { id: string; name: string } | null;
  if (!unit) notFound();
  if (!isWritable(company.subscription_status, company.comped)) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={{ href: `/app/units/${unit.id}`, label: unit.name }} title={`Load-out scan: ${unit.name}`} />
        <LockedCard owner={company.role === "owner"} />
      </div>
    );
  }

  const last = lastRow as { finished_at: string; scanned_by: string | null; verdict: string | null; packages: string[] | null } | null;
  type Pkg = { id: string; name: string; unit_id: string | null; roll_checks: string[] | null; saas_package_lines: (KitLine & { sort: number })[] | null };
  const linesOf = (x: Pkg): KitLine[] => [...(x.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }));
  const all = (pkgRows ?? []) as Pkg[];
  const kitRow = all.find((x) => x.unit_id === unit.id);
  const packages: PackageOption[] = all.filter((x) => !x.unit_id).map((x) => ({ id: x.id, name: x.name, lines: linesOf(x), checks: x.roll_checks ?? [] }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: `/app/units/${unit.id}`, label: unit.name }}
        title={`Load-out scan: ${unit.name}`}
        description={last
          ? `Last load-out: ${fmtWhen(last.finished_at)}${last.scanned_by ? ` by ${last.scanned_by}` : ""}${last.verdict ? `, ${last.verdict === "ready" ? "READY" : "NOT READY"}` : ""}.`
          : "No load-out scanned on this truck yet."}
      />
      <LoadoutScanner truck={{ id: unit.id, name: unit.name }} pieces={pieces}
        kit={kitRow ? linesOf(kitRow) : []} kitChecks={kitRow?.roll_checks ?? []} packages={packages} stillOutIds={stillOutIds}
        lastPackageIds={packages.filter((x) => (last?.packages ?? []).includes(x.name)).map((x) => x.id)}
        plan={plan ? { by: plan.by, at: fmtWhen(plan.at), note: plan.note, job: plan.job, packageIds: plan.packageIds.filter((id) => packages.some((x) => x.id === id)), lines: plan.lines } : null}
        tagRule={rules.requireTagScan}
        companyId={company.id}
        photoRule={rules.requireLoadoutPhoto ? (company.is_demo ? "optional" : "required") : "off"}
        last4={rules.requireLast4 && !company.is_demo}
        manager={company.role === "owner" || company.role === "admin"} />
    </div>
  );
}
