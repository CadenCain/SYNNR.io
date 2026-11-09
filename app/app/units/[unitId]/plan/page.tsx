import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getTruckPlan, planSummary, planTiming, rolledSince, PLAN_AHEAD_MS } from "@/lib/saas/plans";
import { fmtWhen } from "@/lib/saas/format";
import { isWritable } from "@/lib/saas/entitlements";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import LockedCard from "../../../_components/locked-card";
import PlanForm from "./plan-form";
import { titled } from "@/lib/saas/page-title";

export const dynamic = "force-dynamic";

type Pkg = { id: string; name: string; unit_id: string | null; saas_package_lines: { label: string; qty: number; sort: number }[] | null };
const clock = () => Date.now();
const linesOf = (x: Pkg) => [...(x.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }));

export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return titled("saas_units", unitId, (n) => `Plan: ${n}`, "Plan next job");
}

/** Plan a truck's next job: the manager says what goes, the hand proves it went. */
export default async function PlanPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const now = clock();
  const [{ data: unitRow }, { data: pkgRows }, { data: names }, plan, rolled, { data: backRow }, { data: truckRows }, { data: planRows }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    db.from("saas_packages").select("id, name, unit_id, saas_package_lines(label, qty, sort)")
      .eq("company_id", company.id).or(`unit_id.is.null,unit_id.eq.${unitId}`).order("name"),
    db.from("saas_assets").select("name").eq("company_id", company.id).neq("status", "retired").limit(2000),
    getTruckPlan(db, company.id, unitId),
    // Rolled in the last 12 hours: a plan made now is for its next job.
    rolledSince(db, company.id, unitId, new Date(now - 12 * 3600e3).toISOString()),
    db.from("saas_returns").select("finished_at").eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    // Where the plan can move if the job goes on another truck.
    db.from("saas_units").select("id, name").eq("company_id", company.id).order("name"),
    db.from("saas_loadout_plans").select("unit_id").eq("company_id", company.id).is("used_at", null),
  ]);
  const unit = unitRow as { id: string; name: string } | null;
  if (!unit) notFound();
  const back = (backRow as { finished_at: string } | null)?.finished_at ?? null;
  const gone = rolled && !(back && Date.parse(back) > Date.parse(rolled.at)) ? rolled : null;
  const timing = plan ? planTiming(plan, now) : null;
  const planned = new Set(((planRows ?? []) as { unit_id: string }[]).map((r) => r.unit_id));
  const otherTrucks = ((truckRows ?? []) as { id: string; name: string }[]).filter((t) => t.id !== unitId).map((t) => ({ id: t.id, name: t.name, hasPlan: planned.has(t.id) }));
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
          {plan ? <>Planned by {plan.by ?? "a manager"} {fmtWhen(plan.at)}{plan.leavesAt ? `, leaves ${fmtWhen(plan.leavesAt)}` : ""}: {planSummary(plan, new Map(packages.map((x) => [x.id, x.name])))}.{plan.note ? ` "${plan.note}"` : ""}</> : "No plan yet."} A manager sets the plan.
        </Card>
      </div>
    );
  }
  const notes = [
    gone ? `${unit.name} already rolled, loaded out${gone.by ? ` by ${gone.by}` : ""} ${fmtWhen(gone.at)}. A plan you save now is for its next job.` : null,
    plan?.leavesAt && timing === "old" ? `This plan was for ${fmtWhen(plan.leavesAt)}, more than a day ago, and ${unit.name} never rolled on it. It doesn't lock a load-out any more. Set a new time and save it, or clear it.` : null,
    plan?.leavesAt && timing === "later" ? `This plan is for ${fmtWhen(plan.leavesAt)}. A load-out on ${unit.name} before ${fmtWhen(new Date(Date.parse(plan.leavesAt) - PLAN_AHEAD_MS).toISOString())} doesn't use it, and the plan stays open.` : null,
  ].filter((n): n is string => Boolean(n));
  return (
    <div className="flex flex-col gap-5">
      {header}
      {notes.map((n) => <div key={n} className="break-words rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">{n}</div>)}
      <PlanForm truck={unit} kit={kitRow ? linesOf(kitRow) : []} packages={packages} pieceNames={pieceNames} seenAt={new Date(now).toISOString()} otherTrucks={otherTrucks}
        initial={plan ? { packageIds: plan.packageIds, lines: plan.lines, note: plan.note ?? "", job: plan.job ?? "", leavesAt: plan.leavesAt } : null} />
    </div>
  );
}
