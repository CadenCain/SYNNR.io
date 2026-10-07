import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment, stateLabel } from "@/lib/saas/equipment";
import type { ScanPiece } from "@/lib/saas/loadout";
import { fmtWhen } from "@/lib/saas/format";
import { PageHeader } from "@/components/ui/page-header";
import LoadoutScanner from "./scanner";

export const dynamic = "force-dynamic";

/** Load-out scan for one truck: prove what actually goes on it. */
export default async function LoadoutScanPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const [{ data: unitRow }, list, { data: tagRows }, { data: lastRow }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    getEquipment(db, company.id),
    db.from("saas_assets").select("id, nfc_uid").eq("company_id", company.id).not("nfc_uid", "is", null),
    db.from("saas_loadout_scans").select("finished_at, scanned_by, scanned, expected")
      .eq("company_id", company.id).eq("unit_id", unitId).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const unit = unitRow as { id: string; name: string } | null;
  if (!unit) notFound();

  const extTag = new Map(((tagRows ?? []) as { id: string; nfc_uid: string }[]).map((r) => [r.id, r.nfc_uid]));
  const pieces: ScanPiece[] = list.rows.filter((r) => r.state !== "retired").map((r) => ({
    id: r.id, name: r.name, serial: r.identifier, unitId: r.unitId, where: r.where,
    tagToken: r.tagToken, extTag: extTag.get(r.id) ?? null,
    problem: r.state === "overdue" || r.state === "down" ? "red" : r.state === "due" ? "yellow" : null,
    statusText: r.state === "down" ? stateLabel(r)
      : r.next ? `${r.next.title}: ${r.next.detail}`
      : "No test on file",
  }));
  const last = lastRow as { finished_at: string; scanned_by: string | null; scanned: number; expected: number } | null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        back={{ href: `/app/units/${unit.id}`, label: unit.name }}
        title={`Load-out scan: ${unit.name}`}
        description={last
          ? `Last load-out: ${fmtWhen(last.finished_at)}${last.scanned_by ? ` by ${last.scanned_by}` : ""}, ${last.scanned} of ${last.expected} scanned.`
          : "No load-out scanned on this truck yet."}
      />
      <LoadoutScanner truck={{ id: unit.id, name: unit.name }} pieces={pieces} />
    </div>
  );
}
