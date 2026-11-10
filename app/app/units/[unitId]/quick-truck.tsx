import Link from "next/link";
import { ScanLine, ListTodo, ChevronRight } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { fmtWhen } from "@/lib/saas/format";
import { unitTypeLabel, UNIT_TYPES } from "@/lib/saas/taxonomy";
import { getTruckPlan } from "@/lib/saas/plans";
import { updateUnit, deleteUnit } from "@/app/app/_actions";
import { cn } from "@/lib/utils";

/**
 * A truck in a quick-check yard: how it stood at its last check, one big
 * button to check it, its list, and its recent checks. Nothing about iron,
 * tests, or paper: that's the full check (Settings, Rules).
 */
export default async function QuickTruck({ db, companyId, unit, yardName, yards, manager }: {
  db: SupabaseClient; companyId: string;
  unit: { id: string; name: string; type: string; identifier: string | null; yard_id: string };
  yardName: string | null; yards: { id: string; name: string }[]; manager: boolean;
}) {
  const [{ data: recRows }, { data: kitRow }, { data: backRow }, plan] = await Promise.all([
    db.from("saas_loadout_scans").select("id, finished_at, verdict, scanned_by, reasons").eq("company_id", companyId).eq("unit_id", unit.id)
      .order("finished_at", { ascending: false }).limit(6),
    db.from("saas_packages").select("roll_checks, saas_package_lines(label, qty, sort)").eq("company_id", companyId).eq("unit_id", unit.id).maybeSingle(),
    db.from("saas_returns").select("finished_at, returned_by").eq("company_id", companyId).eq("unit_id", unit.id).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    getTruckPlan(db, companyId, unit.id),
  ]);
  const recs = (recRows ?? []) as { id: string; finished_at: string; verdict: string | null; scanned_by: string | null; reasons: string[] | null }[];
  const kit = kitRow as { roll_checks: string[] | null; saas_package_lines: { label: string; qty: number; sort: number }[] | null } | null;
  const lines = [...(kit?.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort);
  const back = backRow as { finished_at: string; returned_by: string | null } | null;
  const last = recs[0] ?? null;
  const isBack = Boolean(last && back && back.finished_at > last.finished_at);
  const ready = last?.verdict === "ready";
  const fld = "h-11 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: "/app", label: "Trucks" }} title={unit.name} description={`${unitTypeLabel(unit.type)}${yardName ? ` · ${yardName}` : ""}`} />

      <Card className={cn("flex flex-col gap-3 p-4", !last ? "" : isBack ? "" : ready ? "border-emerald-500/40" : "border-red-500/40")}>
        <div className="text-sm">
          {!last ? <span className="text-ink-dim">Not checked yet.</span>
            : isBack ? <span className="text-ink-dim">Back in the yard {fmtWhen(back!.finished_at)}{back!.returned_by ? ` (${back!.returned_by})` : ""}. Last checked {fmtWhen(last.finished_at)}{last.scanned_by ? ` by ${last.scanned_by}` : ""}.</span>
            : <span className={cn("font-semibold", ready ? "text-emerald-400" : "text-red-400")}>{ready ? "READY" : "NOT READY"} at its last check, {fmtWhen(last.finished_at)}{last.scanned_by ? ` by ${last.scanned_by}` : ""}.</span>}
          {last && !isBack && !ready && (last.reasons ?? []).length ? <div className="mt-1 text-red-400">{(last.reasons ?? []).slice(0, 3).join(". ")}</div> : null}
        </div>
        <Link href={`/app/units/${unit.id}/scan`} className={buttonClass("default", "lg", "h-14 text-base")}><ScanLine className="h-5 w-5" /> Check it</Link>
      </Card>

      {plan ? (
        <Card className="flex items-start gap-2 p-4 text-sm">
          <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-bone" />
          <span><span className="font-semibold">Next job:</span> {plan.job ?? "planned"}{plan.leavesAt ? `, leaves ${fmtWhen(plan.leavesAt)}` : ""}{plan.by ? <span className="text-ink-faint"> · {plan.by}</span> : null}</span>
        </Card>
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Its list</h2>
          {manager ? <Link href={`/app/units/${unit.id}/kit`} className="text-sm font-semibold text-bone underline underline-offset-2">Change the list</Link> : null}
        </div>
        {lines.length ? (
          <Card className="flex flex-col divide-y divide-line p-0">
            {lines.map((l) => <div key={`${l.label}-${l.sort}`} className="flex items-center justify-between px-4 py-3 text-sm"><span>{l.label}</span>{l.qty > 1 ? <span className="text-ink-dim">× {l.qty}</span> : null}</div>)}
            {(kit?.roll_checks ?? []).map((c) => <div key={c} className="px-4 py-3 text-sm text-ink-dim">Before it rolls: {c}</div>)}
          </Card>
        ) : <Card className="p-4 text-sm text-amber-400">No list yet.{manager ? " Tap Change the list to set it." : " A manager sets it."}</Card>}
      </section>

      {recs.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Recent checks</h2>
          {recs.map((r) => (
            <Link key={r.id} href={`/app/loadouts/${r.id}`}>
              <Card className="flex items-center gap-3 p-3 hover:border-bone/50">
                <span className={cn("w-24 shrink-0 text-sm font-semibold", r.verdict === "ready" ? "text-emerald-400" : "text-red-400")}>{r.verdict === "ready" ? "READY" : "NOT READY"}</span>
                <span className="min-w-0 flex-1 text-sm text-ink-dim">{fmtWhen(r.finished_at)}{r.scanned_by ? ` · ${r.scanned_by}` : ""}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </section>
      ) : null}

      {manager ? (
        <details className="rounded-2xl border border-line bg-surface">
          <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 text-sm font-semibold text-ink-dim">Truck settings</summary>
          <div className="flex flex-col gap-4 p-4 pt-0">
            <form action={updateUnit} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={unit.id} />
              <label className="text-xs text-ink-faint">Name<input name="name" defaultValue={unit.name} required className={`${fld} mt-1`} /></label>
              <label className="text-xs text-ink-faint">Kind of truck
                <select name="type" defaultValue={unit.type} className={`${fld} mt-1`}>
                  {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></label>
              <input type="hidden" name="identifier" value={unit.identifier ?? ""} />
              {yards.length > 1 ? (
                <label className="text-xs text-ink-faint">Yard
                  <select name="yard_id" defaultValue={unit.yard_id} className={`${fld} mt-1`}>
                    {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select></label>
              ) : null}
              <button type="submit" className={buttonClass("default", "default", "min-h-11 self-start")}>Save</button>
            </form>
            <form action={deleteUnit} className="flex flex-col gap-2 border-t border-line pt-4">
              <input type="hidden" name="id" value={unit.id} />
              <input type="hidden" name="yard_id" value={unit.yard_id} />
              <label className="flex items-center gap-2 text-sm text-ink-dim"><input type="checkbox" required className="h-5 w-5 accent-red-500" /> Delete {unit.name} for good. Its check records stay.</label>
              <button type="submit" className={buttonClass("outline", "default", "min-h-11 self-start text-red-400")}>Delete truck</button>
            </form>
          </div>
        </details>
      ) : null}
    </div>
  );
}
