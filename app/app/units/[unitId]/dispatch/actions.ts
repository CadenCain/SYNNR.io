"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { notifyEvent, logEvent } from "@/lib/saas/notify";

export interface CheckItemInput {
  source_type: "loadout_item" | "asset" | "cert" | "crew_cert";
  source_id: string | null;
  label: string;
  result: "ok" | "missing" | "expired" | "na" | "unconfirmed";
  note?: string | null;
  photo_path?: string | null;
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
  overrideReason?: string | null;
  failures?: string[]; // named failing lines, for the alert + event copy
  cosignerName?: string | null;
  cosignerPin?: string | null;
  checkerName?: string | null;
  checkerPin?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireCompany();
  const db = await saasDb();
  let actor = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null;

  // Enforcement (spec #1): server-side gate — the client hints are UX only.
  // One company PIN covers checker sign-on and co-sign; PIN rules only bite
  // once a PIN is actually configured (else a fresh org could never roll).
  const { data: enfData } = await db
    .from("saas_enforcement_settings")
    .select("photo_mode, require_pin, require_cosign, cosign_pin")
    .eq("company_id", company.id).maybeSingle();
  const enf = enfData as { photo_mode: string; require_pin: boolean; require_cosign: boolean; cosign_pin: string | null } | null;
  const pinConfigured = Boolean(enf?.cosign_pin);
  const photoMode = enf?.photo_mode ?? "flagged";

  // (a) Who did the check — name + PIN sign-on for shared yard tablets.
  if ((enf?.require_pin ?? true) && pinConfigured) {
    if (!args.checkerName?.trim() || !args.checkerPin?.trim()) {
      return { ok: false, error: "Sign the check: name + PIN." };
    }
    if (args.checkerPin.trim() !== enf!.cosign_pin) {
      return { ok: false, error: "Checker PIN doesn't match." };
    }
    actor = args.checkerName.trim();
  }

  // (c) Second-person sign-off — must be a different person than the checker.
  let cosignerName: string | null = null;
  let cosignedAt: string | null = null;
  if (enf?.require_cosign) {
    if (!args.cosignerName?.trim() || !args.cosignerPin?.trim()) {
      return { ok: false, error: "Second-person sign-off required." };
    }
    if (!pinConfigured || args.cosignerPin.trim() !== enf.cosign_pin) {
      return { ok: false, error: "Co-sign PIN doesn't match." };
    }
    if (actor && args.cosignerName.trim().toLowerCase() === actor.toLowerCase()) {
      return { ok: false, error: "Co-signer must be a different person than the checker." };
    }
    cosignerName = args.cosignerName.trim();
    cosignedAt = new Date().toISOString();
  }

  // (b) Photo proof — off | flagged | all
  if (photoMode !== "off") {
    const gearLines = args.items.filter((i) => i.source_type === "loadout_item" || i.source_type === "asset");
    const needing = photoMode === "all" ? gearLines : gearLines.filter((i) => i.result === "missing");
    const noPhoto = needing.filter((i) => !i.photo_path);
    if (noPhoto.length > 0) {
      return { ok: false, error: `Photo required: ${noPhoto.map((i) => i.label).join(", ")}` };
    }
  }

  const { data: check, error } = await db
    .from("saas_dispatch_checks")
    .insert({
      company_id: company.id,
      unit_id: args.unitId,
      type: "checkout",
      performed_by: user.id,
      performed_by_name: actor,
      status: args.ready ? "ready" : "not_ready_override",
      job_ref: args.jobRef,
      notes: args.notes,
      override_reason: args.ready ? null : args.overrideReason?.trim() || null,
      cosigner_name: cosignerName,
      cosigned_at: cosignedAt,
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
        photo_path: i.photo_path ?? null,
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

  // Command-center stream + instant alerts. Fire-and-forget — never blocks the save.
  const { data: unitRow } = await db.from("saas_units").select("name, yard_id").eq("id", args.unitId).maybeSingle();
  const u = unitRow as { name: string; yard_id: string } | null;
  const unitName = u?.name ?? "unit";
  const failLine = (args.failures ?? []).slice(0, 3).join("; ");
  if (args.ready) {
    void logEvent({ companyId: company.id, kind: "rolled_out", unitId: args.unitId, actor, message: `${unitName} rolled out Ready${args.jobRef ? ` — ${args.jobRef}` : ""}` });
  } else {
    void logEvent({ companyId: company.id, kind: "rolled_out_override", unitId: args.unitId, actor, message: `${unitName} rolled out NOT ready — ${failLine || "override"}${args.overrideReason ? ` (“${args.overrideReason.trim()}”)` : ""} — overridden by ${actor ?? "unknown"}` });
    void notifyEvent({ companyId: company.id, companyName: company.name, yardId: u?.yard_id, message: `${unitName} rolled out NOT ready — ${failLine || "override"}` });
  }
  // A checkout that surfaced failures is a miss caught before it hit a location.
  if ((args.failures ?? []).length > 0) {
    void logEvent({ companyId: company.id, kind: "miss_caught", unitId: args.unitId, actor, message: `Caught before rollout on ${unitName}: ${failLine}` });
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

  const actor2 = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email || null;
  const { data: unitRow2 } = await db.from("saas_units").select("name, yard_id").eq("id", args.unitId).maybeSingle();
  const u2 = unitRow2 as { name: string; yard_id: string } | null;
  const unitName2 = u2?.name ?? "unit";
  if (anyMissing) {
    const goneLabels = args.items.filter((i) => i.result === "missing").map((i) => i.label).slice(0, 3).join(", ");
    void logEvent({ companyId: company.id, kind: "checkin_partial", unitId: args.unitId, actor: actor2, message: `${unitName2} checked in — not returned: ${goneLabels}` });
    void notifyEvent({ companyId: company.id, companyName: company.name, yardId: u2?.yard_id, message: `${unitName2} came back missing gear: ${goneLabels}` });
  } else {
    void logEvent({ companyId: company.id, kind: "checked_in", unitId: args.unitId, actor: actor2, message: `${unitName2} checked in — all accounted for` });
  }

  revalidatePath(`/app/units/${args.unitId}`);
  revalidatePath("/app");
  return { ok: true };
}
