import { notFound } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import DispatchClient, { type ToggleRow, type FactRow, type CrewOption } from "./dispatch-client";

export const dynamic = "force-dynamic";

export default async function DispatchPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();

  const { data: unitData } = await db
    .from("saas_units").select("id, name, type, yard_id")
    .eq("id", unitId).eq("company_id", company.id).maybeSingle();
  if (!unitData) notFound();
  const unit = unitData as { id: string; name: string; type: string; yard_id: string };

  const { data: enfData } = await db
    .from("saas_enforcement_settings")
    .select("require_photo_on_flagged, require_cosign")
    .eq("company_id", company.id).maybeSingle();
  const enfRow = enfData as { require_photo_on_flagged: boolean; require_cosign: boolean } | null;
  const enforcement = {
    requirePhotoOnFlagged: enfRow?.require_photo_on_flagged ?? false,
    requireCosign: enfRow?.require_cosign ?? false,
  };

  // Open checkout = latest checkout with no linked check-in → we're in check-in mode.
  const { data: lastCheckout } = await db
    .from("saas_dispatch_checks").select("id, started_at, job_ref")
    .eq("unit_id", unitId).eq("type", "checkout")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  let openCheckout: { id: string; started_at: string; job_ref: string | null } | null = null;
  if (lastCheckout) {
    const co = lastCheckout as { id: string; started_at: string; job_ref: string | null };
    const { count } = await db
      .from("saas_dispatch_checks").select("id", { count: "exact", head: true })
      .eq("checkout_id", co.id).eq("type", "checkin");
    if ((count ?? 0) === 0) openCheckout = co;
  }

  /* ── CHECK-IN mode: reverse checklist of what went out ── */
  if (openCheckout) {
    const { data: outItems } = await db
      .from("saas_dispatch_check_items")
      .select("id, source_type, source_id, label")
      .eq("check_id", openCheckout.id)
      .in("source_type", ["asset", "loadout_item"])
      .eq("result", "ok");
    const toggles: ToggleRow[] = ((outItems ?? []) as { id: string; source_type: "asset" | "loadout_item"; source_id: string | null; label: string }[])
      .map((i) => ({
        key: i.id,
        source_type: i.source_type,
        source_id: i.source_id,
        label: i.label,
        required: true, // everything that went out is expected back
      }));

    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          back={{ href: `/app/units/${unitId}`, label: unit.name }}
          title={`Check in — ${unit.name}`}
          description={`Out since ${new Date(openCheckout.started_at).toLocaleString()}${openCheckout.job_ref ? ` · ${openCheckout.job_ref}` : ""}. Flip anything that didn't come back.`}
        />
        <DispatchClient mode="checkin" unitId={unitId} unitName={unit.name} companyId={company.id} checkoutId={openCheckout.id}
          toggles={toggles} facts={[]} crew={[]} enforcement={enforcement} />
      </div>
    );
  }

  /* ── CHECK-OUT mode: template ▸ assets ▸ certs ▸ crew ── */
  // Template resolution: company unit-specific → company type default → global type default.
  const { data: templates } = await db
    .from("saas_loadout_templates")
    .select("id, company_id, unit_id, unit_type")
    .or(`unit_id.eq.${unitId},unit_type.eq.${unit.type}`);
  type Tpl = { id: string; company_id: string | null; unit_id: string | null; unit_type: string | null };
  const tpls = (templates ?? []) as Tpl[];
  const template =
    tpls.find((t) => t.unit_id === unitId) ??
    tpls.find((t) => t.company_id === company.id && t.unit_type === unit.type) ??
    tpls.find((t) => t.company_id === null && t.unit_type === unit.type) ??
    null;

  let loadoutRows: ToggleRow[] = [];
  if (template) {
    const { data: items } = await db
      .from("saas_loadout_items").select("id, label, category, required, sort")
      .eq("template_id", template.id).order("sort");
    loadoutRows = ((items ?? []) as { id: string; label: string; category: string | null; required: boolean; sort: number }[])
      .map((i) => ({
        key: `li-${i.id}`,
        source_type: "loadout_item" as const,
        source_id: i.id,
        label: i.label,
        sub: i.category ?? undefined,
        required: i.required,
      }));
  }

  const { data: assetData } = await db
    .from("saas_assets").select("id, name, category, status")
    .eq("unit_id", unitId).order("name");
  const assetRows: ToggleRow[] = ((assetData ?? []) as { id: string; name: string; category: string; status: string }[])
    .map((a) => ({
      key: `as-${a.id}`,
      source_type: "asset" as const,
      source_id: a.id,
      label: a.name,
      sub: a.category.replace(/_/g, " "),
      required: true,
      initialMissing: a.status === "missing",
    }));

  // Paper facts: the unit's certs PLUS its assets' certs (a BOP test on the
  // BOP is exactly the kind of miss this screen exists to catch).
  const assetIds = ((assetData ?? []) as { id: string }[]).map((a) => a.id);
  const assetNameById = new Map(((assetData ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
  const [{ data: unitCertData }, { data: assetCertData }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("id, title, kind, expiration_date, status, parent_id")
      .eq("parent_type", "unit").eq("parent_id", unitId),
    assetIds.length
      ? db.from("saas_compliance_items_with_status")
          .select("id, title, kind, expiration_date, status, parent_id")
          .eq("parent_type", "asset").in("parent_id", assetIds)
      : Promise.resolve({ data: [] }),
  ]);
  type CertRow = { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_id: string };
  const facts: FactRow[] = [
    ...((unitCertData ?? []) as CertRow[]).map((c) => ({
      key: `ce-${c.id}`,
      source_type: "cert" as const,
      source_id: c.id,
      label: c.title,
      sub: c.expiration_date ? `expires ${c.expiration_date}` : "no expiration set",
      status: c.status,
    })),
    ...((assetCertData ?? []) as CertRow[]).map((c) => ({
      key: `ce-${c.id}`,
      source_type: "cert" as const,
      source_id: c.id,
      label: `${c.title} (${assetNameById.get(c.parent_id) ?? "asset"})`,
      sub: c.expiration_date ? `expires ${c.expiration_date}` : "no expiration set",
      status: c.status,
    })),
  ];

  // Crew + their certs (crew certs live in the same compliance table, parent_type='crew').
  // Standing unit assignments pre-select so the ready call includes the real crew by default.
  const [{ data: crewData }, { data: assignedData }] = await Promise.all([
    db.from("saas_crew_members").select("id, name, role")
      .eq("company_id", company.id).eq("status", "active").order("name"),
    db.from("saas_unit_crew").select("crew_member_id").eq("unit_id", unitId),
  ]);
  const assignedCrewIds = ((assignedData ?? []) as { crew_member_id: string }[]).map((r) => r.crew_member_id);
  const crewRows = (crewData ?? []) as { id: string; name: string; role: string | null }[];
  let crew: CrewOption[] = [];
  if (crewRows.length) {
    const { data: crewCertData } = await db
      .from("saas_compliance_items_with_status")
      .select("id, title, status, expiration_date, parent_id")
      .eq("parent_type", "crew")
      .in("parent_id", crewRows.map((c) => c.id));
    const byCrew = new Map<string, CrewOption["certs"]>();
    for (const cc of (crewCertData ?? []) as { id: string; title: string; status: ComplianceStatus; expiration_date: string | null; parent_id: string }[]) {
      const arr = byCrew.get(cc.parent_id) ?? [];
      arr.push({ id: cc.id, title: cc.title, status: cc.status, expiration_date: cc.expiration_date });
      byCrew.set(cc.parent_id, arr);
    }
    crew = crewRows.map((c) => ({ id: c.id, name: c.name, role: c.role, certs: byCrew.get(c.id) ?? [] }));
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: `/app/units/${unitId}`, label: unit.name }}
        title={`Roll ${unit.name}`}
        description="Flip anything that's missing. Paper and crew cards are pulled live — they don't lie."
      />
      <DispatchClient mode="checkout" unitId={unitId} unitName={unit.name} companyId={company.id}
        toggles={[...loadoutRows, ...assetRows]} facts={facts} crew={crew}
        initialCrewIds={assignedCrewIds} enforcement={enforcement} />
    </div>
  );
}
