import { notFound } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, PencilRuler } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { unitTypeLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { customizeTemplate, addLoadoutItem, deleteLoadoutItem, toggleLoadoutRequired, moveLoadoutItem } from "./actions";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

/** Edit what this truck is supposed to leave with (spec P1.2). */
export default async function LoadoutEditor({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();

  const { data: unitData } = await db
    .from("saas_units").select("id, name, type").eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (!unitData) notFound();
  const unit = unitData as { id: string; name: string; type: string };

  const { data: tpls } = await db
    .from("saas_loadout_templates").select("id, company_id, unit_id, unit_type, name")
    .or(`unit_id.eq.${unitId},unit_type.eq.${unit.type}`);
  type Tpl = { id: string; company_id: string | null; unit_id: string | null; unit_type: string | null; name: string };
  const list = (tpls ?? []) as Tpl[];
  const own = list.find((t) => t.unit_id === unitId) ?? null;
  const resolved = own
    ?? list.find((t) => t.company_id === company.id && t.unit_type === unit.type)
    ?? list.find((t) => t.company_id === null && t.unit_type === unit.type)
    ?? null;

  let items: { id: string; label: string; category: string | null; required: boolean; sort: number }[] = [];
  if (resolved) {
    const { data } = await db
      .from("saas_loadout_items").select("id, label, category, required, sort")
      .eq("template_id", resolved.id).order("sort");
    items = (data ?? []) as typeof items;
  }
  const editable = own !== null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: `/app/units/${unitId}`, label: unit.name }}
        title={`Loadout — ${unit.name}`}
        description={`What this ${unitTypeLabel(unit.type).toLowerCase()} is supposed to leave the yard with. Required items block the green light on the pre-dispatch check.`}
      />

      {!editable && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-dim">
            {resolved
              ? <>Using the shared <span className="text-ink">{resolved.name}</span> starter. Customize it and this truck gets its own copy — the shared one stays untouched.</>
              : <>No loadout template for this unit type yet — customize to create one.</>}
          </p>
          <form action={customizeTemplate}>
            <input type="hidden" name="unit_id" value={unitId} />
            <Button type="submit" size="sm"><PencilRuler className="h-4 w-4" /> Customize for this truck</Button>
          </form>
        </Card>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => (
            <Card key={it.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{it.label}</div>
                {it.category ? <div className="truncate text-sm text-ink-dim">{it.category.replace(/_/g, " ")}</div> : null}
              </div>
              {editable ? (
                <>
                  <form action={toggleLoadoutRequired}>
                    <input type="hidden" name="unit_id" value={unitId} />
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="required" value={String(it.required)} />
                    <button type="submit"
                      className={`rounded-sm border px-2.5 py-0.5 text-xs font-medium ${it.required ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-line-2 text-ink-faint"}`}
                      title="Toggle required">
                      {it.required ? "Required" : "Optional"}
                    </button>
                  </form>
                  <div className="flex flex-col">
                    <form action={moveLoadoutItem}><input type="hidden" name="unit_id" value={unitId} /><input type="hidden" name="id" value={it.id} /><input type="hidden" name="dir" value="up" />
                      <button type="submit" disabled={idx === 0} className="flex h-9 w-9 items-center justify-center text-ink-faint hover:text-ink disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button></form>
                    <form action={moveLoadoutItem}><input type="hidden" name="unit_id" value={unitId} /><input type="hidden" name="id" value={it.id} /><input type="hidden" name="dir" value="down" />
                      <button type="submit" disabled={idx === items.length - 1} className="flex h-9 w-9 items-center justify-center text-ink-faint hover:text-ink disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button></form>
                  </div>
                  <form action={deleteLoadoutItem}>
                    <input type="hidden" name="unit_id" value={unitId} />
                    <input type="hidden" name="id" value={it.id} />
                    <button type="submit" title="Remove" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </form>
                </>
              ) : (
                <span className={`rounded-sm border px-2.5 py-0.5 text-xs font-medium ${it.required ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-line-2 text-ink-faint"}`}>
                  {it.required ? "Required" : "Optional"}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-medium text-ink">
          {editable ? "Add an item" : "Add an item (creates this truck's own copy)"}
        </h3>
        <form action={addLoadoutItem} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input type="hidden" name="unit_id" value={unitId} />
          <input name="label" required placeholder="e.g. Cement head" className={`${fld} flex-1`} />
          <input name="category" placeholder="Category (optional)" className={`${fld} sm:w-44`} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="required" defaultChecked className="h-4 w-4 accent-[#e7ddc7]" /> Required</label>
          <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
        </form>
      </Card>
    </div>
  );
}
