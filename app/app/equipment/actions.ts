"use server";

import { revalidatePath, refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { isRecentDuplicate } from "@/lib/saas/dedupe";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { pieceProblem } from "@/lib/saas/equipment";
import { truckOut } from "@/lib/saas/whereabouts";
import { outcomeOf, type LoadoutOverride, type LoadoutRecord } from "@/lib/saas/loadout-record";
import { localToday } from "@/lib/saas/status";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

type Db = Awaited<ReturnType<typeof saasDb>>;

/**
 * "yard:<id>" or "unit:<id>" from the Where picker → the columns to write.
 * On a truck, the iron is also in that truck's yard. Null when the target
 * isn't this company's.
 */
async function resolveWhere(db: Db, companyId: string, where: string): Promise<{ yard_id: string | null; unit_id: string | null } | null> {
  const [kind, id] = where.split(":");
  if (!id) return { yard_id: null, unit_id: null };
  if (kind === "unit") {
    const { data } = await db.from("saas_units").select("id, yard_id").eq("id", id).eq("company_id", companyId).maybeSingle();
    const u = data as { id: string; yard_id: string } | null;
    return u ? { yard_id: u.yard_id, unit_id: u.id } : null;
  }
  if (kind === "yard") {
    const { data } = await db.from("saas_yards").select("id").eq("id", id).eq("company_id", companyId).maybeSingle();
    return data ? { yard_id: id, unit_id: null } : null;
  }
  return null;
}

/** Add one piece from the Equipment screen, then open it to add its paper. */
export async function addEquipment(fd: FormData) {
  const { company } = await requireBillableCompany();
  const name = str(fd, "name");
  const category = str(fd, "category") || "other";
  const identifier = str(fd, "identifier") || null;
  if (!name) return;
  const db = await saasDb();
  const where = await resolveWhere(db, company.id, str(fd, "where"));
  if (!where) return;
  if (await isRecentDuplicate(db, "saas_assets", { company_id: company.id, name, unit_id: where.unit_id })) {
    revalidatePath("/app"); revalidatePath("/app/equipment");
    return; // double-tap echo
  }
  const { data, error } = await db.from("saas_assets")
    .insert({ company_id: company.id, name, category, identifier, ...where })
    .select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/app"); revalidatePath("/app/equipment");
  redirect(`/app/assets/${(data as { id: string }).id}`);
}

/**
 * Is this truck out on a job right now? Its newest load-out rolled (READY, or
 * on a manager's override) and nobody has checked it in since. The same rule
 * as the board (lib/saas/whereabouts.ts truckOut).
 */
async function truckTrip(db: Db, companyId: string, unitId: string): Promise<{ since: string; loadoutId: string } | null> {
  const [{ data: lo }, { data: back }] = await Promise.all([
    db.from("saas_loadout_scans").select("id, unit_id, finished_at, verdict, pieces, not_scanned").eq("company_id", companyId).eq("unit_id", unitId)
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("saas_returns").select("unit_id, finished_at").eq("company_id", companyId).eq("unit_id", unitId)
      .order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const l = lo as (Pick<LoadoutRecord, "id" | "unit_id" | "finished_at" | "verdict" | "pieces" | "not_scanned">) | null;
  if (!l) return null;
  const { data: ov } = await db.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at")
    .eq("company_id", companyId).eq("loadout_id", l.id).maybeSingle();
  const o = ov as LoadoutOverride | null;
  const rolled = outcomeOf(l, o) !== "blocked";
  return truckOut([{ id: l.id, unit_id: unitId, finished_at: l.finished_at, rolled, since: o?.created_at }],
    back ? [back as { unit_id: string | null; finished_at: string }] : []).get(unitId) ?? null;
}

/**
 * Move a piece to a yard or a truck, with an optional note ("rack 2").
 * Anyone on the crew can move iron. The database writes the history row
 * itself (migration 0010), so a move can't happen without a record.
 */
export async function moveEquipment(fd: FormData) {
  const { company, user } = await requireBillableCompany();
  const id = str(fd, "id");
  const note = str(fd, "note").slice(0, 120);
  if (!id) return;
  const db = await saasDb();
  const where = await resolveWhere(db, company.id, str(fd, "where"));
  if (!where) return;
  const { data: before } = await db.from("saas_assets")
    .select("id, name, identifier, category, status, unit_id, out_since, out_loadout_id, out_with_user, redress_each_run, needs_redress_since")
    .eq("id", id).eq("company_id", company.id).maybeSingle();
  const b = before as { id: string; name: string; identifier: string | null; category: string; status: string; unit_id: string | null; out_since: string | null; out_loadout_id: string | null; out_with_user: string | null; redress_each_run: boolean | null; needs_redress_since: string | null } | null;
  if (!b) return;
  const by = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split("@")[0] || null;
  const { error } = await db.from("saas_assets").update({
    ...where,
    last_seen_where: note || null,
    last_seen_by: by,
    last_seen_at: new Date().toISOString(),
  }).eq("id", id).eq("company_id", company.id);
  if (error) throw new Error(error.message);
  // Flagged missing and somebody just moved it: they have it in hand, so it's
  // found, the same as a scan at a load-out or a check-in. A red tag stays on.
  // The database logs "marked in service (was missing)" under their name.
  if (b.status === "missing") {
    await db.from("saas_assets").update({ status: "in_service" }).eq("id", id).eq("company_id", company.id).eq("status", "missing");
  }
  // Onto a truck that's out on a job: the piece joins that trip, so its out
  // clock runs from now and a check-in that leaves it out keeps it running.
  const trip = where.unit_id ? await truckTrip(db, company.id, where.unit_id) : null;
  // Already on this truck's trip (a new note, say): leave its clock alone.
  const sameTrip = Boolean(trip && b.unit_id === where.unit_id && b.out_since && b.out_loadout_id === trip.loadoutId);
  // Somebody has it in hand, so it isn't out on a job anymore. Only the
  // server writes that (the database turns a phone away).
  // A tool signed out to someone that's moved is back from them too: the
  // sign-out closes, or it would read "With Dale" forever.
  const admin = saasAdmin();
  const now = new Date().toISOString();
  const wasOut = Boolean(b.out_since || b.out_with_user);
  if (!sameTrip) {
    // Back from a run, the same as a check-in: a tool set to be redressed after
    // every run needs it now. (First, while it still reads as out.)
    await admin?.from("saas_assets").update({ needs_redress_since: now })
      .eq("id", id).eq("company_id", company.id).eq("redress_each_run", true).is("needs_redress_since", null)
      .or("out_since.not.is.null,out_with_user.not.is.null");
    if (trip) {
      await admin?.from("saas_assets").update({ out_since: now, out_loadout_id: trip.loadoutId, out_alerted_at: null, out_with_user: null, out_with_name: null })
        .eq("id", id).eq("company_id", company.id);
    } else {
      await admin?.from("saas_assets").update({ out_since: null, out_loadout_id: null, out_alerted_at: null, out_with_user: null, out_with_name: null })
        .eq("id", id).eq("company_id", company.id).or("out_since.not.is.null,out_with_user.not.is.null,out_with_name.not.is.null");
    }
    await admin?.from("saas_signouts").update({ back_at: now, back_by: by, back_note: `moved${note ? `: ${note}` : ""}` })
      .eq("company_id", company.id).eq("asset_id", id).is("back_at", null);
  }
  // Iron put on a truck after it rolled skipped the load-out's check. If it's
  // bad, the move still saves (it's on the truck), and the managers hear now.
  if (trip && !sameTrip && where.unit_id) {
    const { data: itemRows } = await db.from("saas_compliance_items").select("title, expiration_date, reminder_days, pending_until, last_upload_id")
      .eq("company_id", company.id).eq("parent_type", "asset").eq("parent_id", id);
    const problem = pieceProblem({
      status: b.status === "missing" ? "in_service" : b.status,
      category: b.category,
      needs_redress_since: b.needs_redress_since ?? (b.redress_each_run && wasOut ? now : null),
    }, (itemRows ?? []) as { title: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null }[], localToday());
    if (problem) {
      const { data: u } = await db.from("saas_units").select("name").eq("id", where.unit_id).eq("company_id", company.id).maybeSingle();
      const truck = (u as { name: string } | null)?.name ?? "a truck";
      const message = `${b.name}${b.identifier ? ` ${b.identifier}` : ""} put on ${truck} after it loaded out: ${problem}. Moved by ${by ?? "someone"}`;
      void logEvent({ companyId: company.id, kind: "bad_iron_out", unitId: where.unit_id, actor: by, message });
      void notifyEvent({ companyId: company.id, companyName: company.name, yardId: where.yard_id, message, href: `/app/units/${where.unit_id}` });
    }
  }
  revalidatePath("/app/signout");
  revalidatePath(`/app/assets/${id}`);
  revalidatePath("/app"); revalidatePath("/app/equipment");
  refresh(); // redraw the page the Move box is on, with the new history row
}
