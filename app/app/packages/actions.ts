"use server";

import { revalidatePath, refresh as refreshRouter } from "next/cache";
import { redirect } from "next/navigation";
import { requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { kitLinesFrom } from "@/lib/saas/loadout-lines";

/**
 * Packages (a list for a kind of job, like "Standard Coil Package") and
 * truck kits (what one truck always leaves with). A manager keeps them; the
 * database refuses anyone else. Each change is logged with a name.
 */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const qtyOf = (v: string) => Math.min(99, Math.max(1, Math.floor(Number(v)) || 1));
const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";

async function manager() {
  const got = await requireBillableCompany();
  assertCan(got.company, "edit_records");
  return { ...got, db: await saasDb() };
}

function refresh(pkg: { id: string; unit_id: string | null }) {
  revalidatePath("/app/packages");
  revalidatePath(`/app/packages/${pkg.id}`);
  if (pkg.unit_id) revalidatePath(`/app/units/${pkg.unit_id}/kit`);
  // Redraw the page the manager is on, so the change shows right away.
  refreshRouter();
}

/** The package or kit a line belongs to, if it's this company's. */
async function ownPackage(db: Awaited<ReturnType<typeof saasDb>>, companyId: string, id: string) {
  const { data } = await db.from("saas_packages").select("id, name, unit_id").eq("id", id).eq("company_id", companyId).maybeSingle();
  return data as { id: string; name: string; unit_id: string | null } | null;
}

/** A truck's kit, made the first time someone adds to it. */
async function kitFor(db: Awaited<ReturnType<typeof saasDb>>, companyId: string, unitId: string, actor: string) {
  const { data: existing } = await db.from("saas_packages").select("id, name, unit_id").eq("company_id", companyId).eq("unit_id", unitId).maybeSingle();
  if (existing) return existing as { id: string; name: string; unit_id: string | null };
  const { data: unit } = await db.from("saas_units").select("name").eq("id", unitId).eq("company_id", companyId).maybeSingle();
  if (!unit) return null;
  const { data: made, error } = await db.from("saas_packages")
    .insert({ company_id: companyId, unit_id: unitId, name: `${(unit as { name: string }).name} kit`, created_by: actor })
    .select("id, name, unit_id").single();
  if (error) throw new Error(error.message);
  return made as { id: string; name: string; unit_id: string | null };
}

export async function createPackage(fd: FormData) {
  const { company, user, db } = await manager();
  const name = str(fd, "name").slice(0, 80);
  if (!name) return;
  const { data, error } = await db.from("saas_packages")
    .insert({ company_id: company.id, name, created_by: actorOf(user) }).select("id").single();
  if (error) throw new Error(error.message);
  void logEvent({ companyId: company.id, kind: "package_changed", actor: actorOf(user), message: `Package made: ${name}` });
  revalidatePath("/app/packages");
  redirect(`/app/packages/${(data as { id: string }).id}`);
}

export async function renamePackage(fd: FormData) {
  const { company, db } = await manager();
  const pkg = await ownPackage(db, company.id, str(fd, "package_id"));
  const name = str(fd, "name").slice(0, 80);
  if (!pkg || !name || pkg.unit_id) return;
  await db.from("saas_packages").update({ name, updated_at: new Date().toISOString() }).eq("id", pkg.id);
  refresh(pkg);
}

export async function deletePackage(fd: FormData) {
  const { company, user, db } = await manager();
  const pkg = await ownPackage(db, company.id, str(fd, "package_id"));
  if (!pkg) return;
  await db.from("saas_packages").delete().eq("id", pkg.id);
  void logEvent({ companyId: company.id, kind: "package_changed", unitId: pkg.unit_id, actor: actorOf(user), message: `${pkg.unit_id ? "Kit" : "Package"} deleted: ${pkg.name}` });
  refresh(pkg);
  redirect(pkg.unit_id ? `/app/units/${pkg.unit_id}/kit` : "/app/packages");
}

/** Add a line to a package, or to a truck's kit (made on first use). */
export async function addLine(fd: FormData) {
  const { company, user, db } = await manager();
  const label = str(fd, "label").slice(0, 80);
  if (!label) return;
  const unitId = str(fd, "unit_id");
  const pkg = unitId ? await kitFor(db, company.id, unitId, actorOf(user)) : await ownPackage(db, company.id, str(fd, "package_id"));
  if (!pkg) return;
  const { data: last } = await db.from("saas_package_lines").select("sort").eq("package_id", pkg.id).order("sort", { ascending: false }).limit(1).maybeSingle();
  const qty = qtyOf(str(fd, "qty"));
  const { error } = await db.from("saas_package_lines").insert({
    package_id: pkg.id, company_id: company.id, label, qty, sort: ((last as { sort: number } | null)?.sort ?? 0) + 1,
  });
  if (error) throw new Error(error.message);
  void logEvent({ companyId: company.id, kind: "package_changed", unitId: pkg.unit_id, actor: actorOf(user), message: `${pkg.name}: added ${label} (${qty})` });
  refresh(pkg);
}

export async function setLineQty(fd: FormData) {
  const { company, db } = await manager();
  const { data: line } = await db.from("saas_package_lines").select("id, package_id").eq("id", str(fd, "line_id")).eq("company_id", company.id).maybeSingle();
  if (!line) return;
  const pkg = await ownPackage(db, company.id, (line as { package_id: string }).package_id);
  if (!pkg) return;
  await db.from("saas_package_lines").update({ qty: qtyOf(str(fd, "qty")) }).eq("id", (line as { id: string }).id);
  refresh(pkg);
}

export async function removeLine(fd: FormData) {
  const { company, user, db } = await manager();
  const { data: line } = await db.from("saas_package_lines").select("id, package_id, label").eq("id", str(fd, "line_id")).eq("company_id", company.id).maybeSingle();
  if (!line) return;
  const l = line as { id: string; package_id: string; label: string };
  const pkg = await ownPackage(db, company.id, l.package_id);
  if (!pkg) return;
  await db.from("saas_package_lines").delete().eq("id", l.id);
  void logEvent({ companyId: company.id, kind: "package_changed", unitId: pkg.unit_id, actor: actorOf(user), message: `${pkg.name}: took off ${l.label}` });
  refresh(pkg);
}

/** Start a truck's kit from what's logged on it now: one line per kind of piece, with how many. */
export async function kitFromTruck(fd: FormData) {
  const { company, user, db } = await manager();
  const unitId = str(fd, "unit_id");
  const pkg = await kitFor(db, company.id, unitId, actorOf(user));
  if (!pkg) return;
  const { data: assets } = await db.from("saas_assets").select("name").eq("company_id", company.id).eq("unit_id", unitId).neq("status", "retired").order("name");
  const lines = kitLinesFrom(((assets ?? []) as { name: string }[]).map((a) => a.name));
  await db.from("saas_package_lines").delete().eq("package_id", pkg.id);
  if (lines.length) {
    await db.from("saas_package_lines").insert(lines.map((l, i) => ({ package_id: pkg.id, company_id: company.id, label: l.label, qty: l.qty, sort: i + 1 })));
  }
  void logEvent({ companyId: company.id, kind: "package_changed", unitId, actor: actorOf(user), message: `${pkg.name} set from what's on the truck (${lines.length} lines)` });
  refresh(pkg);
}

/** Setup in one tap: every truck without a kit gets one made from what's logged on it. Kits already set are left alone. */
export async function fillEmptyKits() {
  const { company, user, db } = await manager();
  const actor = actorOf(user);
  const [{ data: units }, { data: kits }, { data: assets }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("company_id", company.id),
    db.from("saas_packages").select("id, unit_id, saas_package_lines(id)").eq("company_id", company.id).not("unit_id", "is", null),
    db.from("saas_assets").select("name, unit_id").eq("company_id", company.id).not("unit_id", "is", null).neq("status", "retired"),
  ]);
  const hasLines = new Set(((kits ?? []) as { unit_id: string; saas_package_lines: { id: string }[] | null }[])
    .filter((k) => (k.saas_package_lines ?? []).length > 0).map((k) => k.unit_id));
  const namesOn = new Map<string, string[]>();
  for (const a of (assets ?? []) as { name: string; unit_id: string }[]) namesOn.set(a.unit_id, [...(namesOn.get(a.unit_id) ?? []), a.name]);
  let made = 0;
  for (const u of (units ?? []) as { id: string; name: string }[]) {
    if (hasLines.has(u.id) || !(namesOn.get(u.id) ?? []).length) continue;
    const pkg = await kitFor(db, company.id, u.id, actor);
    if (!pkg) continue;
    const lines = kitLinesFrom(namesOn.get(u.id)!);
    await db.from("saas_package_lines").insert(lines.map((l, i) => ({ package_id: pkg.id, company_id: company.id, label: l.label, qty: l.qty, sort: i + 1 })));
    made++;
  }
  if (made) void logEvent({ companyId: company.id, kind: "package_changed", actor, message: `${made} truck ${made === 1 ? "kit" : "kits"} made from what's on the trucks` });
  revalidatePath("/app/packages");
  refreshRouter();
}

