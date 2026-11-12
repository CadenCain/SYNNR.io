"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { clampQty } from "@/lib/saas/jobs";

/**
 * The shop's job lists: what it takes on each kind of job, and which pieces
 * stop the job if they're missing. Managers only (the database enforces it
 * too). Every new job's checklist is built from these.
 */

const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);
const nameOf = (u: User) => (u.user_metadata?.full_name as string | undefined)?.trim() || u.email?.split("@")[0] || "Someone";
const back = (id: string, err?: string) => `/app/brain/lists/${id}${err ? `?err=${encodeURIComponent(err)}` : ""}`;

async function manager() {
  const got = await requireBillableCompany();
  if (got.company.role === "member") throw new Error("Only a manager can change the job lists.");
  return { ...got, db: await saasDb() };
}

export async function createList(formData: FormData) {
  const { company, user, db } = await manager();
  const name = clip(formData.get("name"), 80);
  if (!name) redirect(`/app/brain/lists?err=${encodeURIComponent("Give the kind of job a name.")}`);
  const { data: same } = await db.from("saas_packages").select("id").eq("company_id", company.id).is("unit_id", null).ilike("name", name.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
  if (same) redirect(back((same as { id: string }).id));
  const { data, error } = await db.from("saas_packages").insert({ company_id: company.id, name, unit_id: null, created_by: nameOf(user) }).select("id").single();
  if (error || !data) redirect(`/app/brain/lists?err=${encodeURIComponent("Couldn't save it. Try again.")}`);
  revalidatePath("/app/brain");
  redirect(back((data as { id: string }).id));
}

export async function renameList(formData: FormData) {
  const { company, db } = await manager();
  const id = clip(formData.get("id"), 40);
  const name = clip(formData.get("name"), 80);
  if (!name) redirect(back(id, "Give it a name."));
  const { error } = await db.from("saas_packages").update({ name }).eq("id", id).eq("company_id", company.id).is("unit_id", null);
  if (error) redirect(back(id, "Couldn't rename it. Try again."));
  revalidatePath("/app/brain");
  redirect(back(id));
}

export async function addListLine(formData: FormData) {
  const { company, db } = await manager();
  const id = clip(formData.get("id"), 40);
  const label = clip(formData.get("label"), 120);
  // A check for after the job is one thing, and always takes a photo.
  const after = formData.get("phase") === "after";
  if (!label) redirect(back(id, after ? "Say what the crew proves." : "Say what the piece is."));
  // The list has to be one of this company's job lists, not a truck's kit.
  const { data: list } = await db.from("saas_packages").select("id").eq("id", id).eq("company_id", company.id).is("unit_id", null).maybeSingle();
  if (!list) redirect("/app/brain/lists");
  const { data: last } = await db.from("saas_package_lines").select("sort").eq("package_id", id).eq("company_id", company.id).order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from("saas_package_lines").insert({
    package_id: id, company_id: company.id, label,
    ...(after ? { phase: "after", qty: 1, critical: true } : { phase: "load", qty: clampQty(formData.get("qty")), critical: formData.get("critical") === "on" }),
    sort: ((last as { sort: number } | null)?.sort ?? -1) + 1,
  });
  if (error) redirect(back(id, "Couldn't add it. Try again."));
  revalidatePath(back(id));
  revalidatePath("/app/brain");
  redirect(back(id));
}

export async function setLineCritical(formData: FormData) {
  const { company, db } = await manager();
  const id = clip(formData.get("id"), 40);
  await db.from("saas_package_lines").update({ critical: formData.get("critical") === "1" }).eq("id", clip(formData.get("line"), 40)).eq("package_id", id).eq("company_id", company.id).eq("phase", "load");
  revalidatePath(back(id));
  redirect(back(id));
}

export async function removeListLine(formData: FormData) {
  const { company, db } = await manager();
  const id = clip(formData.get("id"), 40);
  await db.from("saas_package_lines").delete().eq("id", clip(formData.get("line"), 40)).eq("package_id", id).eq("company_id", company.id);
  revalidatePath(back(id));
  revalidatePath("/app/brain");
  redirect(back(id));
}

export async function deleteList(formData: FormData) {
  const { company, db } = await manager();
  const id = clip(formData.get("id"), 40);
  await db.from("saas_packages").delete().eq("id", id).eq("company_id", company.id).is("unit_id", null);
  revalidatePath("/app/brain");
  redirect("/app/brain/lists");
}
