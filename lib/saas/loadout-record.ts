import type { SupabaseClient } from "@supabase/supabase-js";
import { photoTakenMs } from "./loadout-photo";

/**
 * A saved load-out, as stored (saas_loadout_scans, which nobody can edit)
 * plus a manager's override if there is one (saas_loadout_overrides).
 */

export interface RecordPiece {
  asset_id: string;
  name: string;
  serial: string | null;
  how: "nfc" | "qr" | "hand";
  at?: string;
  by?: string;
  added?: boolean;
  red?: boolean;
  /** Each test as it stood at load-out, with the cert (upload id) behind it. */
  tests?: { title: string; good_until: string | null; result: string; paper?: string | null }[];
  /** Its red tag came off shortly before it went on: who took it off, when, and why. */
  red_tag_off?: { by?: string | null; note?: string | null; at?: string | null } | null;
}
export interface RecordLine {
  label: string;
  qty: number;
  source: "kit" | "package" | "plan" | "quick";
  package?: string;
  filled: { asset_id: string; name: string; serial: string | null }[];
  /** Quick check: how many the hand said are on the truck, who, and when (no pieces scanned). */
  confirmed?: { n: number; by: string | null; at: string | null } | null;
}
export interface LoadoutRecord {
  id: string;
  company_id: string;
  unit_id: string | null;
  unit_name: string;
  yard_id: string | null;
  scanned_by: string | null;
  started_at: string | null;
  finished_at: string;
  expected: number;
  scanned: number;
  verdict: "ready" | "not_ready" | null;
  reasons: string[];
  lines: RecordLine[];
  packages: string[];
  pieces: RecordPiece[];
  not_scanned: { asset_id: string; name: string; serial: string | null; outcome: "left" | "yard" | "missing" }[];
  proof_token: string;
  /** The manager's plan this load-out was checked against, as it stood. */
  plan?: RecordPlan | null;
  /** The photo of the loaded truck (proofs bucket), named `<started ms>-<taken ms>.jpg`. */
  photo_path?: string | null;
  /** Which job or well it was for. */
  job?: string | null;
  /** What the hand was asked to confirm before it rolled, and who tapped it when. */
  roll_checks?: { label: string; ok: boolean; at: string | null; by: string | null }[] | null;
  /** The truck's own paper (the DOT and the like) as it stood at load-out, kept like a piece's tests (migration 0040). */
  truck_paper?: { title: string; good_until: string | null; result: string; paper: string | null }[] | null;
  /** When the hand tapped Save on the phone. A save with no signal can land hours later (migration 0040). */
  phone_saved_at?: string | null;
}
export interface RecordPlan { id: string; by: string | null; at: string; note: string | null; packages: string[]; lines: { label: string; qty: number }[] }
export interface LoadoutOverride { loadout_id: string; by_name: string; reason: string; created_at: string }

export const RECORD_COLS =
  "id, company_id, unit_id, unit_name, yard_id, scanned_by, started_at, finished_at, expected, scanned, verdict, reasons, lines, packages, pieces, not_scanned, proof_token, plan, photo_path, roll_checks, job";
/** The truck's paper and the phone's save time came with migration 0040. */
const RECORD_COLS_0040 = `${RECORD_COLS}, truck_paper, phone_saved_at`;

/**
 * One record row, with the columns migration 0040 added. Until that's in, a
 * select naming them fails, so it reads again without them instead of
 * losing the whole record.
 */
export async function selectRecord(
  run: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<LoadoutRecord | null> {
  let res = await run(RECORD_COLS_0040);
  if (res.error) res = await run(RECORD_COLS);
  return (res.data as LoadoutRecord | null) ?? null;
}

/**
 * READY or NOT READY. Load-outs saved before the server worked out the
 * answer (no verdict stored) read NOT READY if a bad piece went on or a
 * piece couldn't be found.
 */
export function verdictOf(r: Pick<LoadoutRecord, "verdict" | "pieces" | "not_scanned">): "ready" | "not_ready" {
  if (r.verdict) return r.verdict;
  const bad = (r.pieces ?? []).some((p) => p.red) || (r.not_scanned ?? []).some((n) => n.outcome === "missing");
  return bad ? "not_ready" : "ready";
}

/** Where the truck stands after this load-out: rolled READY, rolled on a manager's override, or blocked. */
export type LoadoutOutcome = "ready" | "override" | "blocked";
export function outcomeOf(r: Pick<LoadoutRecord, "verdict" | "pieces" | "not_scanned">, override: LoadoutOverride | null | undefined): LoadoutOutcome {
  if (verdictOf(r) === "ready") return "ready";
  return override ? "override" : "blocked";
}

/** Reasons in plain words, including for old records that didn't store them. */
export function reasonsOf(r: Pick<LoadoutRecord, "verdict" | "reasons" | "pieces" | "not_scanned">): string[] {
  if (r.verdict) return r.reasons ?? [];
  const label = (p: { name: string; serial: string | null }) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`;
  return [
    ...(r.not_scanned ?? []).filter((n) => n.outcome === "missing").map((n) => `Can't find: ${label(n)}`),
    ...(r.pieces ?? []).filter((p) => p.red).map((p) => `Out of test or red-tagged: ${label(p)}`),
  ];
}

export async function getLoadout(db: SupabaseClient, where: { id: string; companyId: string } | { token: string }) {
  const rec = await selectRecord((cols) => {
    const q = db.from("saas_loadout_scans").select(cols);
    return ("token" in where ? q.eq("proof_token", where.token) : q.eq("id", where.id).eq("company_id", where.companyId)).maybeSingle();
  });
  if (!rec) return null;
  const { data: ov } = await db.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at").eq("loadout_id", rec.id).maybeSingle();
  return { rec, override: (ov as LoadoutOverride | null) ?? null };
}

/**
 * The photo of the loaded truck, and when it was taken. The app gets a
 * signed link. A public page passes `href`, its own address for the photo,
 * which checks the link is still on and signs a fresh one each time it's
 * opened (a signed link dies after an hour, and a company man leaves the tab
 * open longer than that).
 */
export async function recordPhoto(db: SupabaseClient, rec: Pick<LoadoutRecord, "photo_path" | "finished_at">, href?: string): Promise<{ url: string; at: string } | null> {
  if (!rec.photo_path) return null;
  const taken = photoTakenMs(rec.photo_path);
  const at = taken ? new Date(taken).toISOString() : rec.finished_at;
  if (href) return { url: href, at };
  const { data } = await db.storage.from("proofs").createSignedUrl(rec.photo_path, 3600);
  if (!data?.signedUrl) return null;
  return { url: data.signedUrl, at };
}

/**
 * Each yard's time zone, by yard id. A yard with none (or before migration
 * 0035 is in) reads Central: yardZone() in format.ts fills the gap.
 */
export async function yardZones(db: SupabaseClient, yardIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(yardIds.filter((x): x is string => Boolean(x)))];
  if (!ids.length) return new Map();
  const { data, error } = await db.from("saas_yards").select("id, time_zone").in("id", ids);
  if (error) return new Map();
  return new Map(((data ?? []) as { id: string; time_zone: string | null }[]).filter((y) => y.time_zone).map((y) => [y.id, y.time_zone!]));
}

/** Was the truck checked back in between these two times? Then the trip before is over. */
export async function checkedInBetween(db: SupabaseClient, companyId: string, unitId: string, after: string, before: string): Promise<boolean> {
  if (!(after < before)) return false;
  const { data } = await db.from("saas_returns").select("id")
    .eq("company_id", companyId).eq("unit_id", unitId).gt("finished_at", after).lt("finished_at", before)
    .limit(1).maybeSingle();
  return Boolean(data);
}

type TripRow = Pick<LoadoutRecord, "id" | "finished_at" | "verdict" | "pieces" | "not_scanned">;

/** Which of these NOT READY load-outs a manager rolled anyway. */
async function overridden(db: SupabaseClient, rows: TripRow[]): Promise<Set<string>> {
  const ids = rows.filter((r) => verdictOf(r) !== "ready").map((r) => r.id);
  if (!ids.length) return new Set();
  const { data } = await db.from("saas_loadout_overrides").select("loadout_id").in("loadout_id", ids);
  return new Set(((data ?? []) as { loadout_id: string }[]).map((r) => r.loadout_id));
}

/**
 * Has the truck started another trip since `since` (when a truck link was
 * made), before its newest load-out? Then that load-out is for a later job,
 * not for whoever holds the link. A trip ends at a check-in. A load-out that
 * rolled (READY, or on a manager's override) is a trip of its own too: the
 * truck can't load out again until it's back, checked in or not (the hand
 * tapped "It's back in the yard"). So the newest load-out is a later trip
 * when one rolled after the link was made, or when the truck was out on one
 * when the link was made.
 */
export async function laterTripSince(db: SupabaseClient, companyId: string, unitId: string, since: string, newest: { id: string; finished_at: string }): Promise<false | { why: "later"; } | { why: "out_at_link"; tripAt: string }> {
  if (!(since < newest.finished_at)) return false;
  const cols = "id, finished_at, verdict, pieces, not_scanned";
  const [checkedIn, { data: betweenRows }, { data: beforeRow }] = await Promise.all([
    checkedInBetween(db, companyId, unitId, since, newest.finished_at),
    db.from("saas_loadout_scans").select(cols).eq("company_id", companyId).eq("unit_id", unitId)
      .gt("finished_at", since).lt("finished_at", newest.finished_at).order("finished_at", { ascending: true }).limit(200),
    db.from("saas_loadout_scans").select(cols).eq("company_id", companyId).eq("unit_id", unitId)
      .lt("finished_at", since).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (checkedIn) return { why: "later" };
  const between = ((betweenRows ?? []) as TripRow[]).filter((r) => r.id !== newest.id);
  const before = (beforeRow as TripRow | null) && (beforeRow as TripRow).id !== newest.id ? (beforeRow as TripRow) : null;
  const rolledAnyway = await overridden(db, [...between, ...(before ? [before] : [])]);
  const rolled = (r: TripRow) => verdictOf(r) === "ready" || rolledAnyway.has(r.id);
  if (between.some(rolled)) return { why: "later" };
  // Out on that one when the link was made, unless it was checked in first.
  // (A yard that doesn't check trucks in lands here too: the link can't tell
  // which job a later load-out is for, so it says so instead of guessing.)
  if (before && rolled(before) && !(await checkedInBetween(db, companyId, unitId, before.finished_at, since))) return { why: "out_at_link", tripAt: before.finished_at };
  return false;
}

/**
 * The same job: the same job or well on both, or (with no job on one of
 * them) the same manager's plan as it stood. A plan saved again may be for
 * another job, and a blank job matches nothing.
 */
export function sameJob(a: Pick<LoadoutRecord, "job" | "plan">, b: Pick<LoadoutRecord, "job" | "plan">): boolean {
  const norm = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const ja = norm(a.job), jb = norm(b.job);
  if (ja && jb) return ja === jb;
  return Boolean(a.plan?.id && a.plan.id === b.plan?.id && a.plan.at === b.plan?.at);
}

/** The roll window (ROLL_WINDOW_MS in dispatch-check.ts, which imports this file): one shift. */
const FIX_WINDOW_MS = 20 * 3600e3;

/** What an old NOT READY link says about the load-out that fixed it. No link to it, and nothing off it but the time and the answer. */
export interface LaterLoadout { unit_name: string; finished_at: string; yard_id: string | null; outcome: LoadoutOutcome }

/**
 * A NOT READY load-out nobody rolled, then loaded out again for the same job
 * on the same shift: the try that rolled (or the last one that didn't). The
 * operator's old link says "loaded out again at 6:05 AM for this job: READY"
 * instead of holding the truck. Only within the roll window, before any
 * check-in, and never past a try for another job or the first one that
 * rolled: a later trip's load-out is another job's, and this operator's link
 * never reaches it. A READY or rolled record has nothing to point to.
 */
export async function laterLoadout(
  db: SupabaseClient,
  rec: Pick<LoadoutRecord, "id" | "company_id" | "unit_id" | "finished_at" | "job" | "plan" | "verdict" | "pieces" | "not_scanned">,
  override: LoadoutOverride | null | undefined,
): Promise<LaterLoadout | null> {
  if (!rec.unit_id || outcomeOf(rec, override) !== "blocked") return null;
  const startMs = Date.parse(rec.finished_at);
  if (!Number.isFinite(startMs)) return null;
  let end = new Date(startMs + FIX_WINDOW_MS).toISOString();
  const { data: backRow } = await db.from("saas_returns").select("finished_at")
    .eq("company_id", rec.company_id).eq("unit_id", rec.unit_id).gt("finished_at", rec.finished_at).lt("finished_at", end)
    .order("finished_at", { ascending: true }).limit(1).maybeSingle();
  if (backRow) end = (backRow as { finished_at: string }).finished_at;
  const { data: rows } = await db.from("saas_loadout_scans").select("id, unit_name, finished_at, yard_id, verdict, pieces, not_scanned, job, plan")
    .eq("company_id", rec.company_id).eq("unit_id", rec.unit_id).gt("finished_at", rec.finished_at).lt("finished_at", end)
    .order("finished_at", { ascending: true }).limit(25);
  type Try = TripRow & Pick<LoadoutRecord, "unit_name" | "yard_id" | "job" | "plan">;
  const tries = ((rows ?? []) as Try[]).filter((n) => n.id !== rec.id);
  const rolledAnyway = await overridden(db, tries);
  let pick: Try | null = null;
  for (const n of tries) {
    if (!sameJob(rec, n)) break;
    pick = n;
    if (verdictOf(n) === "ready" || rolledAnyway.has(n.id)) break;
  }
  if (!pick) return null;
  const { data: off } = await db.from("saas_loadout_link_offs").select("loadout_id").eq("loadout_id", pick.id).maybeSingle();
  if (off) return null;
  const outcome: LoadoutOutcome = verdictOf(pick) === "ready" ? "ready" : rolledAnyway.has(pick.id) ? "override" : "blocked";
  return { unit_name: pick.unit_name, finished_at: pick.finished_at, yard_id: pick.yard_id, outcome };
}
