"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany, requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { judgeItem, isNoPaper } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { TESTED_CATEGORIES } from "@/lib/saas/taxonomy";
import { YARD_TZ } from "@/lib/saas/format";

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";
const label = (a: { name: string; identifier: string | null }) => `${a.name}${a.identifier ? ` ${a.identifier}` : ""}`;
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

function refresh() {
  revalidatePath("/app/signout");
  revalidatePath("/app");
  revalidatePath("/app/equipment");
  revalidatePath("/app/return");
}

/**
 * Sign tools out to yourself, not a truck: the sign-out sheet, with a name
 * and a time on every line and no way to take something that isn't fit to
 * go. Red-tagged, missing, waiting on redress, out of test, no paper, or
 * already out: nothing gets signed out, and the phone says which and why.
 * It stays out with you until it's checked back in.
 */
export async function signOutTools(input: { assetIds: string[]; note?: string; to?: string }): Promise<{ ok: boolean; error?: string; refused?: { name: string; why: string }[]; summary?: string }> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Try again in a minute." };
  // Who it goes out to: yourself, or (a manager at the counter) someone on the crew.
  let toId = user.id, toName = actor;
  if (input.to && input.to !== user.id) {
    if (company.role !== "owner" && company.role !== "admin") return { ok: false, error: "Only a manager can sign a tool out to someone else." };
    const { data: m } = await admin.from("saas_memberships").select("user_id").eq("company_id", company.id).eq("user_id", input.to).eq("status", "active").maybeSingle();
    if (!m) return { ok: false, error: "That person isn't on the crew." };
    const { data: who } = await admin.auth.admin.getUserById(input.to);
    toId = input.to;
    toName = (who?.user?.user_metadata?.full_name as string | undefined)?.trim() || who?.user?.email?.split("@")[0] || "someone";
  }
  const ids = [...new Set((input.assetIds ?? []).filter((x) => typeof x === "string"))].slice(0, 40);
  if (!ids.length) return { ok: false, error: "Pick what you're taking." };
  const note = String(input.note ?? "").trim().slice(0, 120) || null;

  const [{ data: assetRows }, { data: itemRows }] = await Promise.all([
    db.from("saas_assets").select("id, name, identifier, category, status, unit_id, out_since, out_with_name, needs_redress_since")
      .eq("company_id", company.id).in("id", ids),
    db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until, last_upload_id")
      .eq("company_id", company.id).eq("parent_type", "asset").in("parent_id", ids),
  ]);
  type A = { id: string; name: string; identifier: string | null; category: string; status: string; unit_id: string | null; out_since: string | null; out_with_name: string | null; needs_redress_since: string | null };
  type Item = { id: string; title: string; parent_id: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null };
  const assets = (assetRows ?? []) as A[];
  if (assets.length !== ids.length) return { ok: false, error: "One of those isn't in your account anymore. Reload and pick again." };
  const items = (itemRows ?? []) as Item[];
  const today = localToday();

  const refused: { name: string; why: string }[] = [];
  for (const a of assets) {
    const why = a.status === "retired" ? "Retired"
      : a.status === "out_of_service" ? "Red-tagged"
      : a.status === "missing" ? "Flagged missing"
      : a.needs_redress_since ? "Needs redress"
      : a.out_with_name ? `Already out with ${a.out_with_name}`
      : a.out_since ? "Out on a job, not checked back in"
      : null;
    if (why) { refused.push({ name: label(a), why }); continue; }
    const mine = items.filter((it) => it.parent_id === a.id);
    if (!mine.length && TESTED_CATEGORIES.has(a.category)) { refused.push({ name: label(a), why: "No test on file" }); continue; }
    for (const it of mine) {
      const j = judgeItem(it, today, today);
      if (j.result === "expired") { refused.push({ name: label(a), why: `Out of test: ${it.title}` }); break; }
      if (isNoPaper(j)) { refused.push({ name: label(a), why: `No paper: ${it.title}` }); break; }
      if (j.result === "missing") { refused.push({ name: label(a), why: `No test date: ${it.title}` }); break; }
    }
  }
  if (refused.length) return { ok: false, refused, error: "Nothing was signed out. Leave these behind or get them fixed first." };

  const now = new Date().toISOString();
  // Only what's still free right now: two hands tapping the same tool at
  // the same moment can't both walk off with it on paper.
  const { data: took, error } = await admin.from("saas_assets").update({
    out_since: now, out_with_user: toId, out_with_name: toName, out_loadout_id: null, out_alerted_at: null,
    unit_id: null, last_seen_where: `signed out to ${toName} ${dayLabel(now)}${note ? ` (${note})` : ""}`, last_seen_by: actor, last_seen_at: now,
  }).eq("company_id", company.id).in("id", ids).is("out_since", null).is("needs_redress_since", null).select("id");
  if (error) return { ok: false, error: `Couldn't sign it out: ${error.message}` };
  const gotIds = new Set(((took ?? []) as { id: string }[]).map((r) => r.id));
  const missed = assets.filter((a) => !gotIds.has(a.id));
  const got = assets.filter((a) => gotIds.has(a.id));
  if (!got.length) return { ok: false, error: "Someone else just signed that out. Reload to see who has it." };
  await admin.from("saas_signouts").insert(got.map((a) => ({
    company_id: company.id, asset_id: a.id, asset_name: a.name, serial: a.identifier,
    out_user: toId, out_name: toName, job_note: note, out_at: now,
  })));
  const summary = toId === user.id
    ? `${actor} signed out ${got.map(label).join(", ")}${note ? ` for ${note}` : ""}`
    : `${actor} signed out ${got.map(label).join(", ")} to ${toName}${note ? ` for ${note}` : ""}`;
  void logEvent({ companyId: company.id, kind: "signed_out", actor, message: summary });
  refresh();
  if (missed.length) return { ok: true, summary, refused: missed.map((a) => ({ name: label(a), why: "Someone else just signed it out" })) };
  return { ok: true, summary };
}

/** Redressed and ready to run again. Anyone on the crew can, with their name on it. */
export async function markRedressed(fd: FormData) {
  const { company, user } = await requireBillableCompany();
  const admin = saasAdmin();
  const id = String(fd.get("asset_id") ?? "");
  if (!admin || !id) return;
  const { data } = await admin.from("saas_assets").select("id, name, identifier, unit_id, needs_redress_since")
    .eq("company_id", company.id).eq("id", id).maybeSingle();
  const a = data as { id: string; name: string; identifier: string | null; unit_id: string | null; needs_redress_since: string | null } | null;
  if (!a?.needs_redress_since) return;
  const actor = actorOf(user);
  const now = new Date().toISOString();
  await admin.from("saas_assets").update({ needs_redress_since: null, last_seen_by: actor, last_seen_at: now })
    .eq("company_id", company.id).eq("id", a.id);
  void logEvent({ companyId: company.id, kind: "redressed", unitId: a.unit_id, actor, message: `${actor} redressed ${label(a)}` });
  refresh();
  revalidatePath(`/app/assets/${a.id}`);
}

/** A manager marks a tool as one that gets redressed after every run (or not). */
export async function setRedressEachRun(fd: FormData) {
  const { company, user } = await requireCompany();
  if (company.role !== "owner" && company.role !== "admin") return;
  const id = String(fd.get("asset_id") ?? "");
  const on = String(fd.get("on") ?? "") === "1";
  const db = await saasDb();
  const { data } = await db.from("saas_assets").update({ redress_each_run: on })
    .eq("company_id", company.id).eq("id", id).select("id, name, identifier, unit_id").maybeSingle();
  const a = data as { id: string; name: string; identifier: string | null; unit_id: string | null } | null;
  if (!a) return;
  const actor = actorOf(user);
  void logEvent({ companyId: company.id, kind: "asset_edited", unitId: a.unit_id, actor,
    message: `${actor} set ${label(a)} to ${on ? "be redressed after every run" : "no redress after every run"}` });
  revalidatePath(`/app/assets/${a.id}`);
  revalidatePath("/app/signout");
}
