import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { isWritable } from "@/lib/saas/entitlements";
import { getScanPieces } from "@/lib/saas/scan-pieces";
import { getYardRules } from "@/lib/saas/yard-rules";
import { fmtWhen } from "@/lib/saas/format";
import { PageHeader } from "@/components/ui/page-header";
import LockedCard from "../../../_components/locked-card";
import ReturnScanner from "../../../return/return-scanner";
import { titled } from "@/lib/saas/page-title";
import { verdictOf, type LoadoutRecord } from "@/lib/saas/loadout-record";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  return titled("saas_units", unitId, (n) => `Check in: ${n}`, "Check in");
}

/** Check a truck back in after a job: what came back, who scanned it, where it went. */
export default async function TruckReturnPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const [{ data: unitRow }, { data: yardRows }, { data: lastOut }, { data: lastBackRow }, rules] = await Promise.all([
    db.from("saas_units").select("id, name, yard_id").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    db.from("saas_loadout_scans").select("id, finished_at, scanned_by, verdict, pieces, not_scanned").eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("saas_returns").select("finished_at").eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    getYardRules(db, company.id),
  ]);
  const unit = unitRow as { id: string; name: string; yard_id: string } | null;
  if (!unit) notFound();
  if (!isWritable(company.subscription_status, company.comped)) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={{ href: `/app/units/${unit.id}`, label: unit.name }} title={`Check in ${unit.name}`} />
        <LockedCard owner={company.role === "owner"} what="Check-ins" />
      </div>
    );
  }
  const last = lastOut as (Pick<LoadoutRecord, "id" | "finished_at" | "verdict" | "pieces" | "not_scanned"> & { scanned_by: string | null }) | null;
  const lastBack = (lastBackRow as { finished_at: string } | null)?.finished_at ?? null;
  const askLeft = askIfItLeft(last?.finished_at ?? null, lastBack);
  // Out on a job by the records (the same rule as the load-out's truckOutNow):
  // its newest load-out rolled (READY, or on a manager's override) and nobody
  // has checked it in since. The hand says it's back before the check-in ends that trip.
  const rolled = last && !(lastBack && Date.parse(lastBack) > Date.parse(last.finished_at));
  const [{ pieces, outDays }, { data: ovRow }] = await Promise.all([
    getScanPieces(db, company.id),
    rolled && verdictOf(last) !== "ready"
      ? db.from("saas_loadout_overrides").select("created_at").eq("company_id", company.id).eq("loadout_id", last.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const outSince = !last || !rolled ? null : verdictOf(last) === "ready" ? last.finished_at : (ovRow as { created_at: string } | null)?.created_at ?? null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: `/app/units/${unit.id}`, label: unit.name }} title={`Check in ${unit.name}`}
        description={last ? `Last loaded out ${fmtWhen(last.finished_at)}${last.scanned_by ? ` by ${last.scanned_by}` : ""}. Scan what came back.` : "Scan what came back."} />
      <ReturnScanner companyId={company.id} truck={{ id: unit.id, name: unit.name }} pieces={pieces} outDays={outDays}
        yards={(yardRows ?? []) as { id: string; name: string }[]} defaultYardId={unit.yard_id} alertDays={rules.outAlertDays} last4={rules.requireLast4 && !company.is_demo}
        askLeft={askLeft} outNow={outSince ? { since: outSince } : null} />
    </div>
  );
}

/**
 * No load-out since this truck was last checked in (and that wasn't earlier
 * the same trip): either it never left the yard or it left without a scan,
 * and only the hand knows which. The same test the check-in's "never scanned
 * out" flag uses (return/actions.ts tripNotScanned).
 */
function askIfItLeft(lastOutAt: string | null, lastBackAt: string | null): { since: string | null } | null {
  if (lastOutAt && !(lastBackAt && lastBackAt > lastOutAt)) return null;
  if (lastBackAt && Date.now() - Date.parse(lastBackAt) < 12 * 3600e3) return null;
  return { since: lastBackAt ? fmtWhen(lastBackAt) : null };
}
