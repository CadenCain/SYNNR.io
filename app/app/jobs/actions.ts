"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { requireWritableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { buildLines, clampQty, matchList, type Callout, type JobDetails } from "@/lib/saas/jobs";

/**
 * What a crew does to a job: start one, tap pieces on and off, add a piece
 * that isn't on the list, and call it ready. Everything runs as the signed-in
 * person, so the database's own rules decide what they may touch, and it is
 * the database that refuses READY while anything is still off the truck.
 */

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

const nameOf = (u: User) => (u.user_metadata?.full_name as string | undefined)?.trim() || u.email?.split("@")[0] || "Someone";
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

/** Job facts only, short, and only the ones SYNNR knows about. */
function cleanDetails(d: JobDetails | null | undefined): JobDetails {
  const s = (v: unknown) => clip(v, 160) || null;
  return {
    client: s(d?.client), well: s(d?.well), start: s(d?.start), tubing: s(d?.tubing), casing: s(d?.casing),
    wellhead: s(d?.wellhead), pressure_control: s(d?.pressure_control),
    assets: (Array.isArray(d?.assets) ? d!.assets! : []).map((a) => clip(a, 160)).filter(Boolean).slice(0, 10),
  };
}

export async function createJob(input: {
  jobType: string; truck: string; remarks: string; details?: JobDetails | null; callouts?: Callout[]; source: "photo" | "typed"; listId?: string | null;
}): Promise<{ ok: true; id: string } | Fail> {
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  const { company, user } = got;
  const jobType = clip(input.jobType, 80);
  if (!jobType) return fail("Say what kind of job it is.");
  const callouts = (Array.isArray(input.callouts) ? input.callouts : []).slice(0, 20)
    .map((c) => ({ item: clip(c?.item, 120), qty: clampQty(c?.qty), why: clip(c?.why, 300) })).filter((c) => c.item);

  const db = await saasDb();
  // The shop's own list for this kind of job: the one picked, or the one with the same name.
  const { data: listRows } = await db.from("saas_packages").select("id, name").eq("company_id", company.id).is("unit_id", null).limit(200);
  const lists = (listRows ?? []) as { id: string; name: string }[];
  const list = (isId(input.listId) ? lists.find((l) => l.id === input.listId) : null) ?? matchList(lists, jobType);
  const { data: lineRows } = list
    ? await db.from("saas_package_lines").select("label, qty, critical, sort").eq("company_id", company.id).eq("package_id", list.id).order("sort").limit(300)
    : { data: [] };

  const { data: job, error } = await db.from("synnr_jobs").insert({
    company_id: company.id, job_type: jobType, truck: clip(input.truck, 40) || null,
    remarks: clip(input.remarks, 2000) || null, details: cleanDetails(input.details),
    source: input.source === "photo" ? "photo" : "typed", created_by: user.id, created_by_name: nameOf(user),
  }).select("id").single();
  if (error || !job) return fail("Couldn't start the job. Try again.");
  const id = (job as { id: string }).id;

  const lines = buildLines({ list: (lineRows ?? []) as { label: string; qty: number; critical: boolean }[], callouts });
  if (lines.length) {
    const { error: lineErr } = await db.from("synnr_job_lines").insert(lines.map((l) => ({ ...l, job_id: id, company_id: company.id })));
    // The job still opens; the hand sees an empty list and can add to it.
    if (lineErr) console.error("[jobs] lines:", lineErr.message);
  }
  revalidatePath("/app");
  return { ok: true, id };
}

/** Tap a piece on, or back off. Off takes a READY job back to loading (the database does that). */
export async function setLine(lineId: string, on: boolean): Promise<{ ok: true; on_at: string | null; on_by: string | null } | Fail> {
  if (!isId(lineId)) return fail("That line isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  const db = await saasDb();
  const patch = on ? { on_at: new Date().toISOString(), on_by: nameOf(got.user) } : { on_at: null, on_by: null };
  const { data, error } = await db.from("synnr_job_lines").update(patch).eq("id", lineId).eq("company_id", got.company.id).select("job_id, on_at, on_by").maybeSingle();
  if (error || !data) return fail("That didn't save. Try again.");
  const row = data as { job_id: string; on_at: string | null; on_by: string | null };
  revalidatePath(`/app/jobs/${row.job_id}`);
  revalidatePath("/app");
  return { ok: true, on_at: row.on_at, on_by: row.on_by };
}

/** Something this job needs that wasn't on the list. */
export async function addLine(jobId: string, input: { label: string; qty: number; critical: boolean }): Promise<{ ok: true; id: string; sort: number } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  const label = clip(input.label, 120);
  if (!label) return fail("Say what it is.");
  const db = await saasDb();
  const { data: last } = await db.from("synnr_job_lines").select("sort").eq("job_id", jobId).eq("company_id", got.company.id).order("sort", { ascending: false }).limit(1).maybeSingle();
  const sort = ((last as { sort: number } | null)?.sort ?? -1) + 1;
  const { data, error } = await db.from("synnr_job_lines").insert({
    job_id: jobId, company_id: got.company.id, label, qty: clampQty(input.qty), critical: Boolean(input.critical), source: "added", sort,
  }).select("id").single();
  if (error || !data) return fail("Couldn't add it. Try again.");
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true, id: (data as { id: string }).id, sort };
}

/** Take a line off the list. A manager's call: a hand who thinks a line is wrong leaves it untapped and says so. */
export async function removeLine(lineId: string): Promise<{ ok: true } | Fail> {
  if (!isId(lineId)) return fail("That line isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can take a line off the list.");
  const db = await saasDb();
  const { data, error } = await db.from("synnr_job_lines").delete().eq("id", lineId).eq("company_id", got.company.id).select("job_id").maybeSingle();
  if (error || !data) return fail("Couldn't take it off. Try again.");
  revalidatePath(`/app/jobs/${(data as { job_id: string }).job_id}`);
  revalidatePath("/app");
  return { ok: true };
}

/** Call the truck ready. Only goes through when every piece on the list is on. */
export async function markReady(jobId: string): Promise<{ ok: true; ready_at: string; ready_by: string } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  const db = await saasDb();
  const ready_by = nameOf(got.user);
  const { data, error } = await db.from("synnr_jobs").update({ status: "ready", ready_by }).eq("id", jobId).eq("company_id", got.company.id).select("ready_at").maybeSingle();
  if (error) return fail(/NOT_READY/.test(error.message) ? "Not ready: something on the list is still off the truck." : "That didn't save. Try again.");
  if (!data) return fail("That job isn't there anymore.");
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true, ready_at: (data as { ready_at: string }).ready_at, ready_by };
}

/** Delete a job that was started by mistake. Managers only (the database enforces it too). */
export async function deleteJob(jobId: string): Promise<{ ok: true } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can delete a job.");
  const db = await saasDb();
  const { data, error } = await db.from("synnr_jobs").delete().eq("id", jobId).eq("company_id", got.company.id).select("id").maybeSingle();
  if (error || !data) return fail("Couldn't delete it. Try again.");
  revalidatePath("/app");
  return { ok: true };
}
