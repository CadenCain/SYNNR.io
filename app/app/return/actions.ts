"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { YARD_TZ, fmtWhen } from "@/lib/saas/format";
import { judgeItem, withSerial } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { daysOut } from "@/lib/saas/whereabouts";
import type { ScanHow } from "@/lib/saas/loadout";
import { provenHow } from "@/lib/saas/scan-proof";
import { verdictOf, type LoadoutRecord } from "@/lib/saas/loadout-record";

export type ReturnDest = "truck" | "yard";
type Outcome = "still_out" | "missing";

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

type Admin = NonNullable<ReturnType<typeof saasAdmin>>;

/**
 * Was this truck out without a load-out that cleared it? "never": no load-out
 * since it was last checked in (and that wasn't just now: a second check-in of
 * the same trip isn't a new trip). "not_ready": its newest load-out was NOT
 * READY and nobody rolled it on an override. lastBack: its last check-in
 * before this one, if any.
 */
async function tripNotScanned(admin: Admin, companyId: string, unitId: string, now: string): Promise<{ flag: "never" | "not_ready" | null; lastBack: string | null }> {
  const [{ data: lo }, { data: ret }] = await Promise.all([
    admin.from("saas_loadout_scans").select("id, finished_at, verdict").eq("company_id", companyId).eq("unit_id", unitId)
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("saas_returns").select("finished_at").eq("company_id", companyId).eq("unit_id", unitId).lt("finished_at", now)
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const last = lo as { id: string; finished_at: string; verdict: string | null } | null;
  const lastBack = (ret as { finished_at: string } | null)?.finished_at ?? null;
  if (!last || (lastBack && lastBack > last.finished_at)) {
    // Checked in twice in a row the same day is one trip, not two.
    if (lastBack && Date.parse(now) - Date.parse(lastBack) < 12 * 3600e3) return { flag: null, lastBack };
    return { flag: "never", lastBack };
  }
  if (last.verdict === "ready") return { flag: null, lastBack };
  const { data: ov } = await admin.from("saas_loadout_overrides").select("loadout_id").eq("loadout_id", last.id).maybeSingle();
  return { flag: ov ? null : "not_ready", lastBack };
}

/**
 * A load-out of this truck that rolled (READY, or NOT READY on a manager's
 * override) after this check-in started, if any. The truck went out again
 * since, so the check-in is a stale one: saving it would call iron that's
 * on the new job back in the yard. A NOT READY try nobody overrode never
 * left, so it doesn't count. Another hand's check-in since doesn't either:
 * two phones can check one truck in together.
 */
async function rolledSince(admin: Admin, companyId: string, unitId: string, startedIso: string) {
  const { data } = await admin.from("saas_loadout_scans").select("id, scanned_by, scanned_by_user, finished_at, verdict, pieces, not_scanned")
    .eq("company_id", companyId).eq("unit_id", unitId).gt("finished_at", startedIso).order("finished_at", { ascending: false }).limit(20);
  const rows = (data ?? []) as (Pick<LoadoutRecord, "id" | "finished_at" | "verdict" | "pieces" | "not_scanned"> & { scanned_by: string | null; scanned_by_user: string | null })[];
  const ready = rows.find((r) => verdictOf(r) === "ready");
  if (ready) return ready;
  const blocked = rows.map((r) => r.id);
  if (!blocked.length) return null;
  const { data: ov } = await admin.from("saas_loadout_overrides").select("loadout_id").eq("company_id", companyId).in("loadout_id", blocked).limit(1);
  const rolledId = ((ov ?? []) as { loadout_id: string }[])[0]?.loadout_id;
  return rows.find((r) => r.id === rolledId) ?? null;
}

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
  scans: { assetId: string; how: ScanHow; at?: number; to: ReturnDest; rack?: string; proof?: string; redTag?: string; yardId?: string }[];
  notReturned: { assetId: string; outcome: Outcome }[];
  /** The hand says the truck never left the yard since its last check-in (a yard check, not a trip). */
  yardCheck?: boolean;
}): Promise<{ ok: boolean; error?: string; summary?: string; id?: string; stale?: boolean }> {
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
  // A check-in is one shift's work, like a load-out. One that says it started
  // a day ago (or tomorrow) is an old draft off a phone or a clock gone wrong.
  // It can never save, so the phone drops it instead of trying forever.
  if (startedMs < Date.now() - 20 * 3600e3 || startedMs > Date.now() + 10 * 60e3) {
    return { ok: false, stale: true, error: `This check-in was started too long ago to save. Start it again${unit ? ` from ${unit.name}` : ""}.` };
  }
  // Picked back up off a phone after the truck already loaded out again:
  // that iron is on the new job, not back in the yard.
  if (unit) {
    const newer = await rolledSince(admin, company.id, unit.id, startedIso);
    if (newer) {
      const who = newer.scanned_by_user === user.id ? "You" : newer.scanned_by || "Someone";
      return { ok: false, stale: true,
        error: `${who} loaded ${unit.name} out again ${fmtWhen(newer.finished_at)}, after this check-in was started. It can't be saved. Start a new check-in when ${unit.name} is back.` };
    }
  }

  const ids = [...new Set([...input.scans.map((s) => s.assetId), ...input.notReturned.map((n) => n.assetId)])];
  const { data: assetRows } = ids.length
    ? await db.from("saas_assets").select("id, name, identifier, unit_id, status, out_since, tag_token, nfc_uid, out_loadout_id, out_with_name, redress_each_run, returned_at").eq("company_id", company.id).in("id", ids)
    : { data: [] };
  type A = { id: string; name: string; identifier: string | null; unit_id: string | null; status: string; out_since: string | null; tag_token: string | null; nfc_uid: string | null; out_loadout_id: string | null; out_with_name: string | null; redress_each_run: boolean; returned_at: string | null };
  const byId = new Map(((assetRows ?? []) as A[]).map((a) => [a.id, a]));
  const unitNames = new Map<string, string>();
  const otherUnitIds = [...new Set(((assetRows ?? []) as A[]).map((a) => a.unit_id).filter((x): x is string => Boolean(x)))];
  if (otherUnitIds.length) {
    const { data: u } = await db.from("saas_units").select("id, name").eq("company_id", company.id).in("id", otherUnitIds);
    for (const r of (u ?? []) as { id: string; name: string }[]) unitNames.set(r.id, r.name);
  }

  // Where each piece had been: the load-out it rolled on (truck, who loaded
  // it, when) or the person it was signed out to. Kept on the record, so a
  // piece that comes back damaged says whose job it came back from.
  const loIds = [...new Set(((assetRows ?? []) as A[]).map((a) => a.out_loadout_id).filter((x): x is string => Boolean(x)))];
  const { data: loRows } = loIds.length
    ? await admin.from("saas_loadout_scans").select("id, unit_name, scanned_by, finished_at").eq("company_id", company.id).in("id", loIds)
    : { data: [] };
  const loById = new Map(((loRows ?? []) as { id: string; unit_name: string; scanned_by: string | null; finished_at: string }[]).map((l) => [l.id, l]));
  const wentOut = (a: A) => {
    if (a.out_with_name) return { with: a.out_with_name, at: a.out_since };
    const l = a.out_loadout_id ? loById.get(a.out_loadout_id) : null;
    return l ? { truck: l.unit_name, by: l.scanned_by, at: l.finished_at, loadout_id: l.id } : null;
  };

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
    assetId: s.assetId,
    // A tag scan only counts if the code read off the tag is this piece's.
    how: provenHow(s.how, s.proof, byId.get(s.assetId)!),
    // Red-tagged iron goes into the yard, whatever the phone sent: it can't go out.
    to: (s.to === "truck" && unit && !String(s.redTag ?? "").trim() ? "truck" : "yard") as ReturnDest,
    redTag: String(s.redTag ?? "").trim().slice(0, 140) || null,
    rack: String(s.rack ?? "").trim().slice(0, 80),
    // The yard picked when this piece was checked (only this company's yards count).
    yardId: yards.find((y) => y.id === s.yardId)?.id ?? yard.id,
    at: typeof s.at === "number" && s.at <= nowMs + 60e3 && s.at >= startedMs - 60e3 ? new Date(Math.min(s.at, nowMs)).toISOString() : now,
  }));

  // Loose iron or a tool with nothing tapped: nothing came back, so there's
  // nothing to save (a truck's check-in can still say what didn't come back).
  // Pieces tapped that aren't this company's at all: the phone was switched
  // to another company with this check-in still on it.
  if (!unit && !scans.length) {
    return { ok: false, error: input.scans.length && input.scans.every((s) => !byId.has(s.assetId))
      ? "None of these pieces are in this company. Switch back to the company you checked them in for, then save."
      : "Nothing was checked in. Tap It's back on each piece that came back." };
  }

  // Was this trip cleared to roll? Decided before anything moves. A truck with
  // no load-out since its last check-in either never left the yard (a hand
  // checking a sling in the yard) or left without a scan, and only the hand
  // knows which. Said it never left: a yard check, so no "never scanned out"
  // flag and nothing on it is "still out". A truck that loaded out since did
  // leave, so its word isn't asked for or taken.
  const trip = unit ? await tripNotScanned(admin, company.id, unit.id, now) : null;
  const unscanned = trip?.flag ?? null;
  const yardCheck = Boolean(input.yardCheck) && unscanned === "never";
  if (yardCheck && !scans.length) return { ok: false, error: "Nothing was checked in. Tap It's back on each piece you checked." };

  // What came back bad: worth a note on the record (it can't roll again until fixed).
  const scanIds = scans.map((s) => s.assetId);
  const { data: itemRows } = scanIds.length
    ? await db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until, last_upload_id")
        .eq("company_id", company.id).eq("parent_type", "asset").in("parent_id", scanIds)
    : { data: [] };
  const red = new Set<string>(scanIds.filter((id) => byId.get(id)!.status === "out_of_service"));
  for (const it of (itemRows ?? []) as { id: string; title: string; parent_id: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null }[]) {
    const r = judgeItem(it, today, today).result;
    if (r === "expired" || r === "missing") red.add(it.parent_id);
  }

  const back = { last_seen_by: actor, last_seen_at: now };
  // Off the job: only the server writes these (the database turns a phone away).
  const offJob = { returned_at: now, returned_by: actor, out_since: null, out_loadout_id: null, out_alerted_at: null, out_with_user: null, out_with_name: null };
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
  // Into the yard, grouped by yard and rack so each piece's note says where it sits.
  const byRack = new Map<string, { yardId: string; rack: string; ids: string[] }>();
  for (const s of scans.filter((x) => x.to === "yard")) {
    const k = `${s.yardId}|${s.rack}`;
    const g = byRack.get(k) ?? { yardId: s.yardId, rack: s.rack, ids: [] };
    g.ids.push(s.assetId);
    byRack.set(k, g);
  }
  for (const { yardId: toYard, rack, ids: rackIds } of byRack.values()) {
    const { error } = await db.from("saas_assets").update({
      ...back, unit_id: null, yard_id: toYard, scanned_unit_id: null,
      last_seen_where: rack || `checked in ${day}`,
    }).eq("company_id", company.id).in("id", rackIds);
    if (error) return { ok: false, error: `Couldn't save the check-in: ${error.message}` };
  }
  // A piece marked "can't find" that came back is found: in service again
  // (a red tag, below, still wins if it came back damaged).
  const found = scans.filter((x) => byId.get(x.assetId)!.status === "missing").map((x) => x.assetId);
  if (found.length) {
    await db.from("saas_assets").update({ status: "in_service" }).eq("company_id", company.id).in("id", found);
    for (const id of found) byId.set(id, { ...byId.get(id)!, status: "in_service" });
  }
  // Came back damaged: red-tagged right at check-in, with who and why. It
  // can't go out again until a manager puts it back in service.
  for (const s of scans.filter((x) => x.redTag)) {
    const a = byId.get(s.assetId)!;
    if (a.status === "out_of_service") continue;
    await db.from("saas_assets").update({ status: "out_of_service", last_seen_where: `red-tagged at check-in: ${s.redTag}`, last_seen_by: actor, last_seen_at: now })
      .eq("id", a.id).eq("company_id", company.id);
    red.add(a.id);
  }
  // Didn't come back: still out (clock keeps running), or can't be found. Only
  // iron that's on this truck now counts (a piece moved to another truck since
  // this screen opened isn't this truck's to flag). A yard check has none.
  // A piece another check-in (another phone, or an earlier check-in of this
  // trip) already brought back after this one started isn't "not back" either.
  const notReturned = (yardCheck ? [] : input.notReturned).filter((n) => {
    const a = byId.get(n.assetId);
    return Boolean(a && unit && a.unit_id === unit.id && a.status !== "retired" && !seen.has(n.assetId)
      && !(a.returned_at && a.returned_at >= startedIso));
  }).map((n) => ({ ...n, outcome: (n.outcome === "missing" ? "missing" : "still_out") as Outcome }));
  // Still out on the job: it stays logged on the truck and its out clock keeps
  // running, but the piece says where it really is: left on location.
  if (unit) {
    const leftOn = new Map<string, string[]>();
    for (const n of notReturned.filter((x) => x.outcome === "still_out")) {
      const a = byId.get(n.assetId)!;
      // No out clock: it isn't out on any job (it came back already, or never
      // left), so it can't have been left on location.
      if (!a.out_since) continue;
      const where = `left on location from ${unit.name}'s ${a.out_since ? `${dayLabel(a.out_since)} ` : ""}job, per ${actor}, ${day}`;
      leftOn.set(where, [...(leftOn.get(where) ?? []), a.id]);
    }
    for (const [where, ids] of leftOn) {
      await db.from("saas_assets").update({ last_seen_where: where, last_seen_by: actor, last_seen_at: now }).eq("company_id", company.id).in("id", ids);
    }
  }
  for (const n of notReturned.filter((x) => x.outcome === "missing")) {
    const a = byId.get(n.assetId)!;
    // Known not to be on the truck: it comes off it, so it stops blocking the
    // truck and isn't on its next load-out. It stays on its yard's books,
    // flagged missing, with where it was last.
    await db.from("saas_assets").update({
      ...(a.status === "out_of_service" ? {} : { status: "missing" }),
      unit_id: null,
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
  const tagged = scans.filter((x) => x.how !== "hand").map((x) => x.assetId);
  if (tagged.length) await admin.from("saas_assets").update({ tag_seen_at: now }).eq("company_id", company.id).in("id", tagged);
  // Signed out to someone and back now: the sign-out closes.
  const scanIdsAll = scans.map((x) => x.assetId);
  if (scanIdsAll.length) {
    await admin.from("saas_signouts").update({ back_at: now, back_by: actor })
      .eq("company_id", company.id).in("asset_id", scanIdsAll).is("back_at", null);
  }
  // Tools that get redressed after every run come back reading "Needs
  // redress" and can't go out again until someone redresses them.
  const redress = scans.filter((x) => byId.get(x.assetId)!.redress_each_run).map((x) => x.assetId);
  if (redress.length) await admin.from("saas_assets").update({ needs_redress_since: now }).eq("company_id", company.id).in("id", redress);

  const { data: rec, error: recErr } = await admin.from("saas_returns").insert({
    company_id: company.id, yard_id: yard.id, unit_id: unit?.id ?? null, unit_name: unit?.name ?? null,
    returned_by: actor, returned_by_user: user.id, started_at: startedIso, finished_at: now,
    pieces: scans.map((s) => {
      const a = byId.get(s.assetId)!;
      return { asset_id: a.id, name: a.name, serial: a.identifier, how: s.how, at: s.at, by: actor, to: s.to,
        rack: s.to === "yard" ? s.rack || null : null, from_unit: a.unit_id ? unitNames.get(a.unit_id) ?? null : null, red_tag: s.redTag,
        out_days: a.out_since ? daysOut(a.out_since, nowMs) : null, red: red.has(a.id), went_out: wentOut(a),
        needs_redress: redress.includes(a.id) };
    }),
    // Where each one had been, so a piece that can't be found says whose trip it went out on.
    not_returned: notReturned.map((n) => { const a = byId.get(n.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, outcome: n.outcome, went_out: wentOut(a) }; }),
  }).select("id").single();
  if (recErr?.code === "23505") {
    const first = await savedReturn(admin, company.id, user.id, unit?.id ?? null, startedIso);
    if (first) return first;
  }
  if (recErr || !rec) return { ok: false, error: `Couldn't save the check-in record: ${recErr?.message ?? "unknown"}` };

  const parts: string[] = [];
  if (onTruck.length && unit) parts.push(`${onTruck.length} back on ${unit.name}`);
  const toYard = scans.length - onTruck.length;
  if (toYard) {
    // Each yard the pieces went into, by name, and the rack when there's just one.
    const groups = [...byRack.values()];
    const yardNames = [...new Set(groups.map((g) => yards.find((y) => y.id === g.yardId)?.name ?? yard.name))];
    const oneRack = groups.length === 1 && groups[0].rack ? ` (${groups[0].rack})` : "";
    parts.push(`${toYard} into ${yardNames.join(" and ")}${oneRack}`);
  }
  const stillOut = notReturned.filter((n) => n.outcome === "still_out").length;
  // Can't be found: named with its serial, since a shop has a dozen valves with the same name.
  const lost = notReturned.filter((n) => n.outcome === "missing").map((n) => byId.get(n.assetId)!);
  const lostNames = (most: number) => `${lost.slice(0, most).map((a) => withSerial(a.name, a.identifier)).join("; ")}${lost.length > most ? `; and ${lost.length - most} more` : ""}`;
  if (stillOut) parts.push(`${stillOut} still out`);
  if (lost.length) parts.push(`${lost.length} can't be found (${lostNames(3)})`);
  const taggedNow = scans.filter((x) => x.redTag).length;
  if (taggedNow) parts.push(`${taggedNow} red-tagged at check-in (${scans.filter((x) => x.redTag).map((x) => `${byId.get(x.assetId)!.name}: ${x.redTag}`).slice(0, 2).join("; ")})`);
  if (red.size - taggedNow > 0) parts.push(`${red.size - taggedNow} came back out of test or red-tagged`);
  if (redress.length) parts.push(`${redress.length} ${redress.length === 1 ? "needs" : "need"} redress`);
  const summary = `${unit ? `${unit.name} checked in` : `Iron checked into ${yard.name}`} by ${actor}${yardCheck ? " (it didn't leave the yard)" : ""}: ${parts.join(", ") || "nothing scanned"}`;
  void logEvent({ companyId: company.id, kind: "returned", unitId: unit?.id ?? null, actor, message: summary });
  // Iron that didn't come back and can't be found: the managers hear now, not
  // a week later. The piece and serial, the trip it went out on and who loaded
  // it, and who checked the truck in.
  if (unit && lost.length) {
    const outOn = (a: (typeof lost)[number]) => {
      const w = wentOut(a);
      if (!w) return "";
      if ("with" in w) return ` (signed out to ${w.with}${w.at ? ` ${dayLabel(w.at)}` : ""})`;
      return ` (went out on ${w.truck} ${dayLabel(w.at)}${w.by ? `, loaded by ${w.by}` : ""})`;
    };
    const named = `${lost.slice(0, 5).map((a) => `${withSerial(a.name, a.identifier)}${outOn(a)}`).join("; ")}${lost.length > 5 ? `; and ${lost.length - 5} more` : ""}`;
    void notifyEvent({ companyId: company.id, companyName: company.name, yardId: unit.yard_id ?? yard.id,
      message: `Can't find after ${unit.name} came back: ${named}. Flagged missing. Checked in by ${actor}`,
      href: lost.length === 1 ? `/app/assets/${lost[0].id}` : "/app/equipment?f=down" });
  }
  // A truck that comes back without having been cleared to roll: nobody
  // scanned it out, or it left NOT READY with no override. That's the app not
  // being used, and a manager needs to hear about it. A yard check is the
  // hand's word that it never left, which only the crew that would have
  // skipped the scan can give, so the managers still hear it, softer.
  if (unit && yardCheck) {
    void logEvent({ companyId: company.id, kind: "yard_check", unitId: unit.id, actor,
      message: `${unit.name} checked in by ${actor}, who said it didn't leave the yard${trip?.lastBack ? ` since it was checked in ${fmtWhen(trip.lastBack)}. No load-out since then.` : ". It has no load-out on record."}` });
  } else if (unit && scans.length && unscanned) {
    void logEvent({ companyId: company.id, kind: "unscanned_trip", unitId: unit.id, actor,
      message: unscanned === "never" ? `${unit.name} came back from a job it was never scanned out for. Checked in by ${actor}.`
        : `${unit.name} came back, but its last load-out was NOT READY and nobody rolled it. It left without being cleared. Checked in by ${actor}.` });
  }

  if (unit) revalidatePath(`/app/units/${unit.id}`);
  revalidatePath("/app");
  revalidatePath("/app/equipment");
  revalidatePath("/app/map");
  return { ok: true, summary, id: (rec as { id: string }).id };
}
