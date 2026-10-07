import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment } from "@/lib/saas/equipment";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import YardMap from "@/app/app/_components/yard-map";

export const dynamic = "force-dynamic";

/** Every truck and rack in the yard, and the iron on it, colored by status. */
export default async function YardMapPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [list, rd] = await Promise.all([getEquipment(db, company.id), getCompanyReadiness(db, company.id)]);
  return <YardMap rows={list.rows} trucks={rd.units} yards={list.yards} />;
}
