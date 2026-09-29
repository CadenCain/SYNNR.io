import { buildEquipment, type EquipmentList, type RawAsset, type RawItem } from "@/lib/saas/equipment";
import { DEMO_COMPANY_NAME, DEMO_YARD_NAME, DEMO_UNITS, DEMO_YARD_IRON } from "@/lib/saas/demo-data";
import { addDaysIso, localToday } from "@/lib/saas/status";

/**
 * The marketing-photo dataset: the SAME yard as the drive-it-yourself demo
 * (lib/saas/demo-data.ts), run through the same list-building code as the
 * real home screen. The picture on the homepage and the demo a visitor
 * drives match piece for piece.
 */
export function demoEquipment(): { companyName: string; list: EquipmentList } {
  const today = localToday();
  const yards = [{ id: "y1", name: DEMO_YARD_NAME }];
  const units = DEMO_UNITS.map((u) => ({ id: u.key, name: u.name, yard_id: "y1" }));
  const assets: RawAsset[] = [];
  const items: RawItem[] = [];
  const add = (unitKey: string | null) => (a: (typeof DEMO_YARD_IRON)[number], n: number) => {
    const id = `${unitKey ?? "yard"}-${n}`;
    assets.push({ id, name: a.name, category: a.category, identifier: a.identifier ?? null, status: a.status ?? "in_service", yard_id: "y1", unit_id: unitKey, tag_token: id });
    (a.items ?? []).forEach((it, k) => items.push({
      id: `${id}-${k}`, title: it.title, expiration_date: it.exp === null ? null : addDaysIso(today, it.exp),
      reminder_days: 30, pending_until: null, parent_id: id,
    }));
  };
  for (const u of DEMO_UNITS) (u.assets ?? []).forEach(add(u.key));
  DEMO_YARD_IRON.forEach(add(null));
  return { companyName: DEMO_COMPANY_NAME, list: buildEquipment({ assets, units, yards, items }, today) };
}
