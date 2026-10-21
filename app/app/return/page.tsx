import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { isWritable } from "@/lib/saas/entitlements";
import { getScanPieces } from "@/lib/saas/scan-pieces";
import { getYardRules } from "@/lib/saas/yard-rules";
import { PageHeader } from "@/components/ui/page-header";
import LockedCard from "../_components/locked-card";
import ReturnScanner from "./return-scanner";

export const dynamic = "force-dynamic";

/** Check loose iron into the yard: a hotshot, the testing company's truck, a pickup. */
export default async function YardReturnPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: yardRows }, rules] = await Promise.all([
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    getYardRules(db, company.id),
  ]);
  if (!isWritable(company.subscription_status, company.comped)) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={{ href: "/app", label: "Load out" }} title="Check iron in" />
        <LockedCard owner={company.role === "owner"} what="Check-ins" />
      </div>
    );
  }
  const yards = (yardRows ?? []) as { id: string; name: string }[];
  const { pieces, outDays } = await getScanPieces(db, company.id);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: "/app", label: "Load out" }} title="Check iron in"
        description="For iron that came back without its truck: a hotshot, the testing company, a pickup. Scan it and say where it sits." />
      <ReturnScanner truck={null} pieces={pieces} outDays={outDays} yards={yards} defaultYardId={yards[0]?.id ?? null} alertDays={rules.outAlertDays} demo={company.is_demo} />
    </div>
  );
}
