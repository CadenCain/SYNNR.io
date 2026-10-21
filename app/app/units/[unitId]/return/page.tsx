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

export const dynamic = "force-dynamic";

/** Check a truck back in after a job: what came back, who scanned it, where it went. */
export default async function TruckReturnPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const [{ data: unitRow }, { data: yardRows }, { data: lastOut }, rules] = await Promise.all([
    db.from("saas_units").select("id, name, yard_id").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    db.from("saas_loadout_scans").select("finished_at, scanned_by").eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
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
  const { pieces, outDays } = await getScanPieces(db, company.id);
  const last = lastOut as { finished_at: string; scanned_by: string | null } | null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: `/app/units/${unit.id}`, label: unit.name }} title={`Check in ${unit.name}`}
        description={last ? `Last loaded out ${fmtWhen(last.finished_at)}${last.scanned_by ? ` by ${last.scanned_by}` : ""}. Scan what came back.` : "Scan what came back."} />
      <ReturnScanner truck={{ id: unit.id, name: unit.name }} pieces={pieces} outDays={outDays}
        yards={(yardRows ?? []) as { id: string; name: string }[]} defaultYardId={unit.yard_id} alertDays={rules.outAlertDays} demo={company.is_demo} />
    </div>
  );
}
