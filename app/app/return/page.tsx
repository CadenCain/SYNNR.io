import { cookies } from "next/headers";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { isWritable } from "@/lib/saas/entitlements";
import { getScanPieces } from "@/lib/saas/scan-pieces";
import { getYardRules } from "@/lib/saas/yard-rules";
import { PageHeader } from "@/components/ui/page-header";
import LockedCard from "../_components/locked-card";
import ReturnScanner from "./return-scanner";
import { myTruckCookie } from "../my-truck";

export const metadata = { title: "Check in tools or loose iron" };

export const dynamic = "force-dynamic";

/** Check loose iron into the yard: a hotshot, the testing company's truck, a pickup. */
export default async function YardReturnPage({ searchParams }: { searchParams: Promise<{ asset?: string }> }) {
  const { asset } = await searchParams;
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: yardRows }, rules] = await Promise.all([
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    getYardRules(db, company.id),
  ]);
  if (!isWritable(company.subscription_status, company.comped)) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader back={{ href: "/app", label: "Load out" }} title="Check in tools or loose iron" />
        <LockedCard owner={company.role === "owner"} what="Check-ins" />
      </div>
    );
  }
  const yards = (yardRows ?? []) as { id: string; name: string }[];
  const firstId = asset && /^[0-9a-f-]{36}$/.test(asset) ? asset : null;
  // Start on the yard the hand is most likely standing in: the yard of the
  // piece they came to check in, else the yard of the truck this phone is on,
  // and only then the first yard by name.
  const myTruck = (await cookies()).get(await myTruckCookie(company.id))?.value ?? null;
  const [{ data: firstRow }, { data: truckRow }, { pieces, outDays }] = await Promise.all([
    firstId ? db.from("saas_assets").select("yard_id, unit_id").eq("company_id", company.id).eq("id", firstId).maybeSingle() : Promise.resolve({ data: null }),
    myTruck && /^[0-9a-f-]{36}$/.test(myTruck) ? db.from("saas_units").select("yard_id").eq("company_id", company.id).eq("id", myTruck).maybeSingle() : Promise.resolve({ data: null }),
    getScanPieces(db, company.id),
  ]);
  const first = firstRow as { yard_id: string | null; unit_id: string | null } | null;
  let firstYard = first?.yard_id ?? null;
  if (!firstYard && first?.unit_id) {
    const { data: u } = await db.from("saas_units").select("yard_id").eq("company_id", company.id).eq("id", first.unit_id).maybeSingle();
    firstYard = (u as { yard_id: string | null } | null)?.yard_id ?? null;
  }
  const known = (id: string | null | undefined) => (id && yards.some((y) => y.id === id) ? id : null);
  const defaultYardId = known(firstYard) ?? known((truckRow as { yard_id: string | null } | null)?.yard_id) ?? yards[0]?.id ?? null;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: "/app", label: "Load out" }} title="Check in tools or loose iron"
        description="For iron that came back without its truck (a hotshot, the testing company, a pickup) and tools signed out to someone. Scan each one or tap It's back, and say where it sits." />
      <ReturnScanner companyId={company.id} truck={null} pieces={pieces} outDays={outDays} yards={yards} defaultYardId={defaultYardId} alertDays={rules.outAlertDays} last4={rules.requireLast4 && !company.is_demo} firstId={firstId} />
    </div>
  );
}
