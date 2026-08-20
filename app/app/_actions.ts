"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompany, requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";

// Every record change is logged under the hand who made it — "who renewed
// this" is half the point of a compliance trail.
function actorName(user: { user_metadata?: { full_name?: string }; email?: string | null }): string | null {
  return user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || null;
}
import { clearAlertLog } from "@/lib/saas/alert-log";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/**
 * Delete the compliance items hanging off a parent that's being removed.
 *
 * saas_compliance_items.parent_id is polymorphic (parent_type + parent_id) so
 * there is no foreign key to cascade. Without this, deleting a truck leaves
 * its certs behind forever: the sweep queries items by company_id alone, so
 * the shop keeps getting alerts for a truck it SOLD, and readiness counts the
 * ghost item — pinning the score at 74% with no page left in the UI to reach
 * it and fix it.
 */
async function purgeItemsFor(
  db: Awaited<ReturnType<typeof saasDb>>,
  companyId: string,
  parentType: "unit" | "asset" | "crew",
  parentIds: string[],
) {
  const ids = parentIds.filter(Boolean);
  if (ids.length === 0) return;
  const { data } = await db.from("saas_compliance_items").select("id")
    .eq("company_id", companyId).eq("parent_type", parentType).in("parent_id", ids);
  const itemIds = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (itemIds.length === 0) return;
  await db.from("saas_compliance_items").delete().eq("company_id", companyId).in("id", itemIds);
  // Their alert-log rows go too, so a recycled id can never inherit a mute.
  await clearAlertLog(companyId, itemIds);
}

// ── YARD ──
export async function updateYard(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const location = str(fd, "location") || null;
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_yards").update({ name, location }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/yards/${id}`);
}
export async function deleteYard(fd: FormData) {
  const { company } = await requireBillableCompany();
  assertCan(company, "delete_yard");
  const id = str(fd, "id");
  const db = await saasDb();
  // Same cascade problem one level up: units in this yard, their assets, and
  // every cert hanging off either. Do it before the yard goes.
  const { data: unitRows } = await db.from("saas_units").select("id")
    .eq("company_id", company.id).eq("yard_id", id);
  const unitIds = ((unitRows ?? []) as { id: string }[]).map((u) => u.id);
  {
    // Assets hang off units OR directly off the yard; both orphan on a yard
    // delete (unit_id/yard_id are SET NULL, not CASCADE) — collect both.
    const { data: assetRows } = await db.from("saas_assets").select("id")
      .eq("company_id", company.id)
      .or(`yard_id.eq.${id}${unitIds.length ? `,unit_id.in.(${unitIds.join(",")})` : ""}`);
    const assetIds = ((assetRows ?? []) as { id: string }[]).map((a) => a.id);
    await purgeItemsFor(db, company.id, "unit", unitIds);
    await purgeItemsFor(db, company.id, "asset", assetIds);
    if (assetIds.length) await db.from("saas_assets").delete().eq("company_id", company.id).in("id", assetIds);
    if (unitIds.length) await db.from("saas_units").delete().eq("company_id", company.id).in("id", unitIds);
  }
  await db.from("saas_yards").delete().eq("id", id).eq("company_id", company.id);
  // Deliberately NOT touching the subscription: under the hard cap the
  // allowance only moves when the owner moves it (spec: no silent credits
  // either — they lower the plan from Billing and see the proration).
  redirect("/app/yards");
}

// ── UNIT ──
export async function updateUnit(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const type = str(fd, "type") || "other";
  const identifier = str(fd, "identifier") || null;
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_units").update({ name, type, identifier }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/units/${id}`);
}
export async function deleteUnit(fd: FormData) {
  const { company } = await requireBillableCompany();
  assertCan(company, "delete_record");
  const id = str(fd, "id");
  const yard_id = str(fd, "yard_id");
  const db = await saasDb();
  // Clean up what the DB can't cascade: the unit's own certs, then each of
  // its assets' certs, then the assets. Otherwise they alert forever.
  const { data: assetRows } = await db.from("saas_assets").select("id")
    .eq("company_id", company.id).eq("unit_id", id);
  const assetIds = ((assetRows ?? []) as { id: string }[]).map((a) => a.id);
  await purgeItemsFor(db, company.id, "unit", [id]);
  await purgeItemsFor(db, company.id, "asset", assetIds);
  if (assetIds.length) await db.from("saas_assets").delete().eq("company_id", company.id).in("id", assetIds);
  await db.from("saas_units").delete().eq("id", id).eq("company_id", company.id);
  redirect(yard_id ? `/app/yards/${yard_id}` : "/app/yards");
}

// ── ASSET ──
export async function updateAsset(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const category = str(fd, "category") || "other";
  const identifier = str(fd, "identifier") || null;
  const status = str(fd, "status") || "in_service";
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_assets").update({ name, category, identifier, status }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/assets/${id}`);
}
/**
 * "Last seen" — where a piece of gear was last spotted and who said so.
 * A NOTE, not a tracker: this deliberately never feeds the readiness verdict
 * or the score (docs/spec-last-seen.md). A stale note must never turn a truck
 * red — only an explicitly flagged asset does that.
 */
export async function updateAssetLastSeen(fd: FormData) {
  const { company, user } = await requireCompany();
  const id = str(fd, "id");
  const where = str(fd, "last_seen_where");
  if (!id || !where) return;
  const by =
    str(fd, "last_seen_by") ||
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "someone";

  const db = await saasDb();
  const { data, error } = await db
    .from("saas_assets")
    .update({ last_seen_where: where, last_seen_by: by, last_seen_at: new Date().toISOString() })
    .eq("id", id).eq("company_id", company.id)
    .select("name, unit_id").maybeSingle();
  if (error) throw new Error(error.message);

  const row = data as { name: string; unit_id: string | null } | null;
  if (row) {
    void logEvent({
      companyId: company.id,
      kind: "asset_seen",
      unitId: row.unit_id,
      actor: by,
      message: `${row.name} — last seen ${where}, per ${by}`,
    });
  }
  revalidatePath(`/app/assets/${id}`);
  if (row?.unit_id) revalidatePath(`/app/units/${row.unit_id}`);
}

export async function deleteAsset(fd: FormData) {
  const { company } = await requireBillableCompany();
  assertCan(company, "delete_record");
  const id = str(fd, "id");
  const unit_id = str(fd, "unit_id");
  const db = await saasDb();
  await purgeItemsFor(db, company.id, "asset", [id]); // its certs would alert forever
  await db.from("saas_assets").delete().eq("id", id).eq("company_id", company.id);
  redirect(unit_id ? `/app/units/${unit_id}` : "/app/yards");
}

// ── CREW ──
export async function updateCrewMember(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const role = str(fd, "role") || null;
  const phone = str(fd, "phone") || null;
  const status = str(fd, "status") || "active";
  if (!id || !name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_crew_members").update({ name, role, phone, status }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/crew/${id}`);
}
export async function deleteCrewMember(fd: FormData) {
  const { company } = await requireBillableCompany();
  assertCan(company, "delete_record");
  const id = str(fd, "id");
  const db = await saasDb();
  // Crew certs live in saas_compliance_items(parent_type='crew') — remove them with the member.
  await db.from("saas_compliance_items").delete().eq("parent_type", "crew").eq("parent_id", id).eq("company_id", company.id);
  await db.from("saas_crew_members").delete().eq("id", id).eq("company_id", company.id);
  redirect("/app/crew");
}

// ── SAMPLE YARD (spec P2: see the app full before entering real data) ──
const SAMPLE_YARD = "Sample Yard (demo)";
const SAMPLE_TAG = " (demo)";

export async function loadSampleYard() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const iso = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };

  const { data: existing } = await db.from("saas_yards").select("id").eq("company_id", company.id).eq("name", SAMPLE_YARD).maybeSingle();
  if (existing) { redirect("/app"); }

  // A realistic wireline yard, not a smoke test: three trucks, pressure
  // control with real recert dates, crew paper across H2S / well control /
  // CDL / medical — and Wireline 7 deliberately NOT READY three different
  // ways (expired BOP test, lubricator flagged missing, hand's well control
  // lapsed) so a demo shows the verdict naming every reason, not one.
  const { data: yard, error } = await db.from("saas_yards")
    .insert({ company_id: company.id, name: SAMPLE_YARD, location: "Odessa, TX" }).select("id").single();
  if (error) throw new Error(error.message);
  const yardId = (yard as { id: string }).id;

  const unitRows = [
    { name: `Wireline 7${SAMPLE_TAG}`, type: "wireline_truck", identifier: "WL-007" },   // NOT READY
    { name: `Wireline 12${SAMPLE_TAG}`, type: "wireline_truck", identifier: "WL-012" },  // due soon
    { name: `Crane 3${SAMPLE_TAG}`, type: "crane_truck", identifier: "CR-003" },         // ready
  ];
  const unitIds: string[] = [];
  for (const u of unitRows) {
    const { data } = await db.from("saas_units")
      .insert({ company_id: company.id, yard_id: yardId, ...u }).select("id").single();
    unitIds.push((data as { id: string }).id);
  }
  const [wl7, wl12, cr3] = unitIds;

  const assetRows = [
    { unit_id: wl7, name: `BOP #3${SAMPLE_TAG}`, category: "pressure_control", status: "in_service" },
    { unit_id: wl7, name: `Lubricator #2${SAMPLE_TAG}`, category: "pressure_control", status: "missing" }, // fails WL-7 until found
    { unit_id: wl12, name: `BOP #5${SAMPLE_TAG}`, category: "pressure_control", status: "in_service" },
    { unit_id: wl12, name: `Lubricator #4${SAMPLE_TAG}`, category: "pressure_control", status: "in_service" },
    { unit_id: cr3, name: `Wire rope slings${SAMPLE_TAG}`, category: "lifting", status: "in_service" },
  ];
  const assetIds: string[] = [];
  for (const a of assetRows) {
    const { data } = await db.from("saas_assets")
      .insert({ company_id: company.id, yard_id: yardId, ...a }).select("id").single();
    assetIds.push((data as { id: string }).id);
  }
  const [bop3, , bop5, lub4, slings] = assetIds;

  await db.from("saas_compliance_items").insert([
    // Wireline 7 — the red truck
    { company_id: company.id, parent_type: "unit", parent_id: wl7, title: "Annual DOT inspection", kind: "inspection", issued_date: iso(-300), expiration_date: iso(65) },
    { company_id: company.id, parent_type: "asset", parent_id: bop3, title: "BOP test", kind: "test", issued_date: iso(-190), expiration_date: iso(-4) }, // EXPIRED
    // Wireline 12 — legal but on the clock
    { company_id: company.id, parent_type: "unit", parent_id: wl12, title: "Annual DOT inspection", kind: "inspection", issued_date: iso(-200), expiration_date: iso(165) },
    { company_id: company.id, parent_type: "unit", parent_id: wl12, title: "DOT sticker", kind: "dot_sticker", issued_date: iso(-353), expiration_date: iso(12) }, // due soon
    { company_id: company.id, parent_type: "asset", parent_id: bop5, title: "BOP test", kind: "test", issued_date: iso(-60), expiration_date: iso(120) },
    { company_id: company.id, parent_type: "asset", parent_id: lub4, title: "Pressure test — 10k", kind: "test", issued_date: iso(-45), expiration_date: iso(135) },
    // Crane 3 — clean
    { company_id: company.id, parent_type: "unit", parent_id: cr3, title: "Annual DOT inspection", kind: "inspection", issued_date: iso(-100), expiration_date: iso(265) },
    { company_id: company.id, parent_type: "asset", parent_id: slings, title: "Rigging inspection", kind: "inspection", issued_date: iso(-30), expiration_date: iso(335) },
  ]);

  const crewRows = [
    { name: `Jerry Boles${SAMPLE_TAG}`, role: "operator", phone: "432-555-0101" },
    { name: `Dale Hutto${SAMPLE_TAG}`, role: "operator" },
    { name: `Manny Ortiz${SAMPLE_TAG}`, role: "driver" },
    { name: `Colt Pruett${SAMPLE_TAG}`, role: "crane operator" },
  ];
  const crewIds: string[] = [];
  for (const c of crewRows) {
    const { data } = await db.from("saas_crew_members")
      .insert({ company_id: company.id, ...c }).select("id").single();
    crewIds.push((data as { id: string }).id);
  }
  const [jerry, dale, manny, colt] = crewIds;

  await db.from("saas_compliance_items").insert([
    { company_id: company.id, parent_type: "crew", parent_id: jerry, title: "H2S Clear", kind: "cert", issued_date: iso(-360), expiration_date: iso(6) },      // expiring
    { company_id: company.id, parent_type: "crew", parent_id: jerry, title: "Well control — wireline", kind: "cert", issued_date: iso(-300), expiration_date: iso(430) },
    { company_id: company.id, parent_type: "crew", parent_id: dale, title: "H2S Clear", kind: "cert", issued_date: iso(-200), expiration_date: iso(165) },
    { company_id: company.id, parent_type: "crew", parent_id: dale, title: "Well control — wireline", kind: "cert", issued_date: iso(-800), expiration_date: iso(-70) }, // EXPIRED — blocks WL-7
    { company_id: company.id, parent_type: "crew", parent_id: manny, title: "CDL", kind: "cert", issued_date: iso(-400), expiration_date: iso(500) },
    { company_id: company.id, parent_type: "crew", parent_id: manny, title: "DOT medical card", kind: "cert", issued_date: iso(-300), expiration_date: iso(65) },
    { company_id: company.id, parent_type: "crew", parent_id: colt, title: "Crane operator cert (NCCCO)", kind: "cert", issued_date: iso(-500), expiration_date: iso(230) },
    { company_id: company.id, parent_type: "crew", parent_id: colt, title: "H2S Clear", kind: "cert", issued_date: iso(-100), expiration_date: iso(265) },
  ]);

  await db.from("saas_unit_crew").insert([
    { company_id: company.id, unit_id: wl7, crew_member_id: dale },   // his lapsed well control blocks WL-7
    { company_id: company.id, unit_id: wl7, crew_member_id: manny },
    { company_id: company.id, unit_id: wl12, crew_member_id: jerry },
    { company_id: company.id, unit_id: wl12, crew_member_id: manny },
    { company_id: company.id, unit_id: cr3, crew_member_id: colt },
  ]);

  revalidatePath("/app");
  redirect("/app");
}

export async function clearSampleYard() {
  const { company } = await requireCompany();
  const db = await saasDb();
  // Deleting the yard cascades UNITS but NOT assets — saas_assets.unit_id and
  // yard_id are ON DELETE SET NULL, proven live in the 2026-08-18 audit when
  // this function left five orphaned "(demo)" assets floating with no yard.
  // So assets get deleted explicitly, same as deleteYard does.
  const { data: yard } = await db.from("saas_yards").select("id").eq("company_id", company.id).eq("name", SAMPLE_YARD).maybeSingle();
  if (yard) {
    const yardId = (yard as { id: string }).id;
    const { data: units } = await db.from("saas_units").select("id").eq("yard_id", yardId);
    const unitIds = ((units ?? []) as { id: string }[]).map((x) => x.id);
    const { data: assets } = await db.from("saas_assets").select("id")
      .eq("company_id", company.id).or(`yard_id.eq.${yardId}${unitIds.length ? `,unit_id.in.(${unitIds.join(",")})` : ""}`);
    const assetIds = ((assets ?? []) as { id: string }[]).map((x) => x.id);
    const parentIds = [...unitIds, ...assetIds];
    if (parentIds.length) {
      await db.from("saas_compliance_items").delete().eq("company_id", company.id).in("parent_id", parentIds);
    }
    if (assetIds.length) await db.from("saas_assets").delete().eq("company_id", company.id).in("id", assetIds);
    await db.from("saas_yards").delete().eq("id", yardId);
  }
  const { data: crew } = await db.from("saas_crew_members").select("id").eq("company_id", company.id).like("name", `%${SAMPLE_TAG}`);
  const crewIds = ((crew ?? []) as { id: string }[]).map((x) => x.id);
  if (crewIds.length) {
    await db.from("saas_compliance_items").delete().eq("company_id", company.id).eq("parent_type", "crew").in("parent_id", crewIds);
    await db.from("saas_crew_members").delete().in("id", crewIds);
  }
  revalidatePath("/app");
  redirect("/app");
}

// ── UNIT ↔ CREW (standing assignment — feeds the checkout ready decision) ──
export async function assignCrewToUnit(fd: FormData) {
  const { company } = await requireCompany();
  const unit_id = str(fd, "unit_id");
  const crew_member_id = str(fd, "crew_member_id");
  if (!unit_id || !crew_member_id) return;
  const db = await saasDb();
  // Both ids ride in from the browser — an assignment pointing at another
  // company's unit or hand must never exist, even stamped with our id.
  const [{ data: u }, { data: c }] = await Promise.all([
    db.from("saas_units").select("id").eq("id", unit_id).eq("company_id", company.id).maybeSingle(),
    db.from("saas_crew_members").select("id").eq("id", crew_member_id).eq("company_id", company.id).maybeSingle(),
  ]);
  if (!u || !c) return;
  await db.from("saas_unit_crew").upsert({ unit_id, crew_member_id, company_id: company.id });
  revalidatePath(`/app/units/${unit_id}`);
}
export async function unassignCrewFromUnit(fd: FormData) {
  const { company } = await requireCompany();
  const unit_id = str(fd, "unit_id");
  const crew_member_id = str(fd, "crew_member_id");
  const db = await saasDb();
  await db.from("saas_unit_crew").delete()
    .eq("unit_id", unit_id).eq("crew_member_id", crew_member_id).eq("company_id", company.id);
  revalidatePath(`/app/units/${unit_id}`);
}

// ── COMPLIANCE ITEM ──
export async function updateComplianceItem(fd: FormData) {
  const { company, user } = await requireCompany();
  const id = str(fd, "id");
  const title = str(fd, "title");
  const kind = str(fd, "kind") || "cert";
  const issued_date = str(fd, "issued_date") || null;
  const expiration_date = str(fd, "expiration_date") || null;
  const redirectPath = str(fd, "redirect_path");
  if (!id || !title) return;
  const db = await saasDb();
  const { error } = await db.from("saas_compliance_items")
    .update({ title, kind, issued_date, expiration_date }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);

  // A new date means a new cycle — clear the alert log or the sweep's
  // per-item dedupe mutes this item forever (the camera-renew path has always
  // done this; typing the date in this form did not, so hand-edited items
  // silently stopped alerting).
  await clearAlertLog(company.id, id);

  // Customer relevance tags: comma-separated names → ensure each customer
  // exists, then replace this item's joins. Blank = applies to all jobs.
  if (fd.has("customers")) {
    const names = str(fd, "customers").split(",").map((n) => n.trim()).filter(Boolean);
    await db.from("saas_item_customers").delete().eq("item_id", id).eq("company_id", company.id);
    for (const name of names) {
      await db.from("saas_customers").upsert(
        { company_id: company.id, name },
        { onConflict: "company_id,name", ignoreDuplicates: true },
      );
      const { data: cust } = await db.from("saas_customers").select("id")
        .eq("company_id", company.id).eq("name", name).maybeSingle();
      if (cust) {
        await db.from("saas_item_customers").insert({
          item_id: id, customer_id: (cust as { id: string }).id, company_id: company.id,
        });
      }
    }
  }
  {
    const { data: t } = await db.from("saas_compliance_items").select("title").eq("id", id).eq("company_id", company.id).maybeSingle();
    const actor = actorName(user);
    void logEvent({ companyId: company.id, kind: "edited", actor,
      message: `${(t as { title: string } | null)?.title ?? "Item"} edited${actor ? ` by ${actor}` : ""}` });
  }
  if (redirectPath) revalidatePath(redirectPath);
}
export async function deleteComplianceItem(fd: FormData) {
  const { company, user } = await requireBillableCompany();
  assertCan(company, "delete_record");
  const id = str(fd, "id");
  const redirectPath = str(fd, "redirect_path");
  const db = await saasDb();
  const { data: t } = await db.from("saas_compliance_items").select("title").eq("id", id).eq("company_id", company.id).maybeSingle();
  await db.from("saas_compliance_items").delete().eq("id", id).eq("company_id", company.id);
  {
    const actor = actorName(user);
    void logEvent({ companyId: company.id, kind: "deleted", actor,
      message: `${(t as { title: string } | null)?.title ?? "Item"} deleted${actor ? ` by ${actor}` : ""}` });
  }
  if (redirectPath) revalidatePath(redirectPath);
}
