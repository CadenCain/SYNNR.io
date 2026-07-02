"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { syncYardQuantity } from "@/lib/saas/billing";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

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
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const db = await saasDb();
  await db.from("saas_yards").delete().eq("id", id).eq("company_id", company.id);
  await syncYardQuantity(company.id); // per-yard billing follows the yard count
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
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const yard_id = str(fd, "yard_id");
  const db = await saasDb();
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
export async function deleteAsset(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const unit_id = str(fd, "unit_id");
  const db = await saasDb();
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
  const { company } = await requireCompany();
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

  const { data: yard, error } = await db.from("saas_yards")
    .insert({ company_id: company.id, name: SAMPLE_YARD, location: "Odessa, TX" }).select("id").single();
  if (error) throw new Error(error.message);
  const yardId = (yard as { id: string }).id;

  const { data: unit } = await db.from("saas_units")
    .insert({ company_id: company.id, yard_id: yardId, name: `Wireline 7${SAMPLE_TAG}`, type: "wireline_truck", identifier: "WL-007" })
    .select("id").single();
  const unitId = (unit as { id: string }).id;

  const { data: asset } = await db.from("saas_assets")
    .insert({ company_id: company.id, yard_id: yardId, unit_id: unitId, name: `BOP #3${SAMPLE_TAG}`, category: "pressure_control" })
    .select("id").single();
  const assetId = (asset as { id: string }).id;

  await db.from("saas_compliance_items").insert([
    { company_id: company.id, parent_type: "unit", parent_id: unitId, title: "Annual DOT inspection", kind: "inspection", issued_date: iso(-300), expiration_date: iso(65) },
    { company_id: company.id, parent_type: "unit", parent_id: unitId, title: "DOT sticker", kind: "dot_sticker", issued_date: iso(-350), expiration_date: iso(12) },
    { company_id: company.id, parent_type: "asset", parent_id: assetId, title: "BOP test", kind: "test", issued_date: iso(-190), expiration_date: iso(-4) },
  ]);

  const { data: hand1 } = await db.from("saas_crew_members")
    .insert({ company_id: company.id, name: `Jerry Boles${SAMPLE_TAG}`, role: "operator", phone: "432-555-0101" }).select("id").single();
  const { data: hand2 } = await db.from("saas_crew_members")
    .insert({ company_id: company.id, name: `Manny Ortiz${SAMPLE_TAG}`, role: "driver" }).select("id").single();
  const h1 = (hand1 as { id: string }).id, h2 = (hand2 as { id: string }).id;
  await db.from("saas_compliance_items").insert([
    { company_id: company.id, parent_type: "crew", parent_id: h1, title: "H2S Clear", kind: "cert", issued_date: iso(-360), expiration_date: iso(6) },
    { company_id: company.id, parent_type: "crew", parent_id: h2, title: "CDL", kind: "cert", issued_date: iso(-400), expiration_date: iso(500) },
  ]);
  await db.from("saas_unit_crew").insert([
    { company_id: company.id, unit_id: unitId, crew_member_id: h1 },
    { company_id: company.id, unit_id: unitId, crew_member_id: h2 },
  ]);

  revalidatePath("/app");
  redirect("/app");
}

export async function clearSampleYard() {
  const { company } = await requireCompany();
  const db = await saasDb();
  // Yard cascade removes units/assets; their compliance rows + crew are cleaned by tag.
  const { data: yard } = await db.from("saas_yards").select("id").eq("company_id", company.id).eq("name", SAMPLE_YARD).maybeSingle();
  if (yard) {
    const yardId = (yard as { id: string }).id;
    const { data: units } = await db.from("saas_units").select("id").eq("yard_id", yardId);
    const unitIds = ((units ?? []) as { id: string }[]).map((x) => x.id);
    if (unitIds.length) {
      const { data: assets } = await db.from("saas_assets").select("id").in("unit_id", unitIds);
      const assetIds = ((assets ?? []) as { id: string }[]).map((x) => x.id);
      await db.from("saas_compliance_items").delete().eq("company_id", company.id).in("parent_id", [...unitIds, ...assetIds]);
    }
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
  const { company } = await requireCompany();
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
  if (redirectPath) revalidatePath(redirectPath);
}
export async function deleteComplianceItem(fd: FormData) {
  const { company } = await requireCompany();
  const id = str(fd, "id");
  const redirectPath = str(fd, "redirect_path");
  const db = await saasDb();
  await db.from("saas_compliance_items").delete().eq("id", id).eq("company_id", company.id);
  if (redirectPath) revalidatePath(redirectPath);
}
