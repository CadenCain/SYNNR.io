import type { SupabaseClient } from "@supabase/supabase-js";
import { judgeItem, type LineResult } from "./judge";
import { localToday } from "./status";

/**
 * The equipment list: every piece of iron the company tracks, where it is,
 * and the one test date that matters most on it. Four queries in parallel,
 * everything else worked out here, so the home screen, the tag sheet, the
 * export, and the marketing screenshot all read the same rows.
 *
 * A piece of iron is, worst first:
 *   retired   scrapped or sold; kept for the record, out of every count
 *   down      red-tagged or flagged missing
 *   overdue   a test or cert on it is past due, or has no date on file
 *   due       one comes due inside its reminder window (or a retest cert
 *             is on the way)
 *   no_paper  nothing tracked on it yet
 *   ok        everything current
 */

export type EquipState = "retired" | "down" | "overdue" | "due" | "no_paper" | "ok";

export interface EquipNext {
  id: string;
  title: string;
  exp: string | null;
  result: LineResult;
  detail: string;
}

export interface EquipRow {
  id: string;
  name: string;
  category: string;
  identifier: string | null;
  status: string;
  tagToken: string;
  yardId: string | null;
  unitId: string | null;
  unitName: string | null;
  /** "CT-03 · Odessa Yard", "Odessa Yard", or "No location". */
  where: string;
  /** Yard it sits in, directly or on a truck (for the yard filter). */
  yardOf: string | null;
  next: EquipNext | null;
  itemCount: number;
  state: EquipState;
}

export interface EquipmentList {
  rows: EquipRow[];
  yards: { id: string; name: string }[];
  units: { id: string; name: string; yardId: string }[];
  counts: { tracked: number; overdue: number; due: number; down: number; noPaper: number; retired: number };
}

const RANK: Record<LineResult, number> = { expired: 0, missing: 1, pending: 2, due_soon: 3, ok: 4 };
export const STATE_ORDER: Record<EquipState, number> = { down: 0, overdue: 1, due: 2, no_paper: 3, ok: 4, retired: 5 };

export interface RawAsset { id: string; name: string; category: string; identifier: string | null; status: string; yard_id: string | null; unit_id: string | null; tag_token: string }
export interface RawItem { id: string; title: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; parent_id: string }

export async function getEquipment(db: SupabaseClient, companyId: string): Promise<EquipmentList> {
  const [{ data: assetData }, { data: unitData }, { data: yardData }, { data: itemData }] = await Promise.all([
    db.from("saas_assets").select("id, name, category, identifier, status, yard_id, unit_id, tag_token")
      .eq("company_id", companyId).order("name"),
    db.from("saas_units").select("id, name, yard_id").eq("company_id", companyId).order("name"),
    db.from("saas_yards").select("id, name").eq("company_id", companyId).order("name"),
    db.from("saas_compliance_items").select("id, title, expiration_date, reminder_days, pending_until, parent_id")
      .eq("company_id", companyId).eq("parent_type", "asset"),
  ]);
  return buildEquipment({
    assets: (assetData ?? []) as RawAsset[],
    units: (unitData ?? []) as { id: string; name: string; yard_id: string }[],
    yards: (yardData ?? []) as { id: string; name: string }[],
    items: (itemData ?? []) as RawItem[],
  }, localToday());
}

/** The list from raw rows. Pure, so the marketing screenshot runs it too. */
export function buildEquipment(
  raw: { assets: RawAsset[]; units: { id: string; name: string; yard_id: string }[]; yards: { id: string; name: string }[]; items: RawItem[] },
  today: string,
): EquipmentList {
  const { units, yards } = raw;
  const unitById = new Map(units.map((u) => [u.id, u]));
  const yardName = new Map(yards.map((y) => [y.id, y.name]));
  const itemsByAsset = new Map<string, RawItem[]>();
  for (const i of raw.items) {
    const list = itemsByAsset.get(i.parent_id) ?? [];
    list.push(i);
    itemsByAsset.set(i.parent_id, list);
  }

  const rows: EquipRow[] = raw.assets.map((a) => {
    const unit = a.unit_id ? unitById.get(a.unit_id) ?? null : null;
    const yardOf = unit?.yard_id ?? a.yard_id ?? null;
    const where = unit
      ? `${unit.name}${yardName.get(unit.yard_id) ? ` · ${yardName.get(unit.yard_id)}` : ""}`
      : (a.yard_id && yardName.get(a.yard_id)) || "No location";

    const items = itemsByAsset.get(a.id) ?? [];
    const judged = items.map((i) => ({ i, j: judgeItem(i, today, today) }));
    // Worst first; among the current ones, the soonest to come due.
    judged.sort((x, y) => RANK[x.j.result] - RANK[y.j.result]
      || (x.i.expiration_date ?? "").localeCompare(y.i.expiration_date ?? ""));
    const top = judged[0];
    const next: EquipNext | null = top
      ? { id: top.i.id, title: top.i.title, exp: top.i.expiration_date, result: top.j.result, detail: top.j.detail }
      : null;

    let state: EquipState;
    if (a.status === "retired") state = "retired";
    else if (a.status === "out_of_service" || a.status === "missing") state = "down";
    else if (!next) state = "no_paper";
    else if (next.result === "expired" || next.result === "missing") state = "overdue";
    else if (next.result === "due_soon" || next.result === "pending") state = "due";
    else state = "ok";

    return {
      id: a.id, name: a.name, category: a.category, identifier: a.identifier, status: a.status,
      tagToken: a.tag_token, yardId: a.yard_id, unitId: a.unit_id, unitName: unit?.name ?? null,
      where, yardOf, next, itemCount: items.length, state,
    };
  });

  const live = rows.filter((r) => r.state !== "retired");
  const counts = {
    tracked: live.length,
    overdue: live.filter((r) => r.state === "overdue").length,
    due: live.filter((r) => r.state === "due").length,
    down: live.filter((r) => r.state === "down").length,
    noPaper: live.filter((r) => r.state === "no_paper").length,
    retired: rows.length - live.length,
  };

  return { rows, yards, units: units.map((u) => ({ id: u.id, name: u.name, yardId: u.yard_id })), counts };
}

export const STATE_LABEL: Record<EquipState, string> = {
  down: "Red-tagged",
  overdue: "Overdue",
  due: "Due soon",
  no_paper: "No paper yet",
  ok: "Current",
  retired: "Retired",
};

/** Status chip text for one row: red-tagged and missing read differently. */
export function stateLabel(r: Pick<EquipRow, "state" | "status">): string {
  if (r.state === "down") return r.status === "missing" ? "Missing" : "Red-tagged";
  return STATE_LABEL[r.state];
}
