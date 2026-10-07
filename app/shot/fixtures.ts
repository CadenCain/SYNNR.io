import { buildEquipment, type EquipmentList, type RawAsset, type RawItem } from "@/lib/saas/equipment";
import { DEMO_COMPANY_NAME, DEMO_YARD_NAME, DEMO_UNITS, DEMO_YARD_IRON } from "@/lib/saas/demo-data";
import { addDaysIso, localToday } from "@/lib/saas/status";
import { judgeUnit, withSerial } from "@/lib/saas/judge";
import type { UnitTile } from "@/lib/saas/readiness";

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
    assets.push({ id, name: a.name, category: a.category, identifier: a.identifier ?? null, status: a.status ?? "in_service", yard_id: "y1", unit_id: unitKey, tag_token: id, last_seen_where: a.note ?? null });
    (a.items ?? []).forEach((it, k) => items.push({
      id: `${id}-${k}`, title: it.title, expiration_date: it.exp === null ? null : addDaysIso(today, it.exp),
      reminder_days: 30, pending_until: null, parent_id: id,
    }));
  };
  for (const u of DEMO_UNITS) (u.assets ?? []).forEach(add(u.key));
  DEMO_YARD_IRON.forEach(add(null));
  return { companyName: DEMO_COMPANY_NAME, list: buildEquipment({ assets, units, yards, items }, today) };
}

/** The demo yard's trucks, judged by the same rules as the real Trucks page. */
export function demoTrucks(): UnitTile[] {
  const today = localToday();
  const d = (n: number | null) => (n === null ? null : addDaysIso(today, n));
  return DEMO_UNITS.map((u) => {
    const assets = (u.assets ?? []).map((a, n) => ({ id: `${u.key}-${n}`, name: withSerial(a.name, a.identifier), status: a.status ?? "in_service" }));
    const j = judgeUnit({
      unitItems: (u.items ?? []).map((it, k) => ({ id: `${u.key}-u${k}`, title: it.title, expiration_date: d(it.exp), reminder_days: 30 })),
      assets,
      assetItems: (u.assets ?? []).flatMap((a, n) => (a.items ?? []).map((it, k) => ({
        id: `${u.key}-${n}-${k}`, title: it.title, expiration_date: d(it.exp), reminder_days: 30, parent_id: `${u.key}-${n}`,
      }))),
      crew: [], crewItems: [],
    }, today, today);
    return { id: u.key, yardId: "y1", name: u.name, type: u.type, yardName: DEMO_YARD_NAME, state: j.verdict, why: j.why, crewWorst: null };
  });
}
