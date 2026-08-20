import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Box, Settings2, Trash2, ChevronRight, Truck, HardHat, X } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { seenAge } from "@/lib/saas/format";
import { unitTypeLabel, categoryLabel, ASSET_CATEGORIES, COMPLIANCE_KINDS, UNIT_TYPES } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import { Button, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceRow, { type RowItem } from "@/app/app/_components/compliance-row";
import { AddDisclosure } from "@/components/ui/disclosure";
import { getItemCustomers } from "@/lib/saas/customers";
import { addComplianceItem, addAsset } from "./actions";
import { updateUnit, deleteUnit, assignCrewToUnit, unassignCrewFromUnit } from "@/app/app/_actions";
import ShareProof from "@/app/app/_components/share-proof";
import { StatusBadge } from "@/components/ui/status-badge";
import { worstStatus } from "@/lib/saas/status";
import { getCompanyReadiness } from "@/lib/saas/readiness";

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
  const itemCustomers = await getItemCustomers(db, company.id, items.map((i) => i.id));
  for (const it of items) it.customers = itemCustomers.get(it.id) ?? [];

  const { data: assetData } = await db
    .from("saas_assets").select("id, name, category, status, last_seen_where, last_seen_at, primary_photo_path").eq("unit_id", unitId).order("name");
  const assets = (assetData ?? []) as { id: string; name: string; category: string; status: string; last_seen_where: string | null; last_seen_at: string | null; primary_photo_path: string | null }[];

  // Worst-cert chip per asset — the child card carries its own verdict, same
  // treatment the crew cards already get.
  const assetIds = assets.map((a) => a.id);
  const { data: assetCertData } = assetIds.length
    ? await db.from("saas_compliance_items_with_status").select("parent_id, status")
        .eq("company_id", company.id).eq("parent_type", "asset").in("parent_id", assetIds)
    : { data: [] };
  const certsByAsset = new Map<string, ComplianceStatus[]>();
  for (const r of (assetCertData ?? []) as { parent_id: string; status: ComplianceStatus }[]) {
    certsByAsset.set(r.parent_id, [...(certsByAsset.get(r.parent_id) ?? []), r.status]);
  }
  const worstByAsset = new Map<string, ComplianceStatus>();
  for (const [aid, list] of certsByAsset) { const w = worstStatus(list); if (w) worstByAsset.set(aid, w); }

  // Photo accountability: every asset should carry a shot of the iron AND its
  // paperwork. Absence is flagged, not blocked — same rule as a cert with no
  // date: the record exists, the gap stays loud until someone closes it.
  const { data: paperData } = assetIds.length
    ? await db.from("saas_attachments").select("entity_id")
        .eq("company_id", company.id).eq("entity_type", "asset").eq("label", "paperwork").in("entity_id", assetIds)
    : { data: [] };
  const hasPaper = new Set(((paperData ?? []) as { entity_id: string }[]).map((r) => r.entity_id));
  const photoGap = (a: { id: string; primary_photo_path: string | null }): string | null => {
    const noPhoto = !a.primary_photo_path;
    const noPaper = !hasPaper.has(a.id);
    if (noPhoto && noPaper) return "no photos — shoot the iron & its paperwork";
    if (noPaper) return "paperwork photo missing";
    if (noPhoto) return "asset photo missing";
    return null;
  };

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

  // The unit's verdict comes from the SAME readiness engine the dashboard and
  // the blocking check use — the banner can never disagree with the wall.
  const rd = await getCompanyReadiness(db, company.id);
  const tile = rd.units.find((t) => t.id === unitId) ?? null;
  const failingCerts = items.filter((i) => i.status === "expired" || i.status === "none");

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={{ href: `/app/yards/${u.yard_id}`, label: yardName ?? "Yard" }}
        title={u.name}
        description={`${unitTypeLabel(u.type)}${u.identifier ? ` · ${u.identifier}` : ""}`}
        actions={
          <>
          <ShareProof scope="unit" unitId={u.id} />
          <Link href={`/app/units/${unitId}/dispatch`}
            className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-bone px-3 text-sm font-semibold text-coal hover:bg-bone-soft">
            <Truck className="h-4 w-4" /> Check readiness
          </Link>
          <Popover>
            <PopoverTrigger className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink">
              <Settings2 className="h-4 w-4" /> Manage
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
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
              {company.role !== "member" && (
              <div className="mt-2 border-t border-line pt-2">
                <AlertDialog>
                  <AlertDialogTrigger className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete unit
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {u.name}?</AlertDialogTitle>
                      <AlertDialogDescription>Every asset riding on it and all their certs go with it. There is no undo.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <form action={deleteUnit}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="yard_id" value={u.yard_id} />
                        <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-bone-soft hover:bg-red-400")}>Delete it</button>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </PopoverContent>
          </Popover>
          </>
        }
      />

      {/* ── THE VERDICT — glare-proof. A foreman squinting at this in full sun
          gets the call and the reason in one glance: solid ground, white text,
          tap targets sized for gloves. Desktop gets the calmer bordered cut. ── */}
      {tile && tile.state === "not_ready" && (
        <section id="verdict">
          <div className="rounded-2xl bg-red-600 p-5 text-white sm:border sm:border-red-500/40 sm:bg-red-500/[0.08] sm:text-ink">
            <div className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-red-100 sm:text-red-400">Not ready</div>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight sm:text-xl">
              {u.name} NOT READY: <span className="sm:text-red-300">{tile.why}</span>
            </h2>
            {failingCerts.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {failingCerts.slice(0, 4).map((i) => (
                  <li key={i.id} className="text-base font-medium text-red-50 sm:text-sm sm:text-red-300">
                    • {i.title} — {i.status === "expired" ? `expired ${i.expiration_date ?? ""}` : "no expiration on file"}
                  </li>
                ))}
                {failingCerts.length > 4 && <li className="text-sm text-red-100 sm:text-red-300/80">+ {failingCerts.length - 4} more below</li>}
              </ul>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a href="#book" className="flex min-h-14 items-center justify-center rounded-xl bg-white px-5 text-base font-bold text-red-700 sm:min-h-10 sm:bg-bone sm:text-sm sm:text-coal">
                Fix it — open the truck book
              </a>
              <Link href={`/app/units/${unitId}/dispatch`} className="flex min-h-14 items-center justify-center rounded-xl border-2 border-white/40 px-5 text-base font-semibold text-white sm:min-h-10 sm:border sm:border-line-2 sm:text-sm sm:text-ink">
                Run the check anyway
              </Link>
            </div>
          </div>
        </section>
      )}
      {tile && tile.state === "due_soon" && (
        <section id="verdict">
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
            <div className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Due soon</div>
            <p className="mt-1.5 text-lg font-semibold leading-snug">{u.name} rolls today, but: {tile.why}</p>
            <a href="#book" className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-bone px-5 text-sm font-semibold text-coal sm:min-h-10">
              Renew it before it bites
            </a>
          </div>
        </section>
      )}

      {/* Truck book */}
      <section id="book" className="flex flex-col gap-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Truck book — certs, inspections &amp; DOT</h2>
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((it) => <ComplianceRow key={it.id} item={it} companyId={company.id} redirectPath={here} canDelete={company.role !== "member"} />)}
          </div>
        )}
        <AddDisclosure label={items.length ? "Add another item" : "Add a cert, inspection, or DOT item"} defaultOpen={items.length === 0}>
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
        </AddDisclosure>
      </section>

      {/* Gear list — the standing reference of what rides on this unit */}
      <Link href={`/app/units/${unitId}/loadout`}>
        <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Truck className="h-4 w-4 text-ink-dim" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">Gear list</div>
            <div className="truncate text-sm text-ink-dim">What rides on this truck — edit items, required vs optional</div>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
        </Card>
      </Link>

      {/* Dispatch history — the immutable records (spec #1d) */}
      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Dispatch history</h2>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <Link key={h.id} href={`/app/records/${h.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Truck className="h-4 w-4 text-ink-dim" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {h.type === "checkin" ? "Checked in" : "Readiness check"} · {new Date(h.started_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div className="truncate text-sm text-ink-dim">by {h.performed_by_name ?? "—"}</div>
                  </div>
                  {h.status === "not_ready" || h.status === "not_ready_override" ? (
                    <span className="shrink-0 rounded-sm border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">NOT ready</span>
                  ) : h.status === "partial" ? (
                    <span className="shrink-0 rounded-sm border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">Items not returned</span>
                  ) : (
                    <span className="shrink-0 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">{h.type === "checkin" ? "All back" : "Ready"}</span>
                  )}
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Crew on this unit — standing assignment; their cards decide this
          truck's ready call and pre-select on the readiness check. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Crew on this unit</h2>
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
                  <button type="submit" title="Unassign" className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-faint hover:bg-red-500/10 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </Card>
            ))}
          </div>
        )}
        {unassignedCrew.length > 0 ? (
          <AddDisclosure label={assignedCrew.length ? "Assign another hand" : "Assign a hand to this unit"} defaultOpen={assignedCrew.length === 0}>
            <form action={assignCrewToUnit} className="flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="unit_id" value={u.id} />
              <select name="crew_member_id" required defaultValue="" className={`${fld} flex-1`}>
                <option value="" disabled>Pick a hand…</option>
                {unassignedCrew.map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` — ${c.role}` : ""}</option>)}
              </select>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Assign</Button>
            </form>
          </AddDisclosure>
        ) : assignedCrew.length === 0 ? (
          <Card className="px-6 py-8 text-center text-sm text-ink-dim">
            No crew yet. <Link href="/app/crew" className="text-bone hover:underline">Add your hands</Link> first, then assign them here.
          </Card>
        ) : null}
      </section>

      {/* Assets */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Assets on this unit</h2>
        {assets.length > 0 && (
          <div className="flex flex-col gap-2">
            {assets.map((a) => (
              <Link key={a.id} href={`/app/assets/${a.id}`}>
                <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Box className="h-4 w-4 text-ink-dim" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.name}</span>
                    {a.last_seen_where ? (() => {
                      const age = seenAge(a.last_seen_at);
                      return (
                        <span className="block truncate text-xs text-ink-faint">
                          Last seen: {a.last_seen_where}
                          {age ? <span className={age.tone === "stale" ? "text-ink-faint" : age.tone === "aging" ? "text-amber-400" : "text-emerald-400"}> · {age.label}</span> : null}
                        </span>
                      );
                    })() : null}
                    {photoGap(a) ? (
                      <span className="mt-1 inline-block rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
                        {photoGap(a)}
                      </span>
                    ) : null}
                  </span>
                  {worstByAsset.has(a.id)
                    ? <StatusBadge status={worstByAsset.get(a.id)!} />
                    : <span className="shrink-0 text-xs text-ink-faint">no certs</span>}
                  <span className="hidden shrink-0 text-sm text-ink-dim sm:inline">{categoryLabel(a.category)}</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Card>
              </Link>
            ))}
          </div>
        )}
        <AddDisclosure label="Add an asset to this unit" defaultOpen={assets.length === 0}>
          <form action={addAsset} className="flex flex-col gap-3">
            <input type="hidden" name="unit_id" value={u.id} />
            <input type="hidden" name="yard_id" value={u.yard_id} />
            <input type="hidden" name="redirect_path" value={here} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="name" required placeholder="Asset name (e.g. BOP #3)" className={`${fld} flex-1`} />
              <select name="category" defaultValue="pressure_control" className={`${fld} sm:w-48`}>
                {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {/* Both shots at intake — the iron and its paper. Skippable in a
                hurry; the asset wears an amber flag until they exist. */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Photo of the asset
                <input type="file" name="photo" accept="image/*" capture="environment"
                  className="h-11 w-full rounded-lg border border-line-2 bg-coal px-2.5 py-2 text-sm text-ink-dim file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1 file:text-ink" />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Photo of the paperwork (cert, MTR, test chart)
                <input type="file" name="paperwork" accept="image/*" capture="environment"
                  className="h-11 w-full rounded-lg border border-line-2 bg-coal px-2.5 py-2 text-sm text-ink-dim file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1 file:text-ink" />
              </label>
            </div>
            <div>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
            </div>
          </form>
        </AddDisclosure>
      </section>
    </div>
  );
}
