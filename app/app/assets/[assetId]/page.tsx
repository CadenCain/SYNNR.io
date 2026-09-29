import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Box, Settings2, Trash2, Printer, ExternalLink, MapPin, AlertTriangle } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { categoryLabel, ASSET_CATEGORIES } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import { Button, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceRow, { type RowItem, ROW_COLUMNS } from "@/app/app/_components/compliance-row";
import { AddCert } from "@/app/app/_components/cert-upload";
import { paperLinks } from "@/lib/saas/paper";
import { getYardRules, isManagerRole } from "@/lib/saas/yard-rules";
import { AddDisclosure } from "@/components/ui/disclosure";
import { getItemCustomers } from "@/lib/saas/customers";
import { updateAsset, deleteAsset } from "@/app/app/_actions";
import { moveEquipment } from "@/app/app/equipment/actions";
import { fmtWhen } from "@/lib/saas/format";
import { judgeItem } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { qrSvg, tagUrl } from "@/lib/saas/qr";
import PhotoUpload from "./photo-upload";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

export default async function AssetDetail({ params }: { params: Promise<{ assetId: string }> }) {
  const { company } = await requireCompany();
  const { assetId } = await params;
  const db = await saasDb();
  const here = `/app/assets/${assetId}`;

  const { data: asset } = await db
    .from("saas_assets").select("id, name, category, identifier, status, primary_photo_path, unit_id, yard_id, tag_token, last_seen_where, last_seen_by, last_seen_at")
    .eq("id", assetId).eq("company_id", company.id).maybeSingle();
  if (!asset) notFound();
  const a = asset as { id: string; name: string; category: string; identifier: string | null; status: string; primary_photo_path: string | null; unit_id: string | null; yard_id: string | null; tag_token: string; last_seen_where: string | null; last_seen_by: string | null; last_seen_at: string | null };

  // Where it is, the places it could move to, and where it's been.
  const [{ data: unitData }, { data: yardData }, { data: moveData }] = await Promise.all([
    db.from("saas_units").select("id, name, yard_id").eq("company_id", company.id).order("name"),
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    db.from("saas_asset_moves").select("id, from_where, to_where, note, actor, created_at")
      .eq("company_id", company.id).eq("asset_id", assetId).order("created_at", { ascending: false }).limit(12),
  ]);
  const units = (unitData ?? []) as { id: string; name: string; yard_id: string }[];
  const yards = (yardData ?? []) as { id: string; name: string }[];
  const moves = (moveData ?? []) as { id: string; from_where: string | null; to_where: string; note: string | null; actor: string | null; created_at: string }[];
  const unit = units.find((u) => u.id === a.unit_id) ?? null;
  const yardName = new Map(yards.map((y) => [y.id, y.name]));
  const where = unit
    ? `${unit.name}${yardName.get(unit.yard_id) ? ` · ${yardName.get(unit.yard_id)}` : ""}`
    : (a.yard_id && yardName.get(a.yard_id)) || "No location";
  const whereValue = unit ? `unit:${unit.id}` : a.yard_id ? `yard:${a.yard_id}` : "";

  let photoUrl: string | null = null;
  if (a.primary_photo_path) {
    const { data: signed } = await db.storage.from("proofs").createSignedUrl(a.primary_photo_path, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }

  // Paperwork shot (cert / MTR / test chart) — latest attachment labeled so.
  const { data: paperRows } = await db.from("saas_attachments")
    .select("storage_path").eq("company_id", company.id)
    .eq("entity_type", "asset").eq("entity_id", assetId).eq("label", "paperwork")
    .order("created_at", { ascending: false }).limit(1);
  let paperUrl: string | null = null;
  const paperPath = ((paperRows ?? []) as { storage_path: string }[])[0]?.storage_path ?? null;
  if (paperPath) {
    const { data: signed } = await db.storage.from("proofs").createSignedUrl(paperPath, 3600);
    paperUrl = signed?.signedUrl ?? null;
  }

  const { data: ciData } = await db
    .from("saas_compliance_items_with_status")
    .select(ROW_COLUMNS)
    .eq("company_id", company.id).eq("parent_type", "asset").eq("parent_id", assetId)
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const items = (ciData ?? []) as RowItem[];
  const itemCustomers = await getItemCustomers(db, company.id, items.map((i) => i.id));
  for (const it of items) it.customers = itemCustomers.get(it.id) ?? [];
  const [paper, rules, qr] = await Promise.all([paperLinks(db, items), getYardRules(db, company.id), qrSvg(tagUrl(a.tag_token))]);
  const isManager = isManagerRole(company.role);

  // The one line that matters: worst first, then the soonest due.
  const today = localToday();
  const RANK = { expired: 0, missing: 1, pending: 2, due_soon: 3, ok: 4 } as const;
  const next = items
    .map((i) => ({ i, j: judgeItem(i, today, today) }))
    .sort((x, y) => RANK[x.j.result] - RANK[y.j.result] || (x.i.expiration_date ?? "").localeCompare(y.i.expiration_date ?? ""))[0] ?? null;
  const status = a.status === "out_of_service" ? { label: "Red-tagged", cls: "border-red-500/40 bg-red-500/10 text-red-400" }
    : a.status === "missing" ? { label: "Missing", cls: "border-red-500/40 bg-red-500/10 text-red-400" }
    : a.status === "retired" ? { label: "Retired", cls: "border-line-2 bg-elevated text-ink-faint" }
    : !next ? { label: "No paper yet", cls: "border-line-2 bg-elevated text-ink-dim" }
    : next.j.result === "expired" || next.j.result === "missing" ? { label: "Overdue", cls: "border-red-500/40 bg-red-500/10 text-red-400" }
    : next.j.result === "ok" ? { label: "Current", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" }
    : { label: "Due soon", cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" };
  const nextTone = !next ? "text-ink-faint" : next.j.result === "ok" ? "text-ink-dim" : next.j.result === "due_soon" || next.j.result === "pending" ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={{ href: "/app", label: "Equipment" }}
        title={a.name}
        description={`${categoryLabel(a.category)}${a.identifier ? ` · Serial ${a.identifier}` : " · No serial on file"}`}
        actions={
          <Popover>
            <PopoverTrigger className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink">
              <Settings2 className="h-4 w-4" /> Manage
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <form action={updateAsset} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={a.id} />
                <label className="text-xs text-ink-faint">Name<input name="name" defaultValue={a.name} required className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Category
                  <select name="category" defaultValue={a.category} className={`${fld} mt-1 w-full`}>
                    {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select></label>
                {a.status === "out_of_service" && !isManager ? (
                  <>
                    <input type="hidden" name="status" value="out_of_service" />
                    <p className="text-xs text-ink-faint">Red-tagged. Only a manager can put it back in service.</p>
                  </>
                ) : (
                  <label className="text-xs text-ink-faint">Status
                    <select name="status" defaultValue={a.status} className={`${fld} mt-1 w-full`}>
                      <option value="in_service">In service</option>
                      <option value="out_of_service">Red-tagged (out of service)</option>
                      <option value="missing">Missing</option>
                      {isManager || a.status === "retired" ? <option value="retired">Retired (scrapped or sold)</option> : null}
                    </select></label>
                )}
                {isManager ? (
                  <label className="text-xs text-ink-faint">Serial number<input name="identifier" defaultValue={a.identifier ?? ""} className={`${fld} mt-1 w-full`} /></label>
                ) : null}
                <Button type="submit" size="sm">Save</Button>
              </form>
              {isManager && (
              <div className="mt-2 border-t border-line pt-2">
                <AlertDialog>
                  <AlertDialogTrigger className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete asset
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {a.name}?</AlertDialogTitle>
                      <AlertDialogDescription>Its certs, records, and photo go with it. There is no undo.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <form action={deleteAsset}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="unit_id" value={a.unit_id ?? ""} />
                        <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-white hover:bg-red-400")}>Delete it</button>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </PopoverContent>
          </Popover>
        }
      />

      {/* The three things anyone opening this wants: is it good, where is
          it, and what's due next. */}
      <Card className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex flex-col gap-1.5 p-4">
          <span className="text-xs font-medium text-ink-faint">Status</span>
          <span className={`w-fit whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 p-4">
          <span className="text-xs font-medium text-ink-faint">Where it is</span>
          <span className="break-words font-medium">{where}</span>
          {a.last_seen_where ? <span className="break-words text-[13px] text-ink-dim">{a.last_seen_where}</span> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 p-4">
          <span className="text-xs font-medium text-ink-faint">Next test</span>
          {next ? (
            <>
              <span className="break-words font-medium">{next.i.title}</span>
              <span className={`text-[13px] ${nextTone}`}>{next.j.detail}</span>
            </>
          ) : <span className="text-sm text-ink-faint">Nothing tracked yet. Add its test below.</span>}
        </div>
      </Card>

      {a.status === "out_of_service" || a.status === "missing" ? (
        <Card className="flex items-start gap-3 border-red-500/40 bg-red-500/[0.05] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-red-300">
            {a.status === "missing" ? "Flagged missing." : "Red-tagged. It can't go out."} {unit ? `${unit.name} reads NOT READY until this is cleared.` : ""}
            {a.status === "out_of_service" ? " Only a manager can put it back in service." : ""}
          </p>
        </Card>
      ) : a.status === "retired" ? (
        <Card className="p-4 text-sm text-ink-dim">Retired. It&apos;s kept for the record but left out of every count, alert, and truck check.</Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-ink-dim">Tests, certs &amp; inspections</h2>
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((it) => <ComplianceRow key={it.id} item={it} redirectPath={here} isManager={isManager} allowOnTheWay={rules.allowCertOnTheWay} paperUrl={paper.get(it.id)} />)}
          </div>
        )}
        <AddDisclosure label={items.length ? "Add another" : "Add a test, cert, or inspection"} defaultOpen={items.length === 0}>
          <AddCert parentType="asset" parentId={a.id} redirectPath={here} isManager={isManager} defaultKind="test"
            placeholder="e.g. Pressure test, UT inspection" heading="" bare />
        </AddDisclosure>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Where it is and where it's been. The database writes the history
            itself on every move (migration 0010), so it can't be skipped. */}
        <Card className="flex min-w-0 flex-col gap-4 p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-ink-dim">Move it</h2>
          <form action={moveEquipment} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={a.id} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <select name="where" defaultValue={whereValue} aria-label="Where to" className={`${fld} w-full min-w-0 grow`}>
                {whereValue === "" && <option value="">No location</option>}
                {yards.map((y) => (
                  <optgroup key={y.id} label={y.name}>
                    <option value={`yard:${y.id}`}>{y.name} (in the yard)</option>
                    {units.filter((u) => u.yard_id === y.id).map((u) => <option key={u.id} value={`unit:${u.id}`}>{u.name}</option>)}
                  </optgroup>
                ))}
              </select>
              <input name="note" maxLength={120} placeholder="Note, e.g. rack 2, shop bench" className={`${fld} w-full min-w-0 grow`} />
            </div>
            <Button type="submit" className="sm:self-start"><MapPin className="h-4 w-4" /> Save where it is</Button>
          </form>
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <h3 className="text-xs font-medium text-ink-faint">Where it&apos;s been</h3>
            {moves.length === 0 ? <p className="text-sm text-ink-faint">No moves yet.</p> : (
              <ol className="flex flex-col gap-2.5">
                {moves.map((m) => (
                  <li key={m.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-bone/60" aria-hidden />
                    <div className="min-w-0">
                      <div className="break-words">
                        {m.from_where === null ? <>Added at <span className="font-medium">{m.to_where}</span></>
                          : m.from_where === m.to_where ? <>At <span className="font-medium">{m.to_where}</span></>
                          : <>Moved to <span className="font-medium">{m.to_where}</span> <span className="text-ink-faint">from {m.from_where}</span></>}
                        {m.note ? <span className="text-ink-dim">, {m.note}</span> : null}
                      </div>
                      <div className="text-xs text-ink-faint">{fmtWhen(m.created_at)}{m.actor ? ` · ${m.actor}` : ""}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>

        {/* The tag on the iron. Scanning it opens a public page with this
            piece's tests and paper, no login. */}
        <Card className="flex flex-col items-center gap-3 p-5 text-center lg:col-span-2">
          <h2 className="self-start text-sm font-semibold text-ink-dim">QR tag</h2>
          <div className="w-40 rounded-lg border border-line bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-[13px] text-ink-dim">Stick it on the iron. Anyone who scans it with a phone camera sees its serial, test dates, and paper. No login.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/app/tags?ids=${a.id}`} className={buttonClass("outline", "sm")}><Printer className="h-4 w-4" /> Print tag</Link>
            <a href={`/t/${a.tag_token}`} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")}><ExternalLink className="h-4 w-4" /> What a scan shows</a>
          </div>
        </Card>
      </div>

      {/* Two shots make an asset accountable: the iron and its paper. A slot
          without its photo wears amber — flagged, not blocked, same rule as a
          cert with no date. */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold text-ink-dim">Photos of the iron and its paperwork</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">The iron</span>
              <PhotoUpload assetId={a.id} companyId={company.id} hasPhoto={!!photoUrl} />
            </div>
            {photoUrl ? (
              <Image src={photoUrl} alt={a.name} width={640} height={400} unoptimized
                className="max-h-72 w-full rounded-xl border border-line object-cover" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] text-sm text-amber-400">
                <Box className="h-5 w-5" /> No photo of the iron yet
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">The paperwork</span>
              <PhotoUpload assetId={a.id} companyId={company.id} hasPhoto={!!paperUrl} label="paperwork" />
            </div>
            {paperUrl ? (
              <Image src={paperUrl} alt={`${a.name} paperwork`} width={640} height={400} unoptimized
                className="max-h-72 w-full rounded-xl border border-line object-cover" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.04] text-sm text-amber-400">
                <Box className="h-5 w-5" /> No photo of the paperwork yet
              </div>
            )}
          </div>
        </div>
      </Card>

    </div>
  );
}
