"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { UNIT_TYPES, ASSET_CATEGORIES, COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";

/**
 * Hardened import: dry-run preview → commit. Idempotent — re-importing the
 * same sheet UPDATES instead of duplicating:
 *   units keyed by name (case-insensitive, within the yard)
 *   assets keyed by name within their unit (or yard)
 *   crew   keyed by name (within company)
 *   certs  keyed by (parent, title) — dates get updated
 * Admin-gated: import writes company-wide, so members can look but not load.
 *
 * CSV columns (any order, header row required):
 *   unit, unit_type, asset, category, crew, item, kind, issued, expires
 * A row may target a unit (unit set), an asset (unit+asset), or a crew member
 * (crew set). `item` empty = just ensure the unit/asset/crew exists.
 */

export interface PlanRow {
  line: number;
  ops: string[];          // human-readable actions, e.g. "create unit Rig 4"
  error: string | null;
}
export interface ImportPreview {
  ok: boolean;
  error?: string;
  rows: PlanRow[];
  creates: number;
  updates: number;
  errors: number;
}
export interface ImportResult extends ImportPreview {
  committed: boolean;
}

/* ── CSV parsing (quoted fields + escaped quotes) ── */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (q) {
        if (ch === '"' && raw[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const matchValue = (input: string, list: { value: string; label: string }[], fallback: string) => {
  const n = norm(input);
  return list.find((x) => x.value === n || norm(x.label) === n)?.value ?? (input ? n : fallback);
};

/** Accept YYYY-MM-DD or M/D/YYYY (Excel default). Returns ISO or null; throws label on garbage. */
function parseDate(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  throw new Error(`bad date "${s}" (use YYYY-MM-DD or M/D/YYYY)`);
}

interface Ctx {
  db: SupabaseClient;
  companyId: string;
  yardId: string;
  commit: boolean;
  // caches: existing + created-this-run, keyed lowercase
  units: Map<string, string>;
  assets: Map<string, string>;      // "unitId|name" or "yard|name"
  crew: Map<string, string>;
  certs: Map<string, string>;       // "parentType|parentId|title"
}

async function loadCtx(db: SupabaseClient, companyId: string, yardId: string, commit: boolean): Promise<Ctx> {
  const [{ data: units }, { data: assets }, { data: crew }, { data: certs }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("yard_id", yardId),
    db.from("saas_assets").select("id, name, unit_id").eq("company_id", companyId),
    db.from("saas_crew_members").select("id, name").eq("company_id", companyId),
    db.from("saas_compliance_items").select("id, title, parent_type, parent_id").eq("company_id", companyId),
  ]);
  return {
    db, companyId, yardId, commit,
    units: new Map(((units ?? []) as { id: string; name: string }[]).map((u) => [u.name.toLowerCase(), u.id])),
    assets: new Map(((assets ?? []) as { id: string; name: string; unit_id: string | null }[]).map((a) => [`${a.unit_id ?? "yard"}|${a.name.toLowerCase()}`, a.id])),
    crew: new Map(((crew ?? []) as { id: string; name: string }[]).map((c) => [c.name.toLowerCase(), c.id])),
    certs: new Map(((certs ?? []) as { id: string; title: string; parent_type: string; parent_id: string }[]).map((c) => [`${c.parent_type}|${c.parent_id}|${c.title.toLowerCase()}`, c.id])),
  };
}

/** Runs the whole import. commit=false → plan only (no writes). */
async function runImport(csv: string, yardId: string, newYard: string, commit: boolean): Promise<ImportResult> {
  const { company } = await requireCompany();
  if (company.role !== "owner" && company.role !== "admin") {
    return { ok: false, error: "Import is admin-only — ask an owner/admin to load the sheet.", rows: [], creates: 0, updates: 0, errors: 0, committed: false };
  }
  const db = await saasDb();

  // Resolve/create the yard
  let resolvedYard = yardId;
  let yardOp: string | null = null;
  if (!resolvedYard && newYard.trim()) {
    yardOp = `create yard "${newYard.trim()}"`;
    if (commit) {
      const { data, error } = await db.from("saas_yards").insert({ company_id: company.id, name: newYard.trim() }).select("id").single();
      if (error) return { ok: false, error: error.message, rows: [], creates: 0, updates: 0, errors: 0, committed: false };
      resolvedYard = (data as { id: string }).id;
    }
  }
  if (!resolvedYard && !newYard.trim()) {
    return { ok: false, error: "Pick a yard or name a new one.", rows: [], creates: 0, updates: 0, errors: 0, committed: false };
  }

  const parsed = parseCsv(csv);
  if (parsed.length < 2) {
    return { ok: false, error: "Need a header row plus at least one data row.", rows: [], creates: 0, updates: 0, errors: 0, committed: false };
  }
  const header = parsed[0].map(norm);
  const idx = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const col = {
    unit: idx(["unit", "unit_name", "truck", "rig"]),
    unitType: idx(["unit_type", "type"]),
    asset: idx(["asset", "asset_name", "equipment"]),
    category: idx(["category"]),
    crew: idx(["crew", "crew_member", "hand", "employee"]),
    item: idx(["item", "cert", "title", "inspection"]),
    kind: idx(["kind", "item_kind", "cert_kind"]),
    issued: idx(["issued", "issued_date"]),
    expires: idx(["expires", "expiration", "expiration_date", "expires_at"]),
  };
  if (col.unit < 0 && col.crew < 0) {
    return { ok: false, error: 'Header must include a "unit" or "crew" column. Download the template below.', rows: [], creates: 0, updates: 0, errors: 0, committed: false };
  }

  // Preview uses placeholder ids for would-be creations so keys still dedupe.
  const ctx = await loadCtx(db, company.id, resolvedYard || "preview", commit);
  const get = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");
  let creates = 0, updates = 0, errors = 0;
  const rows: PlanRow[] = [];
  if (yardOp) { rows.push({ line: 0, ops: [yardOp], error: null }); creates++; }
  let fakeId = 0;

  async function ensureUnit(name: string, type: string, ops: string[]): Promise<string> {
    const key = name.toLowerCase();
    const hit = ctx.units.get(key);
    if (hit) return hit;
    ops.push(`create unit "${name}"`);
    creates++;
    let id = `new-unit-${fakeId++}`;
    if (ctx.commit) {
      const { data, error } = await ctx.db.from("saas_units")
        .insert({ company_id: ctx.companyId, yard_id: resolvedYard, name, type: matchValue(type, UNIT_TYPES, "other") })
        .select("id").single();
      if (error) throw new Error(error.message);
      id = (data as { id: string }).id;
    }
    ctx.units.set(key, id);
    return id;
  }
  async function ensureAsset(name: string, unitId: string | null, category: string, ops: string[]): Promise<string> {
    const key = `${unitId ?? "yard"}|${name.toLowerCase()}`;
    const hit = ctx.assets.get(key);
    if (hit) return hit;
    ops.push(`create asset "${name}"`);
    creates++;
    let id = `new-asset-${fakeId++}`;
    if (ctx.commit) {
      const { data, error } = await ctx.db.from("saas_assets")
        .insert({ company_id: ctx.companyId, yard_id: resolvedYard, unit_id: unitId, name, category: matchValue(category, ASSET_CATEGORIES, "other") })
        .select("id").single();
      if (error) throw new Error(error.message);
      id = (data as { id: string }).id;
    }
    ctx.assets.set(key, id);
    return id;
  }
  async function ensureCrew(name: string, ops: string[]): Promise<string> {
    const key = name.toLowerCase();
    const hit = ctx.crew.get(key);
    if (hit) return hit;
    ops.push(`create crew "${name}"`);
    creates++;
    let id = `new-crew-${fakeId++}`;
    if (ctx.commit) {
      const { data, error } = await ctx.db.from("saas_crew_members")
        .insert({ company_id: ctx.companyId, name }).select("id").single();
      if (error) throw new Error(error.message);
      id = (data as { id: string }).id;
    }
    ctx.crew.set(key, id);
    return id;
  }
  async function upsertCert(parentType: string, parentId: string, title: string, kind: string, issued: string | null, expires: string | null, ops: string[]) {
    const key = `${parentType}|${parentId}|${title.toLowerCase()}`;
    const existing = ctx.certs.get(key);
    if (existing) {
      ops.push(`update "${title}" dates`);
      updates++;
      if (ctx.commit) {
        const { error } = await ctx.db.from("saas_compliance_items")
          .update({ issued_date: issued, expiration_date: expires })
          .eq("id", existing).eq("company_id", ctx.companyId);
        if (error) throw new Error(error.message);
      }
      return;
    }
    ops.push(`create "${title}"`);
    creates++;
    let id = `new-cert-${fakeId++}`;
    if (ctx.commit) {
      const { data, error } = await ctx.db.from("saas_compliance_items")
        .insert({
          company_id: ctx.companyId, parent_type: parentType, parent_id: parentId,
          title, kind: matchValue(kind, COMPLIANCE_KINDS, "cert"),
          issued_date: issued, expiration_date: expires,
        }).select("id").single();
      if (error) throw new Error(error.message);
      id = (data as { id: string }).id;
    }
    ctx.certs.set(key, id);
  }

  for (let li = 1; li < parsed.length; li++) {
    const r = parsed[li];
    const ops: string[] = [];
    try {
      const unitName = get(r, col.unit);
      const assetName = get(r, col.asset);
      const crewName = get(r, col.crew);
      const itemTitle = get(r, col.item);
      const issued = parseDate(get(r, col.issued));
      const expires = parseDate(get(r, col.expires));

      if (!unitName && !crewName) throw new Error("row targets nothing — set unit or crew");
      if (assetName && !unitName) throw new Error("asset rows need a unit");
      if (itemTitle && !expires) ops.push("note: no expiration — imports as 'no date'");

      if (crewName) {
        const crewId = await ensureCrew(crewName, ops);
        if (itemTitle) await upsertCert("crew", crewId, itemTitle, get(r, col.kind), issued, expires, ops);
      } else {
        const unitId = await ensureUnit(unitName, get(r, col.unitType), ops);
        let parentType = "unit", parentId = unitId;
        if (assetName) {
          parentId = await ensureAsset(assetName, unitId, get(r, col.category), ops);
          parentType = "asset";
        }
        if (itemTitle) await upsertCert(parentType, parentId, itemTitle, get(r, col.kind), issued, expires, ops);
      }
      if (ops.length === 0) ops.push("no change (already exists)");
      rows.push({ line: li + 1, ops, error: null });
    } catch (e) {
      errors++;
      rows.push({ line: li + 1, ops, error: e instanceof Error ? e.message : String(e) });
      // commit mode: keep going — partial success with an error report (spec §7)
    }
  }

  return { ok: true, rows, creates, updates, errors, committed: commit };
}

export async function previewImport(args: { csv: string; yardId: string; newYard: string }): Promise<ImportResult> {
  return runImport(args.csv, args.yardId, args.newYard, false);
}
export async function commitImport(args: { csv: string; yardId: string; newYard: string }): Promise<ImportResult> {
  return runImport(args.csv, args.yardId, args.newYard, true);
}
