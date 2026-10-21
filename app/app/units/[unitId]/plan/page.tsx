import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getOpenPlan, planSummary } from "@/lib/saas/plans";
import { fmtWhen } from "@/lib/saas/format";
import { isWritable } from "@/lib/saas/entitlements";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import LockedCard from "../../../_components/locked-card";
import PlanForm from "./plan-form";

export const dynamic = "force-dynamic";

type Pkg = { id: string; name: string; unit_id: string | null; saas_package_lines: { label: string; qty: number; sort: number }[] | null };
const linesOf = (x: Pkg) => [...(x.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }));

/** Plan a truck's next job: the manager says what goes, the hand proves it went. */
export default async function PlanPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const [{ data: unitRow }, { data: pkgRows }, { data: names }, plan] = await Promise.all([
    db.from("saas_units").select("id, name").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    db.from("saas_packages").select("id, name, unit_id, saas_package_lines(label, qty, sort)")
      .eq("company_id", company.id).or(`unit_id.is.null,unit_id.eq.${unitId}`).order("name"),
    db.from("saas_assets").select("name").eq("company_id", company.id).neq("status", "retired").limit(2000),
    getOpenPlan(db, company.id, unitId),
  ]);
  const unit = unitRow as { id: string; name: string } | null;
  if (!unit) notFound();
  const all = (pkgRows ?? []) as Pkg[];
  const kitRow = all.find((x) => x.unit_id === unit.id);
  const packages = all.filter((x) => !x.unit_id).map((x) => ({ id: x.id, name: x.name, lines: linesOf(x) }));
  const pieceNames = [...new Set(((names ?? []) as { name: string }[]).map((n) => n.name.replace(/\s*#\s*\d+\b/g, "").trim()))].sort();
  const manager = company.role === "owner" || company.role === "admin";
  const header = (
    <PageHeader back={{ href: "/app", label: "Load out" }} title={`Plan ${unit.name}'s next job`}
      description={`Pick what the job needs. The hand loading ${unit.name} sees it, can add to it, and can't take anything off. Short means NOT READY.`} />
  );

  if (!isWritable(company.subscription_status, company.comped)) {
    return <div className="flex flex-col gap-5">{header}<LockedCard owner={company.role === "owner"} /></div>;
  }
  if (!manager) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Card className="p-5 text-sm text-ink-dim">
          {plan ? <>Planned by {plan.by ?? "a manager"} {fmtWhen(plan.at)}: {planSummary(plan, new Map(packages.map((x) => [x.id, x.name])))}.{plan.note ? ` "${plan.note}"` : ""}</> : "No plan yet."} A manager sets the plan.
        </Card>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {header}
      <PlanForm truck={unit} kit={kitRow ? linesOf(kitRow) : []} packages={packages} pieceNames={pieceNames}
        initial={plan ? { packageIds: plan.packageIds, lines: plan.lines, note: plan.note ?? "" } : null} />
    </div>
  );
}
