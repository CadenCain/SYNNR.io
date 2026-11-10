import { describe, it, expect } from "vitest";
import { expectedLines, fillLines, loadoutVerdict, untestedPieces, lineMatches, kitLinesFrom, pieceLabel, type BadPiece } from "../loadout-lines";
import { buildLoadOutTrucks, kitShortByTruck, weekNumbers, type LoadoutScanRow } from "../loadout-board";
import { buildEquipment, stateLabel, type RawAsset, type RawItem, type EquipRow } from "../equipment";
import { judgeItem, judgeUnit, isNoPaper, withSerial } from "../judge";
import { localToday } from "../status";
import { TESTED_CATEGORIES, categoryLabel } from "../taxonomy";
import { requiredChecks, missingChecks } from "../roll-checks";
import { lateLine } from "../plans";
import { summaryText, damagedLine, type DaySummary } from "../morning-summary";
import { daysOut, placeOf, PLACE_LABEL } from "../whereabouts";
import { searchPieces, type SearchablePiece } from "../search";
import type { UnitTile } from "../readiness";

/**
 * One working week (Mon Nov 9 to Sun Nov 15 2026) at Renegade Wireline:
 * Odessa, Midland, and Hobbs yards, coil and wireline trucks. Each server
 * action is modeled step for step on in-memory rows, using the same pure
 * rules it calls, and every screen is rebuilt from those rows the way its
 * page builds it:
 *   loadOut   app/app/units/[unitId]/scan/actions.ts finishLoadout
 *   override  app/app/loadouts/[id]/actions.ts rollLoadoutAnyway
 *   checkIn   app/app/return/actions.ts finishReturn
 *   signOut   app/app/signout/actions.ts signOutTools / markRedressed
 *   board     app/app/page.tsx (+ readiness.ts tiles)
 *   morning   lib/saas/morning-summary.ts sendMorningSummaries
 * All times are Central (CST, UTC-6, after the Nov 1 fall-back).
 */

const TZ = "America/Chicago";
const H = 3600e3;
const ct = (s: string) => new Date(`${s.replace(" ", "T")}:00-06:00`).toISOString();
const dayAt = (iso: string) => localToday(new Date(iso));
/** Intl puts a narrow no-break space before AM/PM. */
const sp = (s: string | null | undefined) => (s ?? "").replace(/[  ]/g, " ");

type Asset = RawAsset & { out_loadout_id?: string | null; out_with_user?: string | null; redress_each_run?: boolean };
type Rec = LoadoutScanRow & { unit_name: string; yard_id: string; started_at: string; plan_id: string | null; job: string | null };
interface RetPiece { asset_id: string; name: string; serial: string | null; to: "truck" | "yard"; red_tag: string | null; red: boolean; needs_redress: boolean; went_out: { truck?: string; by?: string | null; with?: string; at?: string | null } | null }
interface Ret { id: string; unit_id: string | null; unit_name: string | null; yard_id: string; returned_by: string; finished_at: string; pieces: RetPiece[]; not_returned: { asset_id: string; outcome: "still_out" | "missing" }[] }
interface Plan { id: string; unitId: string; packageIds: string[]; lines: { label: string; qty: number }[]; job: string | null; by: string; at: string; leavesAt: string | null; usedAt: string | null }
interface Ev { kind: string; actor: string | null; unit_id: string | null; message: string; created_at: string }
interface Unit { id: string; name: string; yard_id: string; type: string }
interface Yard {
  company: string;
  yards: { id: string; name: string }[];
  units: Unit[];
  assets: Asset[];
  items: RawItem[];
  kits: Map<string, { lines: { label: string; qty: number }[]; checks: string[] }>;
  packages: Map<string, { name: string; lines: { label: string; qty: number }[]; checks: string[] }>;
  plans: Plan[];
  loadouts: Rec[];
  overrides: { loadout_id: string; by_name: string; reason: string; created_at: string }[];
  returns: Ret[];
  events: Ev[];
  members: string[];
  alertDays: number;
  seq: number;
}

const asset = (id: string, name: string, serial: string | null, category: string, where: { unit?: string; yard: string }, extra: Partial<Asset> = {}): Asset => ({
  id, name, category, identifier: serial, status: "in_service", yard_id: where.yard, unit_id: where.unit ?? null,
  out_since: null, out_with_name: null, needs_redress_since: null, out_loadout_id: null, out_with_user: null, redress_each_run: false, ...extra,
});
const cert = (parent: string, title: string, exp: string | null, extra: Partial<RawItem> = {}): RawItem =>
  ({ id: `it-${parent}-${title}`, title, expiration_date: exp, reminder_days: 30, pending_until: null, parent_id: parent, last_upload_id: "cert-photo", ...extra });
const latestFirst = <T extends { finished_at: string }>(rows: T[], at: string) =>
  rows.filter((r) => r.finished_at <= at).sort((a, b) => b.finished_at.localeCompare(a.finished_at));

// ---------------------------------------------------------------- server actions

/** finishLoadout: the list from the database, the server's verdict, then the iron moves. */
function loadOut(y: Yard, i: { unit: string; by: string; at: string; startedAt?: string; scans: string[]; off?: Record<string, "yard" | "missing">; packages?: string[]; checks?: string[]; photo?: boolean }): Rec {
  const unit = y.units.find((u) => u.id === i.unit)!;
  const now = i.at, today = dayAt(now);
  const byId = new Map(y.assets.map((a) => [a.id, a]));
  const A = (id: string) => byId.get(id)!;
  const testsOf = (id: string) => y.items.filter((it) => it.parent_id === id);
  // Kit, the plan's packages and lines, and anything picked (actions.ts:144-168).
  const plan = y.plans.find((p) => p.unitId === unit.id && !p.usedAt) ?? null;
  const pkgs = [...new Set([...(plan?.packageIds ?? []), ...(i.packages ?? [])])].map((id) => y.packages.get(id)!);
  const kit = y.kits.get(unit.id);
  const expected = expectedLines({ kit: kit?.lines ?? [], packages: pkgs.map((p) => ({ name: p.name, lines: p.lines })), planned: plan?.lines ?? [], quick: [] });
  // Logged on the truck, less what's still out from the last job (actions.ts:171-180).
  const lastBack = y.returns.filter((r) => r.unit_id === unit.id).map((r) => r.finished_at).sort().at(-1) ?? null;
  const logged = y.assets.filter((a) => a.unit_id === unit.id && a.status !== "retired");
  const stillOut = new Set(logged.filter((a) => a.out_since && lastBack && a.out_since < lastBack).map((a) => a.id));
  const onTruckIds = logged.map((a) => a.id).filter((id) => !stillOut.has(id));
  const scanned = [...new Set(i.scans)].filter((id) => byId.has(id) && A(id).status !== "retired");
  const filled = fillLines(expected, scanned.map((id) => ({ id, name: A(id).name, serial: A(id).identifier })));
  const bad: (BadPiece & { id: string })[] = [];
  for (const id of scanned) {
    const a = A(id);
    if (a.status === "out_of_service") bad.push({ id, name: a.name, serial: a.identifier, why: "red_tagged" });
    else if (a.needs_redress_since) bad.push({ id, name: a.name, serial: a.identifier, why: "needs_redress" });
  }
  for (const id of scanned) {
    const a = A(id);
    if (a.status === "out_of_service" || a.needs_redress_since) continue;
    for (const it of testsOf(id)) {
      const r = judgeItem(it, today, today);
      if (r.result === "expired") bad.push({ id, name: a.name, serial: a.identifier, why: "out_of_test", detail: `${it.title} ${r.detail}` });
      else if (isNoPaper(r)) bad.push({ id, name: a.name, serial: a.identifier, why: "no_paper", detail: it.title });
      else if (r.result === "missing") bad.push({ id, name: a.name, serial: a.identifier, why: "no_test_date", detail: it.title });
    }
  }
  // Untested look-alikes (actions.ts:232-269): every line they could fill, against every tested piece of that kind.
  const hasTest = new Set(scanned.filter((id) => testsOf(id).length));
  const untested = scanned.filter((id) => !hasTest.has(id));
  const labels = new Set<string>();
  for (const id of untested) for (const l of filled) if (lineMatches(l.label, A(id).name)) labels.add(l.label);
  const tested = new Set([...labels].filter((label) => y.assets.some((a) => a.status !== "retired" && !untested.includes(a.id) && lineMatches(label, a.name) && testsOf(a.id).length)));
  bad.push(...untestedPieces({
    scanned: scanned.map((id) => ({ id, name: A(id).name, serial: A(id).identifier, category: A(id).category })),
    hasTest, filled, testedCategories: TESTED_CATEGORIES, lineIsTested: (l) => tested.has(l),
  }).filter((p) => A(p.id).status !== "out_of_service" && !A(p.id).needs_redress_since));
  const redIds = new Set(bad.map((b) => b.id));
  // The phone sends every expected piece it didn't scan, "taken off" unless the hand said otherwise (scanner.tsx:463).
  const seen = new Set(scanned);
  const notScanned = onTruckIds.filter((id) => !seen.has(id)).map((id) => ({ id, outcome: i.off?.[id] ?? "yard" }));
  const cantFind = notScanned.filter((n) => n.outcome === "missing").map((n) => A(n.id));
  const v = loadoutVerdict({ lines: filled, bad, cantFind: cantFind.map((a) => ({ name: a.name, serial: a.identifier })), truckPaper: [], scanned: scanned.length });
  const asked = requiredChecks(kit?.checks, ...pkgs.map((p) => p.checks));
  const notTapped = missingChecks(asked, (i.checks ?? []).map((c) => c.trim().toLowerCase()));
  const reasons = [...v.reasons, ...notTapped.map((c) => `Not confirmed: ${c}`), ...(i.photo === false ? ["No photo of the loaded truck"] : [])];
  const verdict = reasons.length ? ("not_ready" as const) : ("ready" as const);
  const rec: Rec = {
    id: `lo-${++y.seq}`, unit_id: unit.id, unit_name: unit.name, yard_id: unit.yard_id, scanned_by: i.by, started_at: i.startedAt ?? now, finished_at: now,
    verdict, reasons, plan_id: plan?.id ?? null, job: plan?.job ?? null,
    pieces: scanned.map((id) => ({ asset_id: id, name: A(id).name, serial: A(id).identifier, how: "hand" as const, at: now, by: i.by, red: redIds.has(id) })),
    not_scanned: notScanned.map((n) => ({ asset_id: n.id, name: A(n.id).name, serial: A(n.id).identifier, outcome: n.outcome })),
  };
  // Move the iron (actions.ts:329-352): scanned pieces are on this truck, a scanned missing piece is found.
  for (const id of scanned) {
    Object.assign(A(id), { unit_id: unit.id, yard_id: unit.yard_id, scanned_at: now, scanned_unit_id: unit.id, last_seen_where: "scanned at load-out", ...(A(id).status === "missing" ? { status: "in_service" } : {}) });
  }
  for (const n of notScanned) {
    if (n.outcome === "yard") Object.assign(A(n.id), { unit_id: null, yard_id: unit.yard_id, out_since: null, out_loadout_id: null, last_seen_where: `taken off ${unit.name} at load-out` });
    else Object.assign(A(n.id), { ...(A(n.id).status === "out_of_service" ? {} : { status: "missing" }), last_seen_where: `not found for ${unit.name} load-out` });
  }
  y.loadouts.push(rec);
  // Out on a job (actions.ts:376-405).
  for (const id of scanned) {
    if (verdict === "ready") Object.assign(A(id), { out_since: now, out_loadout_id: rec.id, out_with_user: null, out_with_name: null });
    else if (!A(id).out_with_user) Object.assign(A(id), { out_since: null, out_loadout_id: null });
  }
  if (plan && verdict === "ready") plan.usedAt = now;
  y.events.push({ kind: verdict === "ready" ? "loadout_ready" : "loadout_blocked", actor: i.by, unit_id: unit.id, message: `${unit.name} ${verdict}`, created_at: now });
  return rec;
}

/** rollLoadoutAnyway: refuses only a record that isn't blocked, or one with a NEWER LOAD-OUT (actions.ts:24-31, 44-53). */
function override(y: Yard, loadoutId: string, by: string, at: string, reason: string): "rolled" | "not_blocked" | "stale" {
  const rec = y.loadouts.find((l) => l.id === loadoutId)!;
  if (rec.verdict !== "not_ready" || y.overrides.some((o) => o.loadout_id === rec.id)) return "not_blocked";
  if (y.loadouts.some((l) => l.unit_id === rec.unit_id && l.finished_at > rec.finished_at)) return "stale";
  // A check-in since: the trip is over (loadouts/[id]/actions.ts staleNow).
  if (y.returns.some((r) => r.unit_id === rec.unit_id && r.finished_at > rec.finished_at && r.finished_at <= at)) return "stale";
  y.overrides.push({ loadout_id: rec.id, by_name: by, reason, created_at: at });
  const ids = new Set(rec.pieces.map((p) => p.asset_id));
  // The clock starts at the override (actions.ts:62).
  for (const a of y.assets) if (a.unit_id === rec.unit_id && ids.has(a.id)) Object.assign(a, { out_since: at, out_loadout_id: rec.id, out_with_user: null, out_with_name: null });
  const plan = y.plans.find((p) => p.id === rec.plan_id);
  if (plan && !plan.usedAt) plan.usedAt = at;
  y.events.push({ kind: "rolled_override", actor: by, unit_id: rec.unit_id, message: `${rec.unit_name} rolled NOT READY on a manager override by ${by}`, created_at: at });
  return "rolled";
}

/** finishReturn: back on the truck or into the yard; a red tag, a redress, a trip nobody cleared. */
function checkIn(y: Yard, i: { unit: string | null; yard?: string; by: string; at: string; scans: { id: string; to?: "truck" | "yard"; redTag?: string; rack?: string }[]; notReturned?: Record<string, "still_out" | "missing"> }): Ret {
  const unit = i.unit ? y.units.find((u) => u.id === i.unit)! : null;
  const yardId = i.yard ?? unit?.yard_id ?? y.yards[0].id;
  const now = i.at, today = dayAt(now);
  const byId = new Map(y.assets.map((a) => [a.id, a]));
  const A = (id: string) => byId.get(id)!;
  const seen = new Set<string>();
  const scans: { id: string; to: "truck" | "yard"; redTag: string | null; rack: string }[] = [];
  for (const s of i.scans) {
    if (!byId.has(s.id) || A(s.id).status === "retired" || seen.has(s.id)) continue;
    seen.add(s.id);
    const redTag = s.redTag?.trim() || null;
    scans.push({ id: s.id, to: (s.to ?? (unit ? "truck" : "yard")) === "truck" && unit && !redTag ? "truck" : "yard", redTag, rack: s.rack ?? "" });
  }
  const red = new Set(scans.filter((s) => A(s.id).status === "out_of_service").map((s) => s.id));
  for (const it of y.items) if (seen.has(it.parent_id)) { const r = judgeItem(it, today, today).result; if (r === "expired" || r === "missing") red.add(it.parent_id); }
  const wentOut = (a: Asset): RetPiece["went_out"] => {
    if (a.out_with_name) return { with: a.out_with_name, at: a.out_since ?? null };
    const l = y.loadouts.find((x) => x.id === a.out_loadout_id);
    return l ? { truck: l.unit_name, by: l.scanned_by, at: l.finished_at } : null;
  };
  const pieces: RetPiece[] = scans.map((s) => {
    const a = A(s.id);
    return { asset_id: a.id, name: a.name, serial: a.identifier, to: s.to, red_tag: s.redTag, red: red.has(a.id) || Boolean(s.redTag), needs_redress: Boolean(a.redress_each_run), went_out: wentOut(a) };
  });
  // Where each piece goes (actions.ts:166-184). Status is only touched by a red tag (actions.ts:187-192).
  // A "can't find" piece that came back is found (return/actions.ts).
  for (const s of scans) if (A(s.id).status === "missing") A(s.id).status = "in_service";
  for (const s of scans) {
    const a = A(s.id);
    if (s.to === "truck" && unit) Object.assign(a, { unit_id: unit.id, yard_id: unit.yard_id, scanned_at: now, scanned_unit_id: unit.id, last_seen_where: `checked in on ${unit.name}` });
    else Object.assign(a, { unit_id: null, yard_id: yardId, scanned_unit_id: null, last_seen_where: s.rack || "checked in" });
    if (s.redTag && a.status !== "out_of_service") Object.assign(a, { status: "out_of_service", last_seen_where: `red-tagged at check-in: ${s.redTag}` });
  }
  const notReturned = Object.entries(i.notReturned ?? {}).filter(([id]) => byId.has(id) && !seen.has(id)).map(([id, outcome]) => ({ asset_id: id, outcome }));
  for (const n of notReturned) if (n.outcome === "missing" && A(n.asset_id).status !== "out_of_service") A(n.asset_id).status = "missing";
  for (const id of [...seen, ...notReturned.filter((n) => n.outcome === "missing").map((n) => n.asset_id)]) {
    Object.assign(A(id), { out_since: null, out_loadout_id: null, out_with_user: null, out_with_name: null });
  }
  for (const s of scans) if (A(s.id).redress_each_run) A(s.id).needs_redress_since = now;
  // tripNotScanned (actions.ts:27-46), against the check-ins before this one.
  let unscanned: "never" | "not_ready" | null = null;
  if (unit && scans.length) {
    const last = latestFirst(y.loadouts.filter((l) => l.unit_id === unit.id), now)[0];
    const prevBack = y.returns.filter((r) => r.unit_id === unit.id && r.finished_at < now).map((r) => r.finished_at).sort().at(-1) ?? null;
    if (!last || (prevBack && prevBack > last.finished_at)) unscanned = prevBack && Date.parse(now) - Date.parse(prevBack) < 12 * H ? null : "never";
    else if (last.verdict !== "ready" && !y.overrides.some((o) => o.loadout_id === last.id)) unscanned = "not_ready";
  }
  const ret: Ret = { id: `ret-${++y.seq}`, unit_id: unit?.id ?? null, unit_name: unit?.name ?? null, yard_id: yardId, returned_by: i.by, finished_at: now, pieces, not_returned: notReturned };
  y.returns.push(ret);
  y.events.push({ kind: "returned", actor: i.by, unit_id: unit?.id ?? null, message: `${unit ? `${unit.name} checked in` : "Iron checked in"} by ${i.by}`, created_at: now });
  if (unit && unscanned) {
    y.events.push({ kind: "unscanned_trip", actor: i.by, unit_id: unit.id, created_at: now, message: unscanned === "never"
      ? `${unit.name} came back from a job it was never scanned out for. Checked in by ${i.by}.`
      : `${unit.name} came back, but its last load-out was NOT READY and nobody rolled it. It left without being cleared. Checked in by ${i.by}.` });
  }
  return ret;
}

/** signOutTools' refusals (signout/actions.ts:62-80). */
function signOutRefusals(y: Yard, ids: string[], today: string): { name: string; why: string }[] {
  const refused: { name: string; why: string }[] = [];
  for (const id of ids) {
    const a = y.assets.find((x) => x.id === id)!;
    const name = pieceLabel({ name: a.name, serial: a.identifier });
    const why = a.status === "retired" ? "Retired" : a.status === "out_of_service" ? "Red-tagged" : a.status === "missing" ? "Flagged missing"
      : a.needs_redress_since ? "Needs redress" : a.out_with_name ? `Already out with ${a.out_with_name}` : a.out_since ? "Out on a job, not checked back in" : null;
    if (why) { refused.push({ name, why }); continue; }
    const mine = y.items.filter((it) => it.parent_id === id);
    if (!mine.length && TESTED_CATEGORIES.has(a.category)) { refused.push({ name, why: "No test on file" }); continue; }
    for (const it of mine) {
      const j = judgeItem(it, today, today);
      if (j.result === "expired") { refused.push({ name, why: `Out of test: ${it.title}` }); break; }
      if (isNoPaper(j)) { refused.push({ name, why: `No paper: ${it.title}` }); break; }
      if (j.result === "missing") { refused.push({ name, why: `No test date: ${it.title}` }); break; }
    }
  }
  return refused;
}
function signOut(y: Yard, i: { ids: string[]; to: string; by: string; at: string; note?: string }) {
  const refused = signOutRefusals(y, i.ids, dayAt(i.at));
  if (refused.length) return { ok: false, refused };
  const day = new Date(i.at).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
  for (const id of i.ids) {
    Object.assign(y.assets.find((a) => a.id === id)!, { out_since: i.at, out_with_user: i.to, out_with_name: i.to, out_loadout_id: null, unit_id: null,
      last_seen_where: `signed out to ${i.to} ${day}${i.note ? ` (${i.note})` : ""}` });
  }
  y.events.push({ kind: "signed_out", actor: i.by, unit_id: null, message: `${i.by} signed out ${i.ids.join(", ")}`, created_at: i.at });
  return { ok: true, refused };
}
function redressed(y: Yard, id: string, by: string, at: string) {
  const a = y.assets.find((x) => x.id === id)!;
  a.needs_redress_since = null;
  y.events.push({ kind: "redressed", actor: by, unit_id: a.unit_id, message: `${by} redressed ${a.name}`, created_at: at });
}

// ---------------------------------------------------------------- screens

const equipment = (y: Yard, today: string) =>
  buildEquipment({ assets: y.assets, units: y.units.map(({ id, name, yard_id }) => ({ id, name, yard_id })), yards: y.yards, items: y.items }, today);

/** getCompanyReadiness' tiles (readiness.ts:44-95): live iron with id, name, serial, unit, status, and its tests. */
function tiles(y: Yard, today: string): UnitTile[] {
  const live = y.assets.filter((a) => a.status !== "retired");
  return y.units.map((u) => {
    const on = live.filter((a) => a.unit_id === u.id);
    const j = judgeUnit({
      unitItems: [], crew: [], crewItems: [],
      assets: on.map((a) => ({ id: a.id, name: withSerial(a.name, a.identifier), status: a.status })),
      assetItems: on.flatMap((a) => y.items.filter((it) => it.parent_id === a.id)),
    }, today, today);
    return { id: u.id, yardId: u.yard_id, name: u.name, type: u.type, yardName: y.yards.find((x) => x.id === u.yard_id)!.name, state: j.verdict, why: j.why, crewWorst: null };
  });
}

/** The Load out home page (app/app/page.tsx), optionally filtered to one yard. */
function board(y: Yard, at: string, yardId: string | null = null) {
  const now = Date.parse(at), today = dayAt(at);
  const list = equipment(y, today);
  const all = tiles(y, today);
  const units = yardId ? all.filter((u) => u.yardId === yardId) : all;
  const unitIds = new Set(units.map((u) => u.id));
  // page.tsx:52-53 and the returns query: the company's newest 300 load-outs and 400 check-ins.
  // plus each truck's newest of each (the saas_loadout_latest / saas_return_latest views).
  const newestPer = <T extends { unit_id: string | null; finished_at: string }>(rows: T[]) => {
    const m = new Map<string, T>();
    for (const r of latestFirst(rows, at)) if (r.unit_id && !m.has(r.unit_id)) m.set(r.unit_id, r);
    return [...m.values()];
  };
  const scanRows = latestFirst([...new Set([...latestFirst(y.loadouts, at).slice(0, 300), ...newestPer(y.loadouts)])], at);
  const returnRows = [...latestFirst(y.returns, at).slice(0, 400), ...newestPer(y.returns)];
  const overridden = new Map(y.overrides.filter((o) => o.created_at <= at).map((o) => [o.loadout_id, o.created_at]));
  const kits = new Map([...y.kits].map(([u, k]) => [u, k.lines]));
  const built = buildLoadOutTrucks(units, list.rows, scanRows, overridden, today, kitShortByTruck(kits, list.rows),
    { returns: returnRows.map((r) => ({ unit_id: r.unit_id, finished_at: r.finished_at, returned_by: r.returned_by })), now, alertDays: y.alertDays });
  // Late plans (page.tsx:72-86).
  const latest = new Map<string, { finished_at: string; rolled: boolean }>();
  for (const r of scanRows) if (r.unit_id && !latest.has(r.unit_id)) latest.set(r.unit_id, { finished_at: r.finished_at, rolled: r.verdict === "ready" || overridden.has(r.id) });
  const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, ...(dayAt(iso) === today ? {} : { weekday: "short" as const }), hour: "numeric", minute: "2-digit" });
  const late = new Map<string, string | null>();
  for (const p of y.plans) if (!p.usedAt || p.usedAt > at) late.set(p.unitId, lateLine(p, latest.get(p.unitId) ?? null, now, timeText));
  // The iron counts (page.tsx:101-111).
  const inScope = (a: Asset) => !yardId || a.yard_id === yardId || (a.unit_id !== null && unitIds.has(a.unit_id));
  const outList = y.assets.filter((a) => a.out_since && a.status !== "retired" && a.status !== "missing").filter(inScope);
  const iron = { out: outList.length, outTooLong: outList.filter((a) => daysOut(a.out_since, now) >= y.alertDays).length };
  // Last 7 days by person (page.tsx:115-147), manager view.
  const weekAgo = new Date(now - 7 * 24 * H).toISOString();
  const inYard = (r: { unit_id: string | null }) => !yardId || (r.unit_id !== null && unitIds.has(r.unit_id));
  const people = new Map<string, { loadouts: number; returns: number; other: number; idle?: boolean }>();
  for (const e of y.events) {
    if (!e.actor || e.created_at < weekAgo || e.created_at > at || !inYard(e)) continue;
    const p = people.get(e.actor) ?? { loadouts: 0, returns: 0, other: 0 };
    if (e.kind.startsWith("loadout_")) p.loadouts++; else if (e.kind === "returned") p.returns++; else p.other++;
    people.set(e.actor, p);
  }
  const weekScans = y.loadouts.filter((l) => l.finished_at >= weekAgo && l.finished_at <= at).filter(inYard);
  for (const sc of weekScans) if (sc.scanned_by && !people.has(sc.scanned_by)) people.set(sc.scanned_by, { loadouts: 0, returns: 0, other: 0 });
  const activeAnywhere = new Set([...y.events.filter((e) => e.actor && e.created_at >= weekAgo && e.created_at <= at).map((e) => e.actor),
    ...y.loadouts.filter((l) => l.finished_at >= weekAgo && l.finished_at <= at).map((l) => l.scanned_by)]);
  for (const n of y.members) if (!people.has(n) && !activeAnywhere.has(n)) people.set(n, { loadouts: 0, returns: 0, other: 0, idle: true });
  const unitOf = (loadoutId: string) => y.loadouts.find((l) => l.id === loadoutId)?.unit_id ?? "";
  const week = weekNumbers(weekScans, y.overrides.filter((o) => o.created_at >= weekAgo && o.created_at <= at && (!yardId || unitIds.has(unitOf(o.loadout_id)))).length);
  return { ...built, row: (id: string) => built.trucks.find((t) => t.t.id === id)!, late, iron, people, week, list };
}

/** sendMorningSummaries' DaySummary for one company, at the cron's moment (morning-summary.ts:80-150). */
function morning(y: Yard, at: string) {
  const now = Date.parse(at), today = dayAt(at);
  const since = new Date(now - 24 * H).toISOString(), weekAgo = new Date(now - 7 * 24 * H).toISOString();
  const within = (t: string) => t >= since && t <= at;
  const loads = y.loadouts.filter((l) => within(l.finished_at));
  const ovs = y.overrides.filter((o) => within(o.created_at));
  const ovIds = new Set(ovs.map((o) => o.loadout_id));
  const unitName = (id: string) => y.units.find((u) => u.id === id)?.name;
  const timeText = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
  const late: string[] = [];
  for (const p of y.plans.filter((x) => x.leavesAt && (!x.usedAt || x.usedAt > at))) {
    const l = latestFirst(y.loadouts.filter((x) => x.unit_id === p.unitId), at)[0];
    const rolled = l ? l.verdict === "ready" || y.overrides.some((o) => o.loadout_id === l.id && o.created_at <= at) : false;
    const line = lateLine(p, l ? { finished_at: l.finished_at, rolled } : null, now, timeText);
    if (line) late.push(`${unitName(p.unitId) ?? "A truck"}: ${line}`);
  }
  // Out too long: per piece, from each piece's out_since (morning-summary.ts:116-127).
  const outByTruck = new Map<string, number[]>();
  const withPeople: string[] = [];
  for (const a of y.assets.filter((x) => x.out_since && x.status !== "retired" && x.status !== "missing")) {
    const d = daysOut(a.out_since, now);
    if (d < y.alertDays) continue;
    if (a.out_with_name) withPeople.push(`With ${a.out_with_name}: ${a.name}${a.identifier ? ` ${a.identifier}` : ""}, out ${d} days`);
    else outByTruck.set(a.unit_id ?? "", [...(outByTruck.get(a.unit_id ?? "") ?? []), d]);
  }
  const rets = y.returns.filter((r) => within(r.finished_at));
  const active = new Set(y.events.filter((e) => e.actor && e.created_at >= weekAgo && e.created_at <= at).map((e) => e.actor));
  const s: DaySummary = {
    company: y.company,
    loadouts: loads.length,
    ready: loads.filter((l) => l.verdict === "ready").length,
    blocked: loads.filter((l) => l.verdict !== "ready" && !ovIds.has(l.id)).map((l) => `${l.unit_name}: ${l.reasons[0] ?? "NOT READY"}`),
    overrides: ovs.map((o) => `${y.loadouts.find((l) => l.id === o.loadout_id)?.unit_name ?? "A truck"} by ${o.by_name}: "${o.reason}"`),
    checkins: rets.length,
    unscanned: y.events.filter((e) => e.kind === "unscanned_trip" && within(e.created_at)).map((e) => e.message),
    late,
    outTooLong: [...[...outByTruck].map(([u, ds]) => `${unitName(u) ?? "In the yard"}: ${ds.length} ${ds.length === 1 ? "piece" : "pieces"}, out ${Math.max(...ds)} days`), ...withPeople],
    damaged: rets.flatMap((r) => r.pieces.filter((p) => p.red_tag).map((p) => damagedLine(p, r.returned_by))),
    redressWaiting: y.assets.filter((a) => a.needs_redress_since && a.status !== "retired").length,
    weekly: new Date(now).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short" }) === "Mon",
    idle: y.members.filter((m) => !active.has(m)),
    crew: y.members.length,
    noPaper: y.items.filter((it) => y.assets.some((a) => a.id === it.parent_id && a.status !== "retired") && isNoPaper(judgeItem(it, today, today))).length,
  };
  return { s, msg: summaryText(s) };
}

const searchable = (rows: EquipRow[], now: number, alertDays: number): SearchablePiece[] =>
  rows.map((r) => ({ ...r, serial: r.identifier, typeLabel: categoryLabel(r.category), nextTitle: r.next?.title ?? null,
    place: placeOf({ status: r.status, unit_id: r.unitId, out_since: r.outSince }, now, alertDays) }));
/** The scan page's red/yellow flag on a piece (scan-pieces.ts:28). */
const phoneProblem = (r: EquipRow) =>
  r.state === "overdue" || r.state === "down" || (r.state === "no_paper" && TESTED_CATEGORIES.has(r.category)) ? "red" : r.state === "due" ? "yellow" : null;

// ---------------------------------------------------------------- the company

function renegade(): Yard {
  const yards = [{ id: "ody", name: "Odessa Yard" }, { id: "mid", name: "Midland Yard" }, { id: "hob", name: "Hobbs Yard" }];
  const units: Unit[] = [
    { id: "ct3", name: "CT-03", yard_id: "ody", type: "coil_tubing_unit" },
    { id: "wl11", name: "WL-11", yard_id: "ody", type: "wireline_truck" },
    { id: "ct8", name: "CT-08", yard_id: "mid", type: "coil_tubing_unit" },
    { id: "wl14", name: "WL-14", yard_id: "mid", type: "wireline_truck" },
    { id: "wl21", name: "WL-21", yard_id: "hob", type: "wireline_truck" },
  ];
  const assets: Asset[] = [
    asset("bop3", "Quad BOP stack #3", "QB-4471", "pressure_control", { unit: "ct3", yard: "ody" }),
    asset("lub1", "Lubricator #1", "LB-811", "pressure_control", { unit: "ct3", yard: "ody" }),
    asset("lub2", "Lubricator #2", "LB-812", "pressure_control", { unit: "ct3", yard: "ody" }),
    asset("inj1", "Injector head #1", "IH-31", "equipment", { unit: "ct3", yard: "ody" }),
    asset("pv1", 'Plug valve 2" #1', "PV-2201", "flow_iron", { yard: "ody" }),
    asset("pv2", 'Plug valve 2" #2', "PV-2202", "flow_iron", { yard: "ody" }),
    asset("xo1", 'Crossover 2" x 3" #1', "XO-11", "flow_iron", { yard: "ody" }),
    // Added from a phone last week, picked as Equipment, no test on file.
    asset("bop9", "Quad BOP stack #9", null, "equipment", { yard: "ody" }),
    asset("sf5", "Silver Fox setting tool #5", "SF-5", "tool", { unit: "wl11", yard: "ody" }, { redress_each_run: true }),
    asset("gr1", "Gamma ray tool #1", "GR-1", "equipment", { unit: "wl11", yard: "ody" }),
    asset("lub11", "Lubricator 10 ft #11", "LB-1011", "pressure_control", { unit: "wl11", yard: "ody" }),
    asset("sf2", "Silver Fox setting tool #2", "SF-2", "tool", { yard: "ody" }, { redress_each_run: true }),
    asset("bk4", "Baker 20 setting tool #4", "BK-4", "tool", { yard: "ody" }),
    asset("bop8", "Quad BOP stack #8", "QB-4408", "pressure_control", { unit: "ct8", yard: "mid" }),
    asset("lub3", "Lubricator #3", "LB-813", "pressure_control", { unit: "ct8", yard: "mid" }),
    asset("reel8", "Reel R-8", "R-8", "equipment", { unit: "ct8", yard: "mid" }),
    asset("gr14", "Gamma ray tool #14", "GR-14", "equipment", { unit: "wl14", yard: "mid" }),
    asset("ccl14", "CCL tool #14", "CCL-14", "equipment", { unit: "wl14", yard: "mid" }),
    asset("lub21", "Lubricator 10 ft #21", "LB-1021", "pressure_control", { unit: "wl21", yard: "hob" }),
    asset("pv7", 'Plug valve 2" #7', "PV-2207", "flow_iron", { unit: "wl21", yard: "hob" }),
    asset("gr21", "Gamma ray tool #21", "GR-21", "equipment", { unit: "wl21", yard: "hob" }),
  ];
  const items: RawItem[] = [
    cert("bop3", "BOP pressure test", "2027-03-01"), cert("lub1", "Lubricator pressure test", "2027-01-15"), cert("lub2", "Lubricator pressure test", "2026-12-20"),
    cert("inj1", "Annual inspection", "2027-05-01"), cert("pv1", "Pressure test", "2027-02-01"), cert("pv2", "Pressure test", "2027-02-01"),
    cert("xo1", "Pressure test", "2027-04-01"), cert("sf5", "Annual inspection", "2027-06-01"), cert("gr1", "Source check", "2027-04-01"),
    cert("lub11", "Lubricator pressure test", "2027-02-01"), cert("sf2", "Annual inspection", "2027-06-01"), cert("bk4", "Annual inspection", "2027-06-01"),
    cert("bop8", "BOP pressure test", "2027-03-01"), cert("lub3", "Lubricator pressure test", "2026-10-30"), cert("reel8", "Annual inspection", "2027-01-01"),
    cert("gr14", "Source check", "2027-04-01"), cert("ccl14", "Annual inspection", "2027-04-01"),
    cert("lub21", "Lubricator pressure test", "2027-02-01"), cert("pv7", "Pressure test", "2027-02-01"), cert("gr21", "Source check", "2027-04-01"),
  ];
  const kitOf = (unit: string, checks: string[] = []) => ({ lines: kitLinesFrom(assets.filter((a) => a.unit_id === unit).map((a) => a.name)), checks });
  return {
    company: "Renegade Wireline", yards, units, assets, items,
    kits: new Map([["ct3", kitOf("ct3", ["BOP rams closed for travel"])], ["wl11", kitOf("wl11")], ["ct8", kitOf("ct8")], ["wl14", kitOf("wl14")], ["wl21", kitOf("wl21")]]),
    packages: new Map([["coil", { name: "Standard Coil Package", lines: [{ label: "Plug valve 2-inch", qty: 2 }], checks: ["Everything strapped and padded"] }]]),
    plans: [{ id: "plan-ct3", unitId: "ct3", packageIds: ["coil"], lines: [{ label: 'Crossover 2"', qty: 1 }], job: "Hobbs State 14-2H", by: "Kevin Odom",
      at: ct("2026-11-08 16:00"), leavesAt: ct("2026-11-09 06:00"), usedAt: null }],
    loadouts: [], overrides: [], returns: [], events: [],
    members: ["Kevin Odom", "Ray Hinojosa", "Dale Wooten", "Lupe Cardenas", "Freddy Carrasco", "Jesse Ruiz", "Tony Salas"],
    alertDays: 7, seq: 0,
  };
}

function runWeek() {
  const y = renegade();
  // Last week, for the 7-day "who used it" window.
  y.events.push(
    { kind: "loadout_ready", actor: "Ray Hinojosa", unit_id: "ct3", message: "last week", created_at: ct("2026-11-05 06:00") },
    { kind: "loadout_ready", actor: "Dale Wooten", unit_id: "wl11", message: "last week", created_at: ct("2026-11-05 07:00") },
    { kind: "loadout_ready", actor: "Freddy Carrasco", unit_id: "wl21", message: "last week", created_at: ct("2026-11-06 06:30") },
    { kind: "returned", actor: "Jesse Ruiz", unit_id: null, message: "last week", created_at: ct("2026-11-06 17:00") },
  );
  // CT-08 blocked on an out-of-test lubricator Monday Nov 2 at 4:30 PM, rolled on override at 6 AM the next morning.
  const ct8Lo = loadOut(y, { unit: "ct8", by: "Lupe Cardenas", at: ct("2026-11-02 16:30"), scans: ["bop8", "lub3", "reel8"] });
  const ct8Ov = override(y, ct8Lo.id, "Kevin Odom", ct("2026-11-03 06:00"), "Lubricator recert is booked, we swap it on location");

  // Monday.
  const monEmail = morning(y, ct("2026-11-09 05:30"));
  const phoneList = equipment(y, "2026-11-09").rows; // the scan page as Ray opened it at 5:25
  const try1 = loadOut(y, { unit: "ct3", by: "Ray Hinojosa", startedAt: ct("2026-11-09 05:25"), at: ct("2026-11-09 05:40"),
    scans: ["bop9", "lub1", "lub2", "inj1", "pv1", "pv2", "xo1"], checks: ["Everything strapped and padded"] });
  // "Fix it and scan again" keeps every scan the phone doesn't flag red (scanner.tsx:528).
  const phoneKeep = try1.pieces.map((p) => p.asset_id).filter((id) => phoneProblem(phoneList.find((r) => r.id === id)!) !== "red" && !try1.pieces.find((p) => p.asset_id === id)?.red);
  const bop3After1 = { ...y.assets.find((a) => a.id === "bop3")! };
  const board0550 = board(y, ct("2026-11-09 05:50"));
  const board0605 = board(y, ct("2026-11-09 06:05"));
  const try2 = loadOut(y, { unit: "ct3", by: "Ray Hinojosa", startedAt: ct("2026-11-09 06:02"), at: ct("2026-11-09 06:15"),
    scans: ["lub1", "lub2", "inj1", "pv1", "pv2", "xo1", "bop3"], checks: ["BOP rams closed for travel", " everything strapped and padded"] });
  const board0620 = board(y, ct("2026-11-09 06:20"));
  loadOut(y, { unit: "wl21", by: "Freddy Carrasco", at: ct("2026-11-09 07:00"), scans: ["lub21", "pv7", "gr21"] });
  loadOut(y, { unit: "wl11", by: "Dale Wooten", at: ct("2026-11-09 07:30"), scans: ["sf5", "gr1", "lub11"] });
  checkIn(y, { unit: "wl21", by: "Freddy Carrasco", at: ct("2026-11-09 19:00"), scans: [{ id: "lub21" }, { id: "pv7" }, { id: "gr21" }] });
  const monLate = board(y, ct("2026-11-09 23:55"));
  const tueEarly = board(y, ct("2026-11-10 00:05"));

  // Tuesday. WL-14 blocked (no truck photo); the crew leaves anyway.
  loadOut(y, { unit: "wl14", by: "Lupe Cardenas", at: ct("2026-11-10 05:00"), scans: ["gr14", "ccl14"], photo: false });
  const tueEmail = morning(y, ct("2026-11-10 05:30"));
  const tueBoard = board(y, ct("2026-11-10 05:30"));
  const daleOut = signOut(y, { ids: ["sf2"], to: "Dale Wooten", by: "Dale Wooten", at: ct("2026-11-10 07:00"), note: "Midland frac job" });
  const lupeOut = signOut(y, { ids: ["bk4"], to: "Lupe Cardenas", by: "Lupe Cardenas", at: ct("2026-11-10 07:05") });
  const againRefused = signOutRefusals(y, ["sf2", "bk4"], "2026-11-10");
  const tueList = equipment(y, "2026-11-10");

  // Wednesday. WL-11 back with its setting tool; the two signed-out tools come back to the counter; WL-14 comes back.
  checkIn(y, { unit: "wl11", by: "Dale Wooten", at: ct("2026-11-11 17:00"), scans: [{ id: "sf5" }, { id: "gr1" }, { id: "lub11" }] });
  checkIn(y, { unit: null, yard: "ody", by: "Jesse Ruiz", at: ct("2026-11-11 18:00"), scans: [{ id: "bk4", redTag: "threads galled", rack: "tool room" }] });
  checkIn(y, { unit: null, yard: "ody", by: "Jesse Ruiz", at: ct("2026-11-11 18:10"), scans: [{ id: "sf2", rack: "tool room" }] });
  checkIn(y, { unit: "wl14", by: "Lupe Cardenas", at: ct("2026-11-11 19:00"), scans: [{ id: "gr14" }, { id: "ccl14" }] });

  // Thursday. WL-21 can't find a valve and rolls on override; a manager approves WL-14's Tuesday record after the fact.
  const wl21Lo = loadOut(y, { unit: "wl21", by: "Freddy Carrasco", at: ct("2026-11-12 05:00"), scans: ["lub21", "gr21"], off: { pv7: "missing" } });
  const wl21Ov = override(y, wl21Lo.id, "Kevin Odom", ct("2026-11-12 05:20"), "PV-2207 rides in the side box, the crew confirms it on location");
  const thuEmail = morning(y, ct("2026-11-12 05:30"));
  const thuBoard = board(y, ct("2026-11-12 05:30"));
  const wl14Ov = override(y, y.loadouts.find((l) => l.unit_id === "wl14")!.id, "Kevin Odom", ct("2026-11-12 08:00"), "Crew had the truck photo on a personal phone, approved");
  const thu0830 = board(y, ct("2026-11-12 08:30"));
  const yardBoards = { ody: board(y, ct("2026-11-12 08:30"), "ody"), mid: board(y, ct("2026-11-12 08:30"), "mid"), hob: board(y, ct("2026-11-12 08:30"), "hob") };
  const thuEmailIdle = morning(y, ct("2026-11-12 08:30")).s.idle;
  const thuRefused = signOutRefusals(y, ["sf2", "bk4"], "2026-11-12");
  const wl11Try = loadOut(y, { unit: "wl11", by: "Dale Wooten", at: ct("2026-11-12 09:00"), scans: ["sf5", "gr1", "lub11"] });
  redressed(y, "sf5", "Dale Wooten", ct("2026-11-12 09:10"));
  const wl11Again = loadOut(y, { unit: "wl11", by: "Dale Wooten", startedAt: ct("2026-11-12 09:12"), at: ct("2026-11-12 09:20"), scans: ["sf5", "gr1", "lub11"] });
  redressed(y, "sf2", "Jesse Ruiz", ct("2026-11-12 10:00"));
  const thuLaterRefused = signOutRefusals(y, ["sf2"], "2026-11-12");

  // Friday, Saturday (WL-21 back, the valve turns up in the side box), and the next Monday.
  const friEmail = morning(y, ct("2026-11-13 05:30"));
  const satRet = checkIn(y, { unit: "wl21", by: "Freddy Carrasco", at: ct("2026-11-14 16:00"), scans: [{ id: "lub21" }, { id: "gr21" }, { id: "pv7" }] });
  const satAt = ct("2026-11-14 16:30");
  const satBoard = board(y, satAt);
  const monNextEmail = morning(y, ct("2026-11-16 05:30"));
  const nov20Email = morning(y, ct("2026-11-20 05:30"));
  return { y, ct8Ov, monEmail, phoneKeep, try1, bop3After1, board0550, board0605, try2, board0620, monLate, tueEarly, tueEmail, tueBoard,
    daleOut, lupeOut, againRefused, tueList, wl21Lo, wl21Ov, thuEmail, thuBoard, wl14Ov, thu0830, yardBoards, thuEmailIdle, thuRefused,
    wl11Try, wl11Again, thuLaterRefused, friEmail, satRet, satAt, satBoard, monNextEmail, nov20Email };
}
const W = runWeek();

// ---------------------------------------------------------------- the week

describe("Monday: CT-03's planned coil job, tapped in on an iPhone", () => {
  it("first try: the look-alike BOP with no test and the skipped roll check block it, by name", () => {
    expect(W.try1.verdict).toBe("not_ready");
    expect(W.try1.reasons).toEqual(["No test on file: Quad BOP stack #9", "Not confirmed: BOP rams closed for travel"]);
    expect(W.try1.pieces.find((p) => p.asset_id === "bop9")!.red).toBe(true);
    // The real BOP wasn't tapped, so the phone sent it as taken off: it's in the yard now.
    expect(W.bop3After1.unit_id).toBeNull();
  });

  it("the board shows CT-03 blocked with the first reason, then late once 6:00 AM passes", () => {
    const r = W.board0550.row("ct3");
    expect(r.status).toBe("blocked");
    expect(r.why).toBe("No test on file: Quad BOP stack #9 (and 1 more)");
    expect(sp(r.loadoutLine)).toBe("Blocked at load-out 5:40 AM by Ray Hinojosa");
    expect(W.board0550.late.get("ct3")).toBeNull();
    expect(sp(W.board0605.late.get("ct3"))).toBe("Was planned to leave 6:00 AM. Still NOT READY.");
  });

  // scanner.tsx:528 keeps every scan whose phone flag isn't red, and the phone
  // (scan-pieces.ts:28) only flags untested iron red in a tested category.
  // A look-alike picked as Equipment reads clean on the phone, so "Fix it and
  // scan again" keeps the exact piece the server just blocked.
  it("'Fix it and scan again' takes off the piece the server named, not just the ones the phone flagged", () => {
    expect(W.phoneKeep).not.toContain("bop9");
  });

  it("rescanned with the real BOP and both checks: READY, the plan's job on the record, the plan used up", () => {
    expect(W.try2.reasons).toEqual([]);
    expect(W.try2.verdict).toBe("ready");
    expect(W.try2.job).toBe("Hobbs State 14-2H");
    expect(W.try2.not_scanned.map((n) => [n.asset_id, n.outcome])).toEqual([["bop9", "yard"]]);
    const r = W.board0620.row("ct3");
    expect(r.status).toBe("out");
    expect(sp(r.loadoutLine)).toBe("Out on a job since today 6:15 AM by Ray Hinojosa");
    expect(W.board0620.late.has("ct3")).toBe(false);
  });

  it("across midnight in Odessa: 'today 6:15 AM' at 11:55 PM, 'Nov 9 (less than a day)' at 12:05 AM", () => {
    expect(W.monLate.row("ct3").doneToday).toBe(true);
    expect(sp(W.monLate.row("ct3").loadoutLine)).toBe("Out on a job since today 6:15 AM by Ray Hinojosa");
    expect(W.tueEarly.row("ct3").doneToday).toBe(false);
    expect(W.tueEarly.row("ct3").loadoutLine).toBe("Out on a job since Nov 9 (less than a day) by Ray Hinojosa");
  });

  it("Tuesday's email counts both tries; the blocked first try still reads as blocked although CT-03 rolled READY 35 minutes later", () => {
    expect(W.tueEmail.msg!.body).toContain("5 load-outs (3 READY, 2 blocked), 1 check-in.");
    expect(W.tueEmail.s.blocked).toEqual(["CT-03: No test on file: Quad BOP stack #9", "WL-14: No photo of the loaded truck"]);
  });
});

describe("CT-08 out on a manager's override since Nov 3", () => {
  it("the board says out on an override, never blocked", () => {
    expect(W.ct8Ov).toBe("rolled");
    const r = W.tueBoard.row("ct8");
    expect(r.status).toBe("out");
    expect(r.overridden).toBe(true);
    // The trip starts at the override (Nov 3 6:00 AM), like the email and the alert count it.
    expect(r.loadoutLine).toMatch(/^Out on a manager's override since Nov 3/);
  });

  it("Thursday's email lists it out too long", () => {
    expect(W.thuEmail.s.outTooLong).toEqual(["CT-08: 3 pieces, out 8 days"]);
    expect(W.thuEmail.msg!.body).toContain("Out too long, not checked back in:\n  CT-08: 3 pieces, out 8 days");
  });

  // loadout-board.ts:106 counts from the NOT READY load-out (Nov 2 4:30 PM);
  // the email and the out-too-long sweep count each piece's out_since, which
  // rollLoadoutAnyway sets to the override time (loadouts/[id]/actions.ts:62).
  it("the board and the email agree on how long CT-08 has been out", () => {
    // Tuesday 5:30 AM: board says "Out 7 days" in red; the email doesn't list it.
    expect(W.tueBoard.row("ct8").outTooLong).toBe(W.tueEmail.s.outTooLong.some((l) => l.startsWith("CT-08")));
    // Thursday: board "Out 9 days", email "out 8 days".
    expect(W.thuBoard.row("ct8").why).toBe("Out 8 days. Check it in, or find out where it is.");
  });
});

describe("a 3-yard company's board after 9 days (36 trucks, one load-out each a day)", () => {
  const big: Yard = {
    company: "Renegade Wireline", yards: [{ id: "ody", name: "Odessa Yard" }, { id: "mid", name: "Midland Yard" }, { id: "hob", name: "Hobbs Yard" }],
    units: [], assets: [], items: [], kits: new Map(), packages: new Map(), plans: [], loadouts: [], overrides: [], returns: [], events: [], members: [], alertDays: 7, seq: 0,
  };
  for (const yd of big.yards) for (let n = 1; n <= 12; n++) {
    const id = `${yd.id}-${n}`;
    big.units.push({ id, name: `${yd.id.toUpperCase()}-${String(n).padStart(2, "0")}`, yard_id: yd.id, type: "wireline_truck" });
    big.assets.push(asset(`gr-${id}`, `Gamma ray tool #${big.units.length}`, `GR-${big.units.length}`, "equipment", { unit: id, yard: yd.id }));
    big.items.push(cert(`gr-${id}`, "Source check", "2027-04-01"));
    big.kits.set(id, { lines: [{ label: "Gamma ray tool", qty: 1 }], checks: [] });
  }
  const stuck = loadOut(big, { unit: "mid-1", by: "Lupe Cardenas", at: ct("2026-11-02 16:30"), scans: ["gr-mid-1"], photo: false });
  override(big, stuck.id, "Kevin Odom", ct("2026-11-03 06:00"), "Photo is on the crew phone, roll it");
  for (let d = 3; d <= 11; d++) {
    const day = `2026-11-${String(d).padStart(2, "0")}`;
    big.units.filter((u) => u.id !== "mid-1").forEach((u, i) => {
      loadOut(big, { unit: u.id, by: "Ray Hinojosa", at: ct(`${day} 06:${String(i).padStart(2, "0")}`), scans: [`gr-${u.id}`] });
      checkIn(big, { unit: u.id, by: "Ray Hinojosa", at: ct(`${day} 18:${String(i).padStart(2, "0")}`), scans: [{ id: `gr-${u.id}` }] });
    });
  }
  const at = ct("2026-11-12 05:30");

  it("the morning email lists MID-01 out too long", () => {
    expect(big.loadouts.length).toBe(316);
    expect(morning(big, at).s.outTooLong).toEqual(["MID-01: 1 piece, out 8 days"]);
  });

  // app/app/page.tsx:53 reads the company's newest 300 load-outs. At ~35 a
  // day that's 8.5 days, so the truck that's been out longest is exactly the
  // one whose load-out falls off: no load-out, so it reads "Ready to load".
  it("the board still shows MID-01 out too long, not Ready to load", () => {
    const b = board(big, at);
    expect(b.row("mid-1").status).toBe("out");
    expect(b.row("mid-1").outTooLong).toBe(true);
  });
});

describe("midweek: tools signed out to two people", () => {
  it("each reads 'With <name>' and can't be signed out twice", () => {
    expect(W.daleOut.ok && W.lupeOut.ok).toBe(true);
    const row = (id: string) => W.tueList.rows.find((r) => r.id === id)!;
    expect(row("sf2").where).toBe("With Dale Wooten");
    expect(row("sf2").note).toBe("Midland frac job");
    expect(row("bk4").where).toBe("With Lupe Cardenas");
    expect(W.againRefused).toEqual([
      { name: "Silver Fox setting tool #2 SF-2", why: "Already out with Dale Wooten" },
      { name: "Baker 20 setting tool #4 BK-4", why: "Already out with Lupe Cardenas" },
    ]);
  });

  it("Thursday's email: Lupe's came back damaged (named, with whose it was), two tools wait on redress, WL-14 left uncleared", () => {
    expect(W.thuEmail.s.damaged).toEqual(["Baker 20 setting tool #4 BK-4: threads galled. Signed out to Lupe Cardenas Nov 10. Checked in by Jesse Ruiz."]);
    expect(W.thuEmail.s.redressWaiting).toBe(2);
    expect(W.thuEmail.s.unscanned).toEqual(["WL-14 came back, but its last load-out was NOT READY and nobody rolled it. It left without being cleared. Checked in by Lupe Cardenas."]);
    expect(W.thuEmail.msg!.subject).toBe("RollReady: 1 truck not checked out at Renegade Wireline");
  });

  it("the list, search, and the sign-out sheet agree neither tool can go; redressed, Dale's can", () => {
    const rows = W.thu0830.list.rows;
    const chip = (id: string) => stateLabel(rows.find((r) => r.id === id)!);
    expect([chip("bk4"), chip("sf2"), chip("sf5")]).toEqual(["Red-tagged", "Needs redress", "Needs redress"]);
    const s = searchable(rows, Date.parse(ct("2026-11-12 08:30")), 7);
    expect(searchPieces(s, "needs redress").map((p) => p.id)).toEqual(["sf2", "sf5"]);
    expect(searchPieces(s, "red tag").map((p) => p.id)).toEqual(["bk4"]);
    expect(W.thuRefused).toEqual([{ name: "Silver Fox setting tool #2 SF-2", why: "Needs redress" }, { name: "Baker 20 setting tool #4 BK-4", why: "Red-tagged" }]);
    expect(W.thuLaterRefused).toEqual([]);
  });

  it("WL-11's load-out blocks on the setting tool waiting on redress, then rolls once it's redressed", () => {
    expect(W.wl11Try.reasons).toEqual(["Needs redress: Silver Fox setting tool #5 SF-5"]);
    expect(W.wl11Again.verdict).toBe("ready");
  });

  // readiness.ts:48 reads only status, and judge.ts:144-147 fails a truck only
  // for missing or red-tagged gear. needs_redress_since (and pressure iron with
  // no test) block the load-out but never touch the tile, so the board reads
  // WL-11 clean "Ready to load" 30 minutes before its load-out is NOT READY.
  it("the board doesn't call WL-11 clean Ready to load while a tool on it waits on redress", () => {
    const r = W.thu0830.row("wl11");
    expect(r.why ?? "").toMatch(/redress/i);
  });

  it("same for untested pressure iron on a truck: the phone says red and the load-out blocks, so the tile can't be clean", () => {
    const y = renegade();
    y.assets.push(asset("lub9", "Lubricator #9", null, "pressure_control", { unit: "wl21", yard: "hob" }));
    const at = ct("2026-11-09 06:00");
    const rows = equipment(y, "2026-11-09").rows;
    expect(phoneProblem(rows.find((r) => r.id === "lub9")!)).toBe("red");
    const b = board(y, at);
    const lo = loadOut(y, { unit: "wl21", by: "Freddy Carrasco", at: ct("2026-11-09 06:10"), scans: ["lub21", "pv7", "gr21", "lub9"] });
    expect(lo.reasons).toEqual(["No test on file: Lubricator #9"]);
    expect(b.row("wl21").why ?? "").toMatch(/Lubricator #9/);
  });
});

describe("Can't find at load-out (WL-21), found at Saturday's check-in", () => {
  it("Thursday: Can't find blocks; the override rolls it; the missing valve isn't counted as out on the job", () => {
    expect(W.wl21Lo.reasons).toEqual(['Short: Plug valve 2", 0 of 1 scanned', 'Can\'t find: Plug valve 2" #7 PV-2207']);
    expect(W.wl21Ov).toBe("rolled");
    expect(W.thuBoard.row("wl21").status).toBe("out");
    expect(W.thuBoard.row("wl21").overridden).toBe(true);
  });

  it("Saturday's check-in record says the valve came back on WL-21, nothing wrong with it", () => {
    const p = W.satRet.pieces.find((x) => x.asset_id === "pv7")!;
    expect(p.to).toBe("truck");
    expect(p.red).toBe(false);
  });

  // finishLoadout puts a scanned missing piece back in service
  // (scan/actions.ts:342-343); finishReturn never does (return/actions.ts:164-184
  // only move it). The valve is back on WL-21, and every other screen says Missing.
  it("found at check-in: the list, the tile, the board, and search stop calling it Missing", () => {
    const row = W.satBoard.list.rows.find((r) => r.id === "pv7")!;
    expect(stateLabel(row)).not.toBe("Missing");
    expect(W.satBoard.row("wl21").status).not.toBe("blocked");
    const s = searchable(W.satBoard.list.rows, Date.parse(W.satAt), 7);
    expect(searchPieces(s, "can't find").map((p) => p.id)).toEqual([]);
  });
});

describe("an override after the truck already came back (WL-14)", () => {
  // loadouts/[id]/actions.ts:27-31 (and the record page, loadouts/[id]/page.tsx:67)
  // only refuse when there's a NEWER LOAD-OUT. A check-in since doesn't count,
  // so a manager approving Tuesday's trip on Thursday restarts the out clock on
  // iron parked in the Midland yard.
  it("a manager can't roll a load-out the truck was already checked in from", () => {
    expect(W.wl14Ov).not.toBe("rolled");
    const s = searchable(W.thu0830.list.rows, Date.parse(ct("2026-11-12 08:30")), 7);
    expect(PLACE_LABEL[s.find((p) => p.id === "gr14")!.place]).toBe("On truck");
    expect(W.thu0830.row("wl14").stillOut).toBeNull();
    expect(W.nov20Email.s.outTooLong.filter((l) => l.startsWith("WL-14"))).toEqual([]);
  });

  // WL-14's override is refused now, so Friday's email has none to list.
  it("Friday's email has no override for WL-14 (it was refused)", () => {
    expect(W.friEmail.s.overrides).toEqual([]);
  });
  // The email names an override's truck from its own load-out, even one from the day before.
  it("the morning after CT-08's override (its load-out was the afternoon before), the email names CT-08", () => {
    expect(morning(W.y, ct("2026-11-04 05:30")).s.overrides.map((o) => o.split(":")[0])).toEqual(["CT-08 by Kevin Odom"]);
  });
});

describe("the Monday weekly email", () => {
  it("the 11:30 UTC cron is Monday in Odessa: weekly on the 9th and 16th, not Tuesday", () => {
    expect(W.monEmail.s.weekly).toBe(true);
    expect(W.monNextEmail.s.weekly).toBe(true);
    expect(W.tueEmail.s.weekly).toBe(false);
    expect(W.monNextEmail.s.idle).toEqual(["Tony Salas"]);
    expect(W.monNextEmail.s.outTooLong).toEqual(["CT-08: 3 pieces, out 12 days"]);
  });

  // morning-summary.ts:53 tests the last 24 hours (a quiet Sunday), not the
  // week, so one idle hand turns the subject into "nobody used it this week".
  it("after a quiet Sunday, the subject doesn't say nobody used it when the crew ran 8 load-outs and 6 check-ins", () => {
    const weekLoads = W.y.loadouts.filter((l) => l.finished_at >= ct("2026-11-09 05:30") && l.finished_at < ct("2026-11-16 05:30")).length;
    expect(weekLoads).toBe(8);
    expect(W.monNextEmail.msg!.subject).not.toMatch(/nobody/i);
    expect(W.monEmail.msg!.subject).not.toMatch(/nobody/i);
  });
});

describe("the board filtered to one yard vs the whole company", () => {
  it("the three yards add up to the company: trucks, counts, iron out", () => {
    const co = W.thu0830, ys = Object.values(W.yardBoards);
    expect(ys.flatMap((b) => b.trucks.map((t) => t.t.id)).sort()).toEqual(co.trucks.map((t) => t.t.id).sort());
    for (const k of ["ready", "blocked", "out", "outTooLong"] as const) expect(ys.reduce((n, b) => n + b.counts[k], 0)).toBe(co.counts[k]);
    expect(ys.reduce((n, b) => n + b.iron.out, 0)).toBe(co.iron.out);
    expect(co.counts).toEqual({ ready: 2, blocked: 0, out: 3, outTooLong: 1 });
    // One override: WL-14's came after its check-in and was refused.
    expect(co.week).toEqual({ loadouts: 6, caught: 1, overrides: 1 });
  });

  // page.tsx:119 drops events with no truck (sign-outs, loose check-ins) and
  // other yards' trucks, then page.tsx:144 adds every company member back as idle.
  it("Odessa's board doesn't call Jesse idle: he checked in two Odessa tools this week, and the email agrees", () => {
    expect(W.thuEmailIdle).toEqual(["Tony Salas"]);
    expect(W.thu0830.people.get("Jesse Ruiz")?.idle).toBeUndefined();
    expect(W.yardBoards.ody.people.get("Jesse Ruiz")?.idle).toBeUndefined();
  });
});
