"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { requireCompany, requireWritableCompany } from "@/lib/saas/auth";
import { saasAdmin, saasDb } from "@/lib/saas/db";
import { removeJobPhotos, removePhotos } from "@/lib/saas/job-photos";
import { newShareToken } from "@/lib/saas/job-share";
import { buildLines, clampQty, matchList, MAX_LINES, type Callout, type JobDetails, type Phase } from "@/lib/saas/jobs";

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
const CLOSED = "This job was closed out. A manager can open it back up.";
const isClosed = (e: { message?: string } | null | undefined) => /JOB_CLOSED/.test(e?.message ?? "");

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
  // The shop's own list for this kind of job: the one the screen showed, or
  // the one with the same name. Same lists, same order, same rule as the
  // screen, so what it said it would use is what gets used.
  const { data: listRows } = await db.from("saas_packages").select("id, name").eq("company_id", company.id).is("unit_id", null).order("name").limit(200);
  const lists = (listRows ?? []) as { id: string; name: string }[];
  const list = (isId(input.listId) ? lists.find((l) => l.id === input.listId) : null) ?? matchList(lists, jobType);
  const { data: lineRows } = list
    ? await db.from("saas_package_lines").select("label, qty, critical, phase, sort").eq("company_id", company.id).eq("package_id", list.id).order("sort").limit(MAX_LINES)
    : { data: [] };

  const { data: job, error } = await db.from("synnr_jobs").insert({
    company_id: company.id, job_type: jobType, truck: clip(input.truck, 40) || null,
    remarks: clip(input.remarks, 2000) || null, details: cleanDetails(input.details),
    source: input.source === "photo" ? "photo" : "typed", created_by: user.id, created_by_name: nameOf(user),
  }).select("id").single();
  if (error || !job) return fail("Couldn't start the job. Try again.");
  const id = (job as { id: string }).id;

  const lines = buildLines({ list: (lineRows ?? []) as { label: string; qty: number; critical: boolean; phase: Phase }[], callouts }).slice(0, MAX_LINES);
  if (lines.length) {
    const { error: lineErr } = await db.from("synnr_job_lines").insert(lines.map((l) => ({ ...l, job_id: id, company_id: company.id })));
    // The job still opens; the hand sees an empty list and can add to it.
    if (lineErr) console.error("[jobs] lines:", lineErr.message);
  }
  revalidatePath("/app");
  return { ok: true, id };
}

/**
 * Tap a piece on, or back off. A critical piece only goes on with its photo
 * (the photo route does that), so here it can only come off. Off throws its
 * photo away and takes a READY job back to loading (the database does that).
 */
export async function setLine(lineId: string, on: boolean): Promise<{ ok: true; on_at: string | null; on_by: string | null } | Fail> {
  if (!isId(lineId)) return fail("That line isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  const db = await saasDb();
  const { data: before } = await db.from("synnr_job_lines").select("critical, photo_path").eq("id", lineId).eq("company_id", got.company.id).maybeSingle();
  const was = before as { critical: boolean; photo_path: string | null } | null;
  if (!was) return fail("That line isn't there anymore.");
  if (on && was.critical) return fail("That one's critical. Take its photo to put it on.");
  const patch = on ? { on_at: new Date().toISOString(), on_by: nameOf(got.user) } : { on_at: null, on_by: null };
  const { data, error } = await db.from("synnr_job_lines").update(patch).eq("id", lineId).eq("company_id", got.company.id).select("job_id, on_at, on_by").maybeSingle();
  if (isClosed(error)) return fail(CLOSED);
  if (error || !data) return fail(/NEEDS_PHOTO/.test(error?.message ?? "") ? "That one's critical. Take its photo to put it on." : "That didn't save. Try again.");
  if (!on) await removePhotos(saasAdmin(), [was.photo_path]);
  const row = data as { job_id: string; on_at: string | null; on_by: string | null };
  revalidatePath(`/app/jobs/${row.job_id}`);
  revalidatePath("/app");
  return { ok: true, on_at: row.on_at, on_by: row.on_by };
}

/** Something this job needs that wasn't on the list: a piece to load, or a check to prove after the job. */
export async function addLine(jobId: string, input: { label: string; qty: number; critical: boolean; phase?: Phase }): Promise<{ ok: true; id: string; sort: number } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  const label = clip(input.label, 120);
  if (!label) return fail("Say what it is.");
  const db = await saasDb();
  // Every screen reads this many lines. One more would be a piece nobody can see, holding the truck back.
  const { count } = await db.from("synnr_job_lines").select("id", { count: "exact", head: true }).eq("job_id", jobId).eq("company_id", got.company.id);
  if ((count ?? 0) >= MAX_LINES) return fail(`This job's list is full at ${MAX_LINES} lines. Take one off to add another.`);
  const { data: last } = await db.from("synnr_job_lines").select("sort").eq("job_id", jobId).eq("company_id", got.company.id).order("sort", { ascending: false }).limit(1).maybeSingle();
  const sort = ((last as { sort: number } | null)?.sort ?? -1) + 1;
  const { data, error } = await db.from("synnr_job_lines").insert({
    job_id: jobId, company_id: got.company.id, label, source: "added", sort,
    // A check after the job is one thing, and always takes its photo.
    ...(input.phase === "after" ? { phase: "after", qty: 1, critical: true } : { phase: "load", qty: clampQty(input.qty), critical: Boolean(input.critical) }),
  }).select("id").single();
  if (isClosed(error)) return fail(CLOSED);
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
  const { data, error } = await db.from("synnr_job_lines").delete().eq("id", lineId).eq("company_id", got.company.id).select("job_id, photo_path, back_photo_path").maybeSingle();
  if (error || !data) return fail("Couldn't take it off. Try again.");
  const gone = data as { photo_path: string | null; back_photo_path: string | null };
  await removePhotos(saasAdmin(), [gone.photo_path, gone.back_photo_path]);
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
  if (isClosed(error)) return fail(CLOSED);
  if (error) return fail(/NOT_READY/.test(error.message) ? "Not ready: something on the list is still off the truck." : "That didn't save. Try again.");
  if (!data) return fail("That job isn't there anymore.");
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true, ready_at: (data as { ready_at: string }).ready_at, ready_by };
}

/**
 * The manager's call. Three things only a manager decides about a job: a
 * photo isn't good enough, the job is over, or it was typed in wrong. Each
 * one is stamped by the database (its own clock, the manager's own name),
 * and none of them erases what was there before.
 */

/** What comes back when a photo is sent back: what the line now says about it. */
export type SentBack = { back_at: string; back_by: string | null; back_why: string; back_photo_path: string | null; back_from: string | null; back_from_at: string | null };

/**
 * Send a photo back: it isn't good enough, and here's why. The piece reads
 * as off again (the check as owed), and the line keeps the reason, who sent
 * it back, and the photo that was sent back with who took it.
 */
export async function sendBack(lineId: string, why: string): Promise<({ ok: true } & SentBack) | Fail> {
  if (!isId(lineId)) return fail("That line isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can send a photo back.");
  const reason = clip(why, 200);
  if (!reason) return fail("Say what's wrong with it.");
  const db = await saasDb();
  const { data: before } = await db.from("synnr_job_lines").select("job_id, on_at, photo_path, back_photo_path").eq("id", lineId).eq("company_id", got.company.id).maybeSingle();
  const was = before as { job_id: string; on_at: string | null; photo_path: string | null; back_photo_path: string | null } | null;
  if (!was) return fail("That line isn't there anymore.");
  if (!was.on_at || !was.photo_path) return fail("There's no photo on that one to send back.");
  // Only the photo he looked at: if the crew retook it a moment ago, he hasn't seen the new one.
  const { data, error } = await db.from("synnr_job_lines").update({ back_at: new Date().toISOString(), back_why: reason })
    .eq("id", lineId).eq("company_id", got.company.id).eq("photo_path", was.photo_path)
    .select("back_at, back_by, back_why, back_photo_path, back_from, back_from_at").maybeSingle();
  if (isClosed(error)) return fail(CLOSED);
  if (error) { console.error("[jobs] send back:", error.message); return fail("That didn't save. Try again."); }
  if (!data) return fail("That photo was just taken again. Look at the new one.");
  const row = data as SentBack;
  // One sent-back photo is kept per line: the one before it can go.
  if (was.back_photo_path && was.back_photo_path !== row.back_photo_path) await removePhotos(saasAdmin(), [was.back_photo_path]);
  revalidatePath(`/app/jobs/${was.job_id}`);
  revalidatePath("/app");
  return { ok: true, ...row };
}

/**
 * Close a job out: the customer cancelled, it was started by mistake, the
 * truck never went. It owes nothing after that, on the board or in the
 * morning email, and nothing on it changes until a manager opens it back
 * up. The list, the photos, and who did what all stay.
 */
export async function closeJob(jobId: string, why: string): Promise<{ ok: true; closed_at: string; closed_by: string | null; closed_why: string } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can close a job out.");
  const reason = clip(why, 200);
  if (!reason) return fail("Say why it's being closed out.");
  const db = await saasDb();
  const { data, error } = await db.from("synnr_jobs").update({ closed_at: new Date().toISOString(), closed_why: reason })
    .eq("id", jobId).eq("company_id", got.company.id).is("closed_at", null).select("closed_at, closed_by, closed_why").maybeSingle();
  if (error) { console.error("[jobs] close:", error.message); return fail("That didn't save. Try again."); }
  if (!data) return fail("That job is already closed out, or it isn't there anymore.");
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true, ...(data as { closed_at: string; closed_by: string | null; closed_why: string }) };
}

/** Open a closed job back up. Whatever it owed, it owes again. */
export async function reopenJob(jobId: string): Promise<{ ok: true } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can open a job back up.");
  const db = await saasDb();
  const { data, error } = await db.from("synnr_jobs").update({ closed_at: null }).eq("id", jobId).eq("company_id", got.company.id).select("id").maybeSingle();
  if (error || !data) return fail("That didn't save. Try again.");
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Correct the unit or the kind of job: someone typed the wrong one. The
 * list stays as it is. What the job said before stays on the record, with
 * who changed it and when (the database keeps that).
 */
export async function fixJob(jobId: string, input: { truck: string; jobType: string }): Promise<{ ok: true } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  if (got.company.role === "member") return fail("Only a manager can change what a job is.");
  const jobType = clip(input.jobType, 80);
  if (!jobType) return fail("Say what kind of job it is.");
  const db = await saasDb();
  const { data, error } = await db.from("synnr_jobs").update({ truck: clip(input.truck, 40) || null, job_type: jobType })
    .eq("id", jobId).eq("company_id", got.company.id).select("id").maybeSingle();
  if (error || !data) return fail("That didn't save. Try again.");
  revalidatePath(`/app/jobs/${jobId}`);
  revalidatePath("/app");
  return { ok: true };
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
  await removeJobPhotos(saasAdmin(), got.company.id, jobId);
  revalidatePath("/app");
  return { ok: true };
}

/**
 * The link a crew sends the customer: this job's list and its photos, no
 * login. Anyone on the crew can make it, and it's the same link every time
 * until a manager turns it off. Only the server writes it (the database
 * refuses anyone else), so a link can't be typed in or guessed.
 */
export async function shareJob(jobId: string): Promise<{ ok: true; token: string } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireWritableCompany();
  if (!got.ok) return fail(got.error);
  // The demo is open to anyone: no public pages come out of it.
  if (got.company.is_demo) return fail("Links to send a customer are off in the demo company.");
  // Read as the signed-in person: the database decides whether this job is theirs.
  const db = await saasDb();
  const mine = () => db.from("synnr_jobs").select("id, share_token").eq("id", jobId).eq("company_id", got.company.id).maybeSingle();
  const { data: found } = await mine();
  const job = found as { id: string; share_token: string | null } | null;
  if (!job) return fail("That job isn't there anymore.");
  if (job.share_token) return { ok: true, token: job.share_token };

  const admin = saasAdmin();
  if (!admin) return fail("Links aren't set up. Call or text 432-250-0715.");
  const token = newShareToken();
  const { data, error } = await admin.from("synnr_jobs").update({ share_token: token, shared_by: nameOf(got.user) })
    .eq("id", jobId).eq("company_id", got.company.id).is("share_token", null).select("share_token").maybeSingle();
  if (error) { console.error("[share] make:", error.message); return fail("Couldn't make the link. Try again."); }
  revalidatePath(`/app/jobs/${jobId}`);
  if (data) return { ok: true, token };
  // Someone else on the crew made it a moment ago: theirs is the link.
  const { data: again } = await mine();
  const theirs = (again as { share_token: string | null } | null)?.share_token;
  return theirs ? { ok: true, token: theirs } : fail("Couldn't make the link. Try again.");
}

/**
 * Turn a job's link off. Whoever has it can't open it anymore. Managers
 * only, and it works on a paused account too: closing a door is never
 * something to pay for.
 */
export async function unshareJob(jobId: string): Promise<{ ok: true } | Fail> {
  if (!isId(jobId)) return fail("That job isn't there anymore.");
  const got = await requireCompany();
  if (got.company.role === "member") return fail("Only a manager can turn a link off.");
  const db = await saasDb();
  const { data: found } = await db.from("synnr_jobs").select("id").eq("id", jobId).eq("company_id", got.company.id).maybeSingle();
  if (!found) return fail("That job isn't there anymore.");
  const admin = saasAdmin();
  if (!admin) return fail("Links aren't set up. Call or text 432-250-0715.");
  const { error } = await admin.from("synnr_jobs").update({ share_token: null }).eq("id", jobId).eq("company_id", got.company.id);
  if (error) { console.error("[share] off:", error.message); return fail("Couldn't turn it off. Try again."); }
  revalidatePath(`/app/jobs/${jobId}`);
  return { ok: true };
}
