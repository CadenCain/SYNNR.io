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
}
export interface RecordLine {
  label: string;
  qty: number;
  source: "kit" | "package" | "plan" | "quick";
  package?: string;
  filled: { asset_id: string; name: string; serial: string | null }[];
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
}
export interface RecordPlan { id: string; by: string | null; at: string; note: string | null; packages: string[]; lines: { label: string; qty: number }[] }
export interface LoadoutOverride { loadout_id: string; by_name: string; reason: string; created_at: string }

export const RECORD_COLS =
  "id, company_id, unit_id, unit_name, yard_id, scanned_by, started_at, finished_at, expected, scanned, verdict, reasons, lines, packages, pieces, not_scanned, proof_token, plan, photo_path, roll_checks, job";

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
  let q = db.from("saas_loadout_scans").select(RECORD_COLS);
  q = "token" in where ? q.eq("proof_token", where.token) : q.eq("id", where.id).eq("company_id", where.companyId);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  const rec = data as LoadoutRecord;
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

export interface LaterLoadout { unit_name: string; finished_at: string; proof_token: string; yard_id: string | null; outcome: LoadoutOutcome }

/**
 * The truck's newest load-out after this one, on the same trip: before it
 * was checked back in, for the same job, with its link still on. An old
 * NOT READY link points the operator to it ("loaded out again at 6:05 AM:
 * READY"). Another job's load-out, or one after a check-in, is not this
 * operator's to see.
 */
export async function laterLoadout(db: SupabaseClient, rec: Pick<LoadoutRecord, "id" | "company_id" | "unit_id" | "finished_at" | "job">): Promise<LaterLoadout | null> {
  if (!rec.unit_id) return null;
  const { data: backRow } = await db.from("saas_returns").select("finished_at")
    .eq("company_id", rec.company_id).eq("unit_id", rec.unit_id).gt("finished_at", rec.finished_at)
    .order("finished_at", { ascending: true }).limit(1).maybeSingle();
  const back = backRow as { finished_at: string } | null;
  let q = db.from("saas_loadout_scans").select("id, unit_name, finished_at, proof_token, yard_id, verdict, pieces, not_scanned, job")
    .eq("company_id", rec.company_id).eq("unit_id", rec.unit_id).gt("finished_at", rec.finished_at);
  if (back) q = q.lt("finished_at", back.finished_at);
  const { data: nRow } = await q.order("finished_at", { ascending: false }).limit(1).maybeSingle();
  const n = nRow as (Pick<LoadoutRecord, "id" | "unit_name" | "finished_at" | "proof_token" | "yard_id" | "verdict" | "pieces" | "not_scanned" | "job">) | null;
  if (!n || n.id === rec.id) return null;
  const sameJob = (a?: string | null, b?: string | null) => !a?.trim() || !b?.trim() || a.trim().toLowerCase() === b.trim().toLowerCase();
  if (!sameJob(rec.job, n.job)) return null;
  const [{ data: off }, { data: ov }] = await Promise.all([
    db.from("saas_loadout_link_offs").select("loadout_id").eq("loadout_id", n.id).maybeSingle(),
    db.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at").eq("loadout_id", n.id).maybeSingle(),
  ]);
  if (off) return null;
  return { unit_name: n.unit_name, finished_at: n.finished_at, proof_token: n.proof_token, yard_id: n.yard_id, outcome: outcomeOf(n, ov as LoadoutOverride | null) };
}
