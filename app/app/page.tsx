import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment } from "@/lib/saas/equipment";
import EquipmentView, { type Filter } from "./_components/equipment-view";
import { addEquipment } from "./equipment/actions";

export const dynamic = "force-dynamic";

const FILTERS = new Set<Filter>(["all", "overdue", "due", "down", "no_paper", "retired"]);

/**
 * Home: every piece of iron, where it is, and its next test. Data only; the
 * screen lives in EquipmentView so the marketing screenshot is this exact
 * component.
 */
export default async function EquipmentHome({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const { company } = await requireCompany();
  const { f, q } = await searchParams;
  const db = await saasDb();
  const list = await getEquipment(db, company.id);
  return (
    <EquipmentView
      list={list}
      companyName={company.name}
      initialFilter={FILTERS.has(f as Filter) ? (f as Filter) : "all"}
      initialQuery={q ?? ""}
      addAction={addEquipment}
    />
  );
}
