"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { getLoadout, verdictOf, reasonsOf } from "@/lib/saas/loadout-record";
import { canStillRoll } from "@/lib/saas/dispatch-check";
import { getOpenPlan } from "@/lib/saas/plans";

/**
 * Roll a NOT READY load-out anyway. Managers only, with a reason in a full
 * sentence. It goes on its own row next to the load-out (which itself never
 * changes), shows on the record and the proof link, and emails the office.
 */
export async function rollLoadoutAnyway(fd: FormData): Promise<void> {
  const { company, user } = await requireBillableCompany();
  if (company.role !== "owner" && company.role !== "admin") throw new Error("Only a manager can roll a NOT READY truck.");
  const id = String(fd.get("loadout_id") ?? "");
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (!id) return;
  if (reason.length < 10) throw new Error("Write the reason in a full sentence. It goes on the record.");

  const db = await saasDb();
  const got = await getLoadout(db, { id, companyId: company.id });
  if (!got) redirect("/app/loadouts");
  if (verdictOf(got.rec) !== "not_ready" || got.override) redirect(`/app/loadouts/${id}`);
  // An override covers what's on the truck now: a load-out from this shift.
  // An older one's pieces, photo and paper aren't what's loaded today.
  if (!canStillRoll(got.rec.finished_at)) redirect(`/app/loadouts/${id}?stale=1`);
  // Only the truck's newest load-out can roll, and only before it's checked
  // back in: an older one isn't what's on the truck, and a trip that's over can't start.
  const staleNow = async (q: typeof db) => {
    if (!got.rec.unit_id) return false;
    const [{ data: newer }, { data: back }] = await Promise.all([
      q.from("saas_loadout_scans").select("id").eq("company_id", company.id).eq("unit_id", got.rec.unit_id).gt("finished_at", got.rec.finished_at).limit(1).maybeSingle(),
      q.from("saas_returns").select("id").eq("company_id", company.id).eq("unit_id", got.rec.unit_id).gt("finished_at", got.rec.finished_at).limit(1).maybeSingle(),
    ]);
    return Boolean(newer || back);
  };
  if (await staleNow(db)) redirect(`/app/loadouts/${id}?stale=1`);

  const admin = saasAdmin();
  if (!admin) throw new Error("Something's down on our end. Try again in a minute.");
  const actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || "A manager";
  const { error } = await admin.from("saas_loadout_overrides").insert({
    company_id: company.id, loadout_id: id, by_name: actor, by_user: user.id, reason,
  });
  // Two taps (or two managers) at once: the first one rolled it. Don't move
  // the iron, email the office, or log it a second time.
  if (error && /duplicate key/i.test(error.message)) redirect(`/app/loadouts/${id}`);
  if (error) throw new Error(error.message);
  // A hand's newer load-out could have landed between the check above and
  // now: then this one isn't what's on the truck, and the override comes back off.
  if (await staleNow(admin as unknown as typeof db)) {
    await admin.from("saas_loadout_overrides").delete().eq("loadout_id", id).eq("company_id", company.id);
    redirect(`/app/loadouts/${id}?stale=1`);
  }

  // It rolled: what went on is out on the job from now until it's checked in.
  // A tool that was signed out to someone went on this truck: that sign-out closes.
  const ids = got.rec.pieces.map((p) => p.asset_id);
  const nowIso = new Date().toISOString();
  if (ids.length && got.rec.unit_id) {
    // Only what's still on the truck rolled. A piece taken off since (and
    // maybe signed out to someone) stays where it is now.
    const { data: rolled } = await admin.from("saas_assets").update({ out_since: nowIso, out_loadout_id: id, out_alerted_at: null, out_with_user: null, out_with_name: null })
      .eq("company_id", company.id).eq("unit_id", got.rec.unit_id).in("id", ids).select("id");
    const rolledIds = ((rolled ?? []) as { id: string }[]).map((r) => r.id);
    if (rolledIds.length) await admin.from("saas_signouts").update({ back_at: nowIso, back_by: actor, back_note: `went out on ${got.rec.unit_name} (override)` })
      .eq("company_id", company.id).in("asset_id", rolledIds).is("back_at", null);
  }

  // The truck rolled: its plan is used up (the one this load-out was checked
  // against, or a newer one made since for this load-out), so nobody's told
  // it never left. A plan for a later job stays open for that job.
  const open = got.rec.unit_id ? await getOpenPlan(db, company.id, got.rec.unit_id) : null;
  const planIds = [...new Set([got.rec.plan?.id, open?.id].filter((x): x is string => Boolean(x)))];
  if (planIds.length) {
    await admin.from("saas_loadout_plans").update({ used_at: new Date().toISOString(), used_loadout_id: id })
      .eq("company_id", company.id).in("id", planIds).is("used_at", null);
  }

  const why = reasonsOf(got.rec).slice(0, 3).join("; ");
  const message = `${got.rec.unit_name} rolled NOT READY on a manager override by ${actor}. Reason: "${reason.replace(/[.\s]+$/, "")}". Not ready because: ${why}`;
  void logEvent({ companyId: company.id, kind: "rolled_override", unitId: got.rec.unit_id, actor, message });
  void notifyEvent({ companyId: company.id, companyName: company.name, yardId: got.rec.yard_id, message, href: `/app/loadouts/${id}` });

  revalidatePath(`/app/loadouts/${id}`);
  revalidatePath("/app");
  redirect(`/app/loadouts/${id}`);
}
