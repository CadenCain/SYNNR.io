import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment } from "@/lib/saas/equipment";
import EquipmentView, { type Filter, type PlaceFilter } from "@/app/app/_components/equipment-view";
import { getYardRules } from "@/lib/saas/yard-rules";
import { addEquipment } from "./actions";

export const dynamic = "force-dynamic";

const FILTERS = new Set<Filter>(["all", "overdue", "due", "down", "no_paper", "retired"]);
const PLACES = new Set<PlaceFilter>(["out", "out_too_long", "on_truck", "in_yard"]);

/**
 * The equipment list: every piece of iron, where it was logged, and its next
 * test. Data only; the screen lives in EquipmentView so the marketing
 * screenshot is this exact component.
 */
export default async function EquipmentPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string; place?: string }> }) {
  const { company } = await requireCompany();
  const { f, q, place } = await searchParams;
  const db = await saasDb();
  const [list, rules] = await Promise.all([getEquipment(db, company.id), getYardRules(db, company.id)]);
  return (
    <EquipmentView
      list={list}
      companyName={company.name}
      initialFilter={FILTERS.has(f as Filter) ? (f as Filter) : "all"}
      initialQuery={q ?? ""}
      initialPlace={PLACES.has(place as PlaceFilter) ? (place as PlaceFilter) : ""}
      alertDays={rules.outAlertDays}
      addAction={addEquipment}
    />
  );
}
