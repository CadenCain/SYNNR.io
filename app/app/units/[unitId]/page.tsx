import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Box, Settings2, Trash2, ChevronRight, Truck, HardHat, X } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { unitTypeLabel, categoryLabel, ASSET_CATEGORIES, COMPLIANCE_KINDS, UNIT_TYPES } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceRow, { type RowItem } from "@/app/app/_components/compliance-row";
import { addComplianceItem, addAsset } from "./actions";
import { updateUnit, deleteUnit, assignCrewToUnit, unassignCrewFromUnit } from "@/app/app/_actions";
import ShareProof from "@/app/app/_components/share-proof";
import { StatusBadge } from "@/components/ui/status-badge";
import { worstStatus } from "@/lib/saas/status";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

export default async function UnitDetail({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const here = `/app/units/${unitId}`;

  const { data: unit } = await db
    .from("saas_units").select("id, name, type, identifier, yard_id, saas_yards(name)")
    .eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (!unit) notFound();
  const u = unit as { id: string; name: string; type: string; identifier: string | null; yard_id: string; saas_yards: { name: string } | { name: string }[] | null };
  const yardName = Array.isArray(u.saas_yards) ? u.saas_yards[0]?.name : u.saas_yards?.name;

  const { data: ciData } = await db
    .from("saas_compliance_items_with_status")
    .select("id, title, kind, issued_date, expiration_date, status")
    .eq("parent_type", "unit").eq("parent_id", unitId)
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const items = (ciData ?? []) as RowItem[];

  const { data: assetData } = await db
    .from("saas_assets").select("id, name, category, status").eq("unit_id", unitId).order("name");
  const assets = (assetData ?? []) as { id: string; name: string; category: string; status: string }[];

  // Crew: standing assignments + everyone else, with worst-card status chips.
  const [{ data: ucData }, { data: crewListData }, { data: crewCertData }] = await Promise.all([
    db.from("saas_unit_crew").select("crew_member_id").eq("unit_id", unitId),
    db.from("saas_crew_members").select("id, name, role").eq("company_id", company.id).eq("status", "active").order("name"),
    db.from("saas_compliance_items_with_status").select("parent_id, status").eq("company_id", company.id).eq("parent_type", "crew"),
  ]);
  const assignedIds = new Set(((ucData ?? []) as { crew_member_id: string }[]).map((r) => r.crew_member_id));
  const certsByCrew = new Map<string, ComplianceStatus[]>();
  for (const c of (crewCertData ?? []) as { parent_id: string; status: ComplianceStatus }[]) {
    certsByCrew.set(c.parent_id, [...(certsByCrew.get(c.parent_id) ?? []), c.status]);
  }
  const worstByCrew = new Map<string, ComplianceStatus>();
  for (const [id, list] of certsByCrew) { const w = worstStatus(list); if (w) worstByCrew.set(id, w); }
  const allCrew = ((crewListData ?? []) as { id: string; name: string; role: string | null }[])
    .map((c) => ({ ...c, worst: worstByCrew.get(c.id) ?? null }));
  const assignedCrew = allCrew.filter((c) => assignedIds.has(c.id));
  const unassignedCrew = allCrew.filter((c) => !assignedIds.has(c.id));

  // Dispatch history — immutable records, newest first.
  const { data: historyData } = await db
    .from("saas_dispatch_checks")
    .select("id, type, status, performed_by_name, started_at")
    .eq("unit_id", unitId)
    .order("started_at", { ascending: false })
    .limit(6);
  const history = (historyData ?? []) as { id: string; type: string; status: string; performed_by_name: string | null; started_at: string }[];

  // Is this unit currently out? (latest checkout with no linked check-in)
  const { data: lastCo } = await db
    .from("saas_dispatch_checks").select("id, started_at")
    .eq("unit_id", unitId).eq("type", "checkout")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  let isOut = false;
  if (lastCo) {
    const { count } = await db
      .from("saas_dispatch_checks").select("id", { count: "exact", head: true })
      .eq("checkout_id", (lastCo as { id: string }).id).eq("type", "checkin");
    isOut = (count ?? 0) === 0;
  }

  return (
    <div className="flex flex-col gap-7">
      {isOut ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
            <Truck className="h-4 w-4" /> Out on a job since {new Date((lastCo as { started_at: string }).started_at).toLocaleString()}
          </div>
          <Link href={`/app/units/${unitId}/dispatch`} className="shrink-0 rounded-lg bg-bone px-3 py-2 text-sm font-semibold text-coal">Check in →</Link>
        </div>
      ) : null}
      <PageHeader
        back={{ href: `/app/yards/${u.yard_id}`, label: yardName ?? "Yard" }}
        title={u.name}
        description={`${unitTypeLabel(u.type)}${u.identifier ? ` · ${u.identifier}` : ""}`}
        actions={
          <>
          <ShareProof scope="unit" unitId={u.id} />
          {!isOut ? (
            <Link href={`/app/units/${unitId}/dispatch`}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-bone px-3 text-sm font-semibold text-coal hover:bg-bone-soft">
              <Truck className="h-4 w-4" /> Roll this truck
            </Link>
          ) : null}
          <details className="group relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink [&::-webkit-details-marker]:hidden">
              <Settings2 className="h-4 w-4" /> Manage
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-line bg-elevated p-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9)]">
              <form action={updateUnit} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={u.id} />
                <label className="text-xs text-ink-faint">Name<input name="name" defaultValue={u.name} required className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Type
                  <select name="type" defaultValue={u.type} className={`${fld} mt-1 w-full`}>
                    {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select></label>
                <label className="text-xs text-ink-faint">Identifier<input name="identifier" defaultValue={u.identifier ?? ""} className={`${fld} mt-1 w-full`} /></label>
                <Button type="submit" size="sm">Save</Button>
              </form>
              <form action={deleteUnit} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="yard_id" value={u.yard_id} />
                <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete unit
                </button>
              </form>
            </div>
          </details>
          </>
        }
      />

      {/* Truck book */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Truck book — certs, inspections &amp; DOT</h2>
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((it) => <ComplianceRow key={it.id} item={it} companyId={company.id} redirectPath={here} />)}
          </div>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-ink">{items.length ? "Add another item" : "Add a cert, inspection, or DOT item"}</h3>
          <form action={addComplianceItem} className="flex flex-col gap-3">
            <input type="hidden" name="parent_type" value="unit" />
            <input type="hidden" name="parent_id" value={u.id} />
            <input type="hidden" name="redirect_path" value={here} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="title" required placeholder="e.g. Annual DOT inspection" className={`${fld} flex-1`} />
              <select name="kind" defaultValue="inspection" className={`${fld} sm:w-44`}>
                {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Issued<input name="issued_date" type="date" className={fld} /></label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Expires<input name="expiration_date" type="date" className={fld} /></label>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
            </div>
          </form>
        </Card>
      </section>

      {/* Loadout checklist — the template behind "Roll a truck" */}
      <Link href={`/app/units/${unitId}/loadout`}>
        <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Truck className="h-4 w-4 text-ink-dim" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Loadout checklist</div>
            <div className="truncate text-sm text-ink-dim">What this truck leaves the yard with — edit items, required vs optional</div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
        </Card>
      </Link>

      {/* Dispatch history — the immutable records (spec #1d) */}
      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Dispatch history</h2>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <Link key={h.id} href={`/app/records/${h.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Truck className="h-4 w-4 text-ink-dim" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {h.type === "checkin" ? "Checked in" : "Rolled out"} · {new Date(h.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="truncate text-sm text-ink-dim">by {h.performed_by_name ?? "—"}</div>
                  </div>
                  {h.status === "not_ready_override" ? (
                    <span className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">NOT ready — override</span>
                  ) : h.status === "partial" ? (
                    <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">Items not returned</span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">{h.type === "checkin" ? "All back" : "Ready"}</span>
                  )}
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Crew on this unit — standing assignment; their cards decide this
          truck's ready call at checkout and pre-select on Roll a truck. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Crew on this unit</h2>
        {assignedCrew.length > 0 && (
          <div className="flex flex-col gap-2">
            {assignedCrew.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><HardHat className="h-4 w-4 text-ink-dim" /></span>
                <Link href={`/app/crew/${c.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block truncate text-sm text-ink-dim">{c.role ?? "crew"}</span>
                </Link>
                {c.worst ? <StatusBadge status={c.worst} /> : <span className="text-xs text-ink-faint">no cards</span>}
                <form action={unassignCrewFromUnit}>
                  <input type="hidden" name="unit_id" value={u.id} />
                  <input type="hidden" name="crew_member_id" value={c.id} />
                  <button type="submit" title="Unassign" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </Card>
            ))}
          </div>
        )}
        {unassignedCrew.length > 0 ? (
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-medium text-ink">{assignedCrew.length ? "Assign another hand" : "Assign a hand to this unit"}</h3>
            <form action={assignCrewToUnit} className="flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="unit_id" value={u.id} />
              <select name="crew_member_id" required defaultValue="" className={`${fld} flex-1`}>
                <option value="" disabled>Pick a hand…</option>
                {unassignedCrew.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ""}</option>)}
              </select>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Assign</Button>
            </form>
          </Card>
        ) : assignedCrew.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-ink-dim">
            No crew yet. <Link href="/app/crew" className="text-bone hover:underline">Add your hands</Link> first, then assign them here.
          </Card>
        ) : null}
      </section>

      {/* Assets */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Assets on this unit</h2>
        {assets.length > 0 && (
          <div className="flex flex-col gap-2">
            {assets.map((a) => (
              <Link key={a.id} href={`/app/assets/${a.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Box className="h-4 w-4 text-ink-dim" /></span>
                  <span className="flex-1 truncate font-medium">{a.name}</span>
                  <span className="text-sm text-ink-dim">{categoryLabel(a.category)}</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Card>
              </Link>
            ))}
          </div>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-ink">Add an asset to this unit</h3>
          <form action={addAsset} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="unit_id" value={u.id} />
            <input type="hidden" name="yard_id" value={u.yard_id} />
            <input type="hidden" name="redirect_path" value={here} />
            <input name="name" required placeholder="Asset name (e.g. BOP #3)" className={`${fld} flex-1`} />
            <select name="category" defaultValue="pressure_control" className={`${fld} sm:w-48`}>
              {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
