import type { SupabaseClient } from "@supabase/supabase-js";

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
}
export interface RecordPlan { id: string; by: string | null; at: string; note: string | null; packages: string[]; lines: { label: string; qty: number }[] }
export interface LoadoutOverride { loadout_id: string; by_name: string; reason: string; created_at: string }

export const RECORD_COLS =
  "id, company_id, unit_id, unit_name, yard_id, scanned_by, started_at, finished_at, expected, scanned, verdict, reasons, lines, packages, pieces, not_scanned, proof_token, plan";

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
