import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { UNIT_TYPES, ASSET_CATEGORIES, COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import a list · SYNNR" };

/** Minimal CSV line parser (handles quoted fields + escaped quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (q) {
        if (c === '"' && raw[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    rows.push(out.map((s) => s.trim()));
  }
  return rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function matchValue(input: string, list: { value: string; label: string }[], fallback: string) {
  const n = norm(input);
  return list.find((x) => x.value === n || norm(x.label) === n)?.value ?? (input ? n : fallback);
}

async function runImport(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const db = (await saasDb()) as SupabaseClient;

  let yardId = String(formData.get("yard_id") ?? "");
  const newYard = String(formData.get("new_yard") ?? "").trim();
  if (!yardId && newYard) {
    const { data, error } = await db.from("saas_yards").insert({ company_id: company.id, name: newYard }).select("id").single();
    if (error) throw new Error(error.message);
    yardId = (data as { id: string }).id;
  }
  if (!yardId) throw new Error("Pick or name a yard.");

  const rows = parseCsv(String(formData.get("csv") ?? ""));
  if (rows.length < 2) redirect(`/app/yards/${yardId}`);

  const header = rows[0].map(norm);
  const idx = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const col = {
    unit: idx(["unit", "unit_name", "truck", "rig"]),
    unitType: idx(["unit_type", "type"]),
    asset: idx(["asset", "asset_name", "equipment"]),
    category: idx(["category"]),
    item: idx(["item", "cert", "title", "inspection"]),
    kind: idx(["kind", "item_kind", "cert_kind"]),
    issued: idx(["issued", "issued_date"]),
    expires: idx(["expires", "expiration", "expiration_date", "expires_at"]),
  };

  // Cache units/assets created this run (by lowercase name).
  const unitCache = new Map<string, string>();
  const assetCache = new Map<string, string>();
  const get = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i].trim() : "");

  async function ensureUnit(name: string, type: string): Promise<string> {
    const key = name.toLowerCase();
    if (unitCache.has(key)) return unitCache.get(key)!;
    const { data: existing } = await db.from("saas_units").select("id").eq("yard_id", yardId).ilike("name", name).maybeSingle();
    let id = (existing as { id: string } | null)?.id;
    if (!id) {
      const { data } = await db.from("saas_units")
        .insert({ company_id: company.id, yard_id: yardId, name, type: matchValue(type, UNIT_TYPES, "other") })
        .select("id").single();
      id = (data as { id: string }).id;
    }
    unitCache.set(key, id!);
    return id!;
  }
  async function ensureAsset(name: string, unitId: string | null, category: string): Promise<string> {
    const key = (unitId ?? "") + "|" + name.toLowerCase();
    if (assetCache.has(key)) return assetCache.get(key)!;
    const { data } = await db.from("saas_assets")
      .insert({ company_id: company.id, yard_id: yardId, unit_id: unitId, name, category: matchValue(category, ASSET_CATEGORIES, "other") })
      .select("id").single();
    const id = (data as { id: string }).id;
    assetCache.set(key, id);
    return id;
  }

  for (const r of rows.slice(1)) {
    const unitName = get(r, col.unit);
    const assetName = get(r, col.asset);
    const itemTitle = get(r, col.item);
    let unitId: string | null = null;
    if (unitName) unitId = await ensureUnit(unitName, get(r, col.unitType));
    let parentType = "unit", parentId = unitId;
    if (assetName) {
      const aid = await ensureAsset(assetName, unitId, get(r, col.category));
      parentType = "asset"; parentId = aid;
    }
    if (itemTitle && parentId) {
      await db.from("saas_compliance_items").insert({
        company_id: company.id, parent_type: parentType, parent_id: parentId,
        title: itemTitle, kind: matchValue(get(r, col.kind), COMPLIANCE_KINDS, "cert"),
        issued_date: get(r, col.issued) || null, expiration_date: get(r, col.expires) || null,
      });
    }
  }

  redirect(`/app/yards/${yardId}`);
}

export default async function ImportPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name");
  const yards = (data ?? []) as { id: string; name: string }[];

  const sample = `unit,unit_type,asset,category,item,kind,issued,expires
Rig 4,service rig,BOP #3,pressure control,BOP test,test,2026-01-15,2026-07-15
Rig 4,service rig,,,Annual DOT inspection,inspection,2026-02-01,2027-02-01
Truck 12,truck,,,DOT sticker,dot_sticker,2026-03-01,2027-03-01`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/yards" className="text-sm text-ink-dim hover:text-ink">← Yards</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Import a list</h1>
        <p className="mt-1 text-sm text-ink-dim">Paste a spreadsheet (CSV) and we&apos;ll build your yard — units, assets, and certs — in one shot.</p>
      </div>

      <Card className="p-5">
        <form action={runImport} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink">Yard</span>
            {yards.length > 0 ? (
              <select name="yard_id" className="h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]">
                <option value="">— New yard below —</option>
                {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            ) : null}
            <input name="new_yard" placeholder="Or name a new yard"
              className="mt-2 h-11 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink">CSV</span>
            <textarea name="csv" rows={10} required defaultValue={sample}
              className="rounded-lg border border-line-2 bg-coal px-3 py-2 font-mono text-xs text-ink outline-none focus:border-[#e7ddc7]" />
            <span className="text-xs text-ink-faint">
              Columns (any order): <span className="font-mono">unit, unit_type, asset, category, item, kind, issued, expires</span>.
              Leave <span className="font-mono">asset</span> blank to attach a cert/inspection to the unit (truck book).
            </span>
          </label>

          <div><Button type="submit">Import</Button></div>
        </form>
      </Card>
    </div>
  );
}
