"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

export interface CheckItemInput {
  source_type: "loadout_item" | "asset" | "cert" | "crew_cert";
  source_id: string | null;
  label: string;
  result: "ok" | "missing" | "expired" | "na";
  note?: string | null;
}

/**
 * Check-out (before dispatch). Records the full checklist verdict. Rolling out
 * "not ready" is allowed but logged as an override — status captures it and
 * performed_by/at make it auditable (spec §4).
 *
 * Asset side-effects (honest inventory):
 *  - result=ok      → the asset left with the truck (checked_out_check_id set)
 *  - result=missing → it should've been in the yard and wasn't → flag status='missing'
 */
export async function submitCheckout(args: {
  unitId: string;
  jobRef: string | null;
  notes: string | null;
  crewIds: string[];
  items: CheckItemInput[];
  ready: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireCompany();
  const db = await saasDb();

  const { data: check, error } = await db
    .from("saas_dispatch_checks")
    .insert({
      company_id: company.id,
      unit_id: args.unitId,
      type: "checkout",
      performed_by: user.id,
      performed_by_name:
        (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null,
      status: args.ready ? "ready" : "not_ready_override",
      job_ref: args.jobRef,
      notes: args.notes,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const checkId = (check as { id: string }).id;

  if (args.items.length) {
    const { error: itemsErr } = await db.from("saas_dispatch_check_items").insert(
      args.items.map((i) => ({
        check_id: checkId,
        company_id: company.id,
        source_type: i.source_type,
        source_id: i.source_id,
        label: i.label,
        result: i.result,
        note: i.note ?? null,
      })),
    );
    if (itemsErr) return { ok: false, error: itemsErr.message };
  }

  if (args.crewIds.length) {
    await db.from("saas_dispatch_check_crew").insert(
      args.crewIds.map((crew_member_id) => ({ check_id: checkId, crew_member_id })),
    );
  }

  // Asset side-effects
  const outIds = args.items.filter((i) => i.source_type === "asset" && i.result === "ok" && i.source_id).map((i) => i.source_id as string);
  const missingIds = args.items.filter((i) => i.source_type === "asset" && i.result === "missing" && i.source_id).map((i) => i.source_id as string);
  if (outIds.length) {
    await db.from("saas_assets")
      .update({ checked_out_check_id: checkId, last_seen_at: new Date().toISOString() })
      .in("id", outIds).eq("company_id", company.id);
  }
  if (missingIds.length) {
    await db.from("saas_assets").update({ status: "missing" }).in("id", missingIds).eq("company_id", company.id);
  }

  revalidatePath(`/app/units/${args.unitId}`);
  revalidatePath("/app");
  return { ok: true };
}

/**
 * Check-in (on return). Reverse checklist: what came back. Returned assets are
 * released (checked_out cleared, last_seen bumped); anything that went out and
 * didn't come back is flagged status='missing' and stays pinned to the
 * checkout for the audit trail.
 */
export async function submitCheckin(args: {
  unitId: string;
  checkoutId: string;
  notes: string | null;
  items: CheckItemInput[]; // result ok = returned, missing = didn't come back
}): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireCompany();
  const db = await saasDb();

  const anyMissing = args.items.some((i) => i.result === "missing");
  const { data: check, error } = await db
    .from("saas_dispatch_checks")
    .insert({
      company_id: company.id,
      unit_id: args.unitId,
      type: "checkin",
      checkout_id: args.checkoutId,
      performed_by: user.id,
      performed_by_name:
        (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null,
      status: anyMissing ? "partial" : "passed",
      notes: args.notes,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const checkId = (check as { id: string }).id;

  if (args.items.length) {
    await db.from("saas_dispatch_check_items").insert(
      args.items.map((i) => ({
        check_id: checkId,
        company_id: company.id,
        source_type: i.source_type,
        source_id: i.source_id,
        label: i.label,
        result: i.result,
        note: i.note ?? null,
      })),
    );
  }

  const returned = args.items.filter((i) => i.source_type === "asset" && i.result === "ok" && i.source_id).map((i) => i.source_id as string);
  const gone = args.items.filter((i) => i.source_type === "asset" && i.result === "missing" && i.source_id).map((i) => i.source_id as string);
  if (returned.length) {
    await db.from("saas_assets")
      .update({ checked_out_check_id: null, last_seen_at: new Date().toISOString() })
      .in("id", returned).eq("company_id", company.id);
  }
  if (gone.length) {
    await db.from("saas_assets").update({ status: "missing" }).in("id", gone).eq("company_id", company.id);
  }

  revalidatePath(`/app/units/${args.unitId}`);
  revalidatePath("/app");
  return { ok: true };
}
