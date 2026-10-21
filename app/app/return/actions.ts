"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { YARD_TZ } from "@/lib/saas/format";
import { judgeItem } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { daysOut } from "@/lib/saas/whereabouts";
import type { ScanHow } from "@/lib/saas/loadout";

export type ReturnDest = "truck" | "yard";
type Outcome = "still_out" | "missing";

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

type Admin = NonNullable<ReturnType<typeof saasAdmin>>;

/** This hand's check-in (of this truck, or of everything out) that started at this moment, if it already saved. */
async function savedReturn(admin: Admin, companyId: string, userId: string, unitId: string | null, startedIso: string) {
  let q = admin.from("saas_returns").select("id, unit_name, returned_by, pieces, not_returned")
    .eq("company_id", companyId).eq("returned_by_user", userId).eq("started_at", startedIso);
  q = unitId ? q.eq("unit_id", unitId) : q.is("unit_id", null);
  const { data } = await q.maybeSingle();
  const r = data as { id: string; unit_name: string | null; returned_by: string; pieces: unknown[] | null; not_returned: unknown[] | null } | null;
  if (!r) return null;
  const back = (r.pieces ?? []).length;
  const left = (r.not_returned ?? []).length;
  return {
    ok: true, id: r.id,
    summary: `${r.unit_name ? `${r.unit_name} checked in` : "Iron checked in"} by ${r.returned_by}: ${back} checked in${left ? `, ${left} not back` : ""}`,
  };
}

/**
 * Check iron back in after a job. Each scanned piece goes back on the truck
 * (the truck's own kit, parked in the yard) or off into the yard at a rack or
 * spot. Pieces that went out on the truck but didn't get scanned are still
 * out (the out-too-long clock keeps running) or can't be found (flagged
 * missing). One locked record, a name and a time on every piece, and the
 * database logs each move by itself.
 */
export async function finishReturn(input: {
  unitId: string | null;
  yardId: string | null;
  startedAt: string;
  scans: { assetId: string; how: ScanHow; at?: number; to: ReturnDest; rack?: string }[];
  notReturned: { assetId: string; outcome: Outcome }[];
}): Promise<{ ok: boolean; error?: string; summary?: string; id?: string }> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Your scans are still on this phone." };

  const [{ data: unitRow }, { data: yardRows }] = await Promise.all([
    input.unitId ? db.from("saas_units").select("id, name, yard_id").eq("id", input.unitId).eq("company_id", company.id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);
  const unit = unitRow as { id: string; name: string; yard_id: string } | null;
  if (input.unitId && !unit) return { ok: false, error: "That truck isn't in your account." };
  const yards = (yardRows ?? []) as { id: string; name: string }[];
  const yard = yards.find((y) => y.id === input.yardId) ?? yards.find((y) => y.id === unit?.yard_id) ?? yards[0];
  if (!yard) return { ok: false, error: "Add a yard first." };

  // A resend of a check-in that already landed gets the first record back.
  const startedMs = Date.parse(input.startedAt) || Date.now();
  const startedIso = new Date(startedMs).toISOString();
  const already = await savedReturn(admin, company.id, user.id, unit?.id ?? null, startedIso);
  if (already) return already;

  const ids = [...new Set([...input.scans.map((s) => s.assetId), ...input.notReturned.map((n) => n.assetId)])];
  const { data: assetRows } = ids.length
    ? await db.from("saas_assets").select("id, name, identifier, unit_id, status, out_since").eq("company_id", company.id).in("id", ids)
    : { data: [] };
  type A = { id: string; name: string; identifier: string | null; unit_id: string | null; status: string; out_since: string | null };
  const byId = new Map(((assetRows ?? []) as A[]).map((a) => [a.id, a]));
  const unitNames = new Map<string, string>();
  const otherUnitIds = [...new Set(((assetRows ?? []) as A[]).map((a) => a.unit_id).filter((x): x is string => Boolean(x)))];
  if (otherUnitIds.length) {
    const { data: u } = await db.from("saas_units").select("id, name").eq("company_id", company.id).in("id", otherUnitIds);
    for (const r of (u ?? []) as { id: string; name: string }[]) unitNames.set(r.id, r.name);
  }

  const now = new Date().toISOString();
  const nowMs = Date.parse(now);
  const day = dayLabel(now);
  const today = localToday();

  const seen = new Set<string>();
  const scans = input.scans.filter((s) => {
    const a = byId.get(s.assetId);
    if (!a || a.status === "retired" || seen.has(s.assetId)) return false;
    seen.add(s.assetId);
    return true;
  }).map((s) => ({
    ...s,
    to: (s.to === "truck" && unit ? "truck" : "yard") as ReturnDest,
    rack: String(s.rack ?? "").trim().slice(0, 80),
    at: typeof s.at === "number" && s.at <= nowMs + 60e3 && s.at >= startedMs - 60e3 ? new Date(Math.min(s.at, nowMs)).toISOString() : now,
  }));

  // What came back bad: worth a note on the record (it can't roll again until fixed).
  const scanIds = scans.map((s) => s.assetId);
  const { data: itemRows } = scanIds.length
    ? await db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until")
        .eq("company_id", company.id).eq("parent_type", "asset").in("parent_id", scanIds)
    : { data: [] };
  const red = new Set<string>(scanIds.filter((id) => byId.get(id)!.status === "out_of_service"));
  for (const it of (itemRows ?? []) as { id: string; title: string; parent_id: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null }[]) {
    const r = judgeItem(it, today, today).result;
    if (r === "expired" || r === "missing") red.add(it.parent_id);
  }

  const back = { last_seen_by: actor, last_seen_at: now };
  // Off the job: only the server writes these (the database turns a phone away).
  const offJob = { returned_at: now, returned_by: actor, out_since: null, out_loadout_id: null, out_alerted_at: null };
  // Back on the truck, one write.
  const onTruck = scans.filter((s) => s.to === "truck");
  if (onTruck.length && unit) {
    const { error } = await db.from("saas_assets").update({
      ...back, unit_id: unit.id, yard_id: unit.yard_id,
      scanned_at: now, scanned_by: actor, scanned_unit_id: unit.id,
      last_seen_where: `checked in on ${unit.name} ${day}`,
    }).eq("company_id", company.id).in("id", onTruck.map((s) => s.assetId));
    if (error) return { ok: false, error: `Couldn't save the check-in: ${error.message}` };
  }
  // Into the yard, grouped by rack so each piece's note says where it sits.
  const byRack = new Map<string, string[]>();
  for (const s of scans.filter((x) => x.to === "yard")) byRack.set(s.rack, [...(byRack.get(s.rack) ?? []), s.assetId]);
  for (const [rack, rackIds] of byRack) {
    const { error } = await db.from("saas_assets").update({
      ...back, unit_id: null, yard_id: yard.id, scanned_unit_id: null,
      last_seen_where: rack || `checked in ${day}`,
    }).eq("company_id", company.id).in("id", rackIds);
    if (error) return { ok: false, error: `Couldn't save the check-in: ${error.message}` };
  }
  // Didn't come back: still out (clock keeps running), or can't be found.
  const notReturned = input.notReturned.filter((n) => byId.has(n.assetId) && !seen.has(n.assetId))
    .map((n) => ({ ...n, outcome: (n.outcome === "missing" ? "missing" : "still_out") as Outcome }));
  for (const n of notReturned.filter((x) => x.outcome === "missing")) {
    const a = byId.get(n.assetId)!;
    await db.from("saas_assets").update({
      ...(a.status === "out_of_service" ? {} : { status: "missing" }),
      last_seen_where: `didn't come back${unit ? ` on ${unit.name}` : ""}, ${day}`, last_seen_by: actor, last_seen_at: now,
    }).eq("id", a.id).eq("company_id", company.id);
  }
  // What came back is off the job. What can't be found isn't out on a job
  // either: it's missing, and it shows (and blocks) as missing.
  const offIds = [...scans.map((x) => x.assetId), ...notReturned.filter((x) => x.outcome === "missing").map((x) => x.assetId)];
  if (offIds.length) {
    const { error } = await admin.from("saas_assets").update(offJob).eq("company_id", company.id).in("id", offIds);
    if (error) return { ok: false, error: `Couldn't save the check-in: ${error.message}` };
  }

  const { data: rec, error: recErr } = await admin.from("saas_returns").insert({
    company_id: company.id, yard_id: yard.id, unit_id: unit?.id ?? null, unit_name: unit?.name ?? null,
    returned_by: actor, returned_by_user: user.id, started_at: startedIso, finished_at: now,
    pieces: scans.map((s) => {
      const a = byId.get(s.assetId)!;
      return { asset_id: a.id, name: a.name, serial: a.identifier, how: s.how, at: s.at, by: actor, to: s.to,
        rack: s.to === "yard" ? s.rack || null : null, from_unit: a.unit_id ? unitNames.get(a.unit_id) ?? null : null,
        out_days: a.out_since ? daysOut(a.out_since, nowMs) : null, red: red.has(a.id) };
    }),
    not_returned: notReturned.map((n) => { const a = byId.get(n.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, outcome: n.outcome }; }),
  }).select("id").single();
  if (recErr?.code === "23505") {
    const first = await savedReturn(admin, company.id, user.id, unit?.id ?? null, startedIso);
    if (first) return first;
  }
  if (recErr || !rec) return { ok: false, error: `Couldn't save the check-in record: ${recErr?.message ?? "unknown"}` };

  const parts: string[] = [];
  if (onTruck.length && unit) parts.push(`${onTruck.length} back on ${unit.name}`);
  const toYard = scans.length - onTruck.length;
  if (toYard) parts.push(`${toYard} into ${yard.name}${byRack.size === 1 && [...byRack.keys()][0] ? ` (${[...byRack.keys()][0]})` : ""}`);
  const stillOut = notReturned.filter((n) => n.outcome === "still_out").length;
  const missing = notReturned.filter((n) => n.outcome === "missing").length;
  if (stillOut) parts.push(`${stillOut} still out`);
  if (missing) parts.push(`${missing} can't be found`);
  if (red.size) parts.push(`${red.size} came back out of test or red-tagged`);
  const summary = `${unit ? `${unit.name} checked in` : `Iron checked into ${yard.name}`} by ${actor}: ${parts.join(", ") || "nothing scanned"}`;
  void logEvent({ companyId: company.id, kind: "returned", unitId: unit?.id ?? null, actor, message: summary });

  if (unit) revalidatePath(`/app/units/${unit.id}`);
  revalidatePath("/app");
  revalidatePath("/app/equipment");
  revalidatePath("/app/map");
  return { ok: true, summary, id: (rec as { id: string }).id };
}
