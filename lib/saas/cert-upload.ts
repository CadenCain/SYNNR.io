import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPhotoText } from "./cert-read";
import { verifyUpload, precheck, type Check, type Evidence } from "./cert-verify";
import { usDate } from "./cert-dates";
import { localToday, addDaysIso } from "./status";
import { clearAlertLog } from "./alert-log";
import { logEvent, notifyEvent } from "./notify";

/**
 * The one way a cert date changes for anyone who isn't typing it in as a
 * manager: a photo of the paper. Runs with the service role, AFTER the route
 * has proven who the caller is and which company they're in; every id below
 * is re-checked against that company.
 *
 *   photo → read on the server → checked (lib/saas/cert-verify.ts) →
 *     all checks pass              → applied, the item goes green
 *     anything doesn't match       → waiting on a manager, the item stays red
 *     obviously wrong (old date…)  → refused, nothing saved, retake
 *
 * Every upload is kept with who, when, what was read, and what was checked.
 * The database won't let that record change afterward (migration 0009).
 */

import { getYardRules, isManagerRole, type Role } from "./yard-rules";
export { getYardRules, isManagerRole, type Role };

export interface UploadResult {
  ok: boolean;
  outcome: "applied" | "waiting" | "rejected";
  message: string;
  canForce?: boolean;
  canApprove?: boolean;
  checks?: Check[];
  flags?: string[];
  uploadId?: string;
}

interface ItemCtx {
  id: string; title: string; parent_type: string; parent_id: string;
  expiration_date: string | null; pending_until: string | null; status: string;
  holderName: string | null; identifier: string | null; parentLabel: string; unitId: string | null;
  label: string; // "BOP pressure test (Quad BOP stack #3)"
}

export async function loadItemCtx(admin: SupabaseClient, companyId: string, itemId: string): Promise<ItemCtx | null> {
  const { data } = await admin.from("saas_compliance_items_with_status")
    .select("id, title, parent_type, parent_id, expiration_date, pending_until, status")
    .eq("id", itemId).eq("company_id", companyId).maybeSingle();
  if (!data) return null;
  const i = data as { id: string; title: string; parent_type: string; parent_id: string; expiration_date: string | null; pending_until: string | null; status: string };
  let holderName: string | null = null, identifier: string | null = null, parentLabel = "", unitId: string | null = null;
  if (i.parent_type === "crew") {
    const { data: c } = await admin.from("saas_crew_members").select("name").eq("id", i.parent_id).eq("company_id", companyId).maybeSingle();
    holderName = (c as { name: string } | null)?.name ?? null;
    parentLabel = holderName ?? "crew";
  } else if (i.parent_type === "asset") {
    const { data: a } = await admin.from("saas_assets").select("name, identifier, unit_id").eq("id", i.parent_id).eq("company_id", companyId).maybeSingle();
    const asset = a as { name: string; identifier: string | null; unit_id: string | null } | null;
    identifier = asset?.identifier?.trim() || null;
    parentLabel = asset?.name ?? "gear";
    unitId = asset?.unit_id ?? null;
  } else {
    const { data: u } = await admin.from("saas_units").select("name, identifier").eq("id", i.parent_id).eq("company_id", companyId).maybeSingle();
    const unit = u as { name: string; identifier: string | null } | null;
    identifier = unit?.identifier?.trim() || null;
    parentLabel = unit?.name ?? "truck";
    unitId = i.parent_id;
  }
  return { ...i, holderName, identifier, parentLabel, unitId, label: `${i.title} (${parentLabel})` };
}

export async function processUpload(args: {
  admin: SupabaseClient;
  company: { id: string; name: string };
  actor: { userId: string | null; name: string | null; role: Role };
  itemId: string;
  evidence: Evidence;
  claimedExpiration: string | null;
  claimedIssued: string | null;
  force: boolean;
  photo: { bytes: Buffer; contentType: string } | { storagePath: string };
}): Promise<UploadResult> {
  const { admin, company, actor } = args;
  const refuse = (message: string, canForce = false): UploadResult => ({ ok: false, outcome: "rejected", message, canForce });

  const pre = precheck(args.evidence, args.claimedExpiration, localToday());
  if (pre) return refuse(pre);
  const item = await loadItemCtx(admin, company.id, args.itemId);
  if (!item) return refuse("That item isn't in your yard anymore. Refresh the page.");

  // The bytes: fresh from the phone, or a photo a hand already sent through
  // their update link (it lives under this company's folder, or it's refused).
  let bytes: Buffer, contentType: string, storagePath: string | null = null;
  if ("bytes" in args.photo) {
    bytes = args.photo.bytes; contentType = args.photo.contentType;
  } else {
    if (!args.photo.storagePath.startsWith(`${company.id}/`)) return refuse("That photo isn't from your yard.");
    const { data: blob, error } = await admin.storage.from("proofs").download(args.photo.storagePath);
    if (error || !blob) return refuse("Couldn't open that photo. Ask for a new one.");
    bytes = Buffer.from(await blob.arrayBuffer()); contentType = blob.type || "image/jpeg";
    storagePath = args.photo.storagePath;
  }
  if (!contentType.startsWith("image/")) return refuse("That isn't a photo. Take a picture of the cert.");
  if (bytes.length === 0) return refuse("The photo came through empty. Try again.");
  if (bytes.length > 12 * 1024 * 1024) return refuse("That photo is too big. Take it again from the camera.");

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { data: dupes } = await admin.from("saas_cert_uploads")
    .select("item_id").eq("company_id", company.id).eq("sha256", sha256).neq("item_id", item.id).neq("status", "rejected");
  const dupeItemIds = [...new Set(((dupes ?? []) as { item_id: string }[]).map((d) => d.item_id))];
  const sameHashOn: string[] = [];
  for (const id of dupeItemIds.slice(0, 2)) {
    const ctx = await loadItemCtx(admin, company.id, id);
    if (ctx) sameHashOn.push(ctx.label);
  }

  const today = localToday();
  const readText = await readPhotoText(bytes);
  const v = verifyUpload({
    evidence: args.evidence,
    claimedExpiration: args.evidence === "cert" ? args.claimedExpiration : null,
    claimedIssued: args.claimedIssued,
    today,
    readText,
    itemTitle: item.title,
    holderName: item.holderName,
    identifier: item.identifier,
    prevExpiration: item.expiration_date,
    itemWasFailing: item.status === "expired" || item.status === "none",
    sameHashOn,
  });
  if (v.reject && !(v.canForce && args.force)) return { ...refuse(v.reject, v.canForce), checks: v.checks };

  const rules = await getYardRules(admin, company.id);
  if (args.evidence === "temporary" && !rules.allowCertOnTheWay) {
    return refuse("Your yard doesn't allow \"cert on the way\". Upload the real cert when it comes in.");
  }

  const manager = isManagerRole(actor.role);
  const applyNow = v.verdict === "verified"
    ? manager || !rules.handUploadsNeedOk
    : args.evidence === "temporary" && manager;

  if (!storagePath) {
    storagePath = `${company.id}/cert/${item.id}/${Date.now()}-${sha256.slice(0, 12)}.jpg`;
    const { error } = await admin.storage.from("proofs").upload(storagePath, bytes, { contentType, upsert: false });
    if (error) return refuse("The photo didn't upload. Check your signal and try again.");
  }

  const { data: row, error: insErr } = await admin.from("saas_cert_uploads").insert({
    company_id: company.id,
    item_id: item.id,
    uploaded_by: actor.userId,
    uploaded_by_name: actor.name,
    uploaded_by_role: actor.role,
    storage_path: storagePath,
    content_type: contentType,
    sha256,
    evidence: args.evidence,
    claimed_expiration: args.evidence === "cert" ? args.claimedExpiration : null,
    claimed_issued: v.issued,
    prev_expiration: item.expiration_date,
    read_ok: readText !== null,
    read_dates: v.readDates,
    read_excerpt: readText ? readText.replace(/\s+/g, " ").trim().slice(0, 600) : null,
    checks: v.checks,
    flags: v.flags,
    verdict: v.verdict,
    status: "waiting",
    pending_until: args.evidence === "temporary" ? addDaysIso(today, 7) : null,
  }).select("id").single();
  if (insErr || !row) return refuse("That didn't save. Try once more.");
  const uploadId = (row as { id: string }).id;

  if (applyNow) {
    await applyUpload(admin, company.id, uploadId, null);
    const msg = args.evidence === "temporary"
      ? `Saved. ${item.title} shows "cert on the way" through ${usDate(addDaysIso(today, 7))}. Upload the real cert before then.`
      : `Checked against the photo. ${item.title} is good to ${usDate(args.claimedExpiration as string)}.`;
    return { ok: true, outcome: "applied", message: msg, checks: v.checks, flags: v.flags, uploadId };
  }

  // Parked for a manager. The newest upload is the one that counts; older
  // waiting ones for this item close out.
  await admin.from("saas_cert_uploads").update({ status: "superseded" })
    .eq("company_id", company.id).eq("item_id", item.id).eq("status", "waiting").neq("id", uploadId);
  await admin.from("saas_compliance_items").update({ waiting_upload_id: uploadId })
    .eq("id", item.id).eq("company_id", company.id);

  const missed = v.checks.filter((c) => !c.ok).map((c) => c.detail.replace(/\.+$/, ""));
  const why = args.evidence === "temporary" ? "Retest paper, cert on the way"
    : v.verdict === "verified" ? "Your yard has every hand upload wait for a manager"
    : missed[0] ?? "The software couldn't check it";
  const who = actor.name ?? "Someone";
  void logEvent({
    companyId: company.id, kind: "upload_waiting", unitId: item.unitId, actor: actor.name,
    message: `${item.label}: ${who} uploaded ${args.evidence === "temporary" ? "retest paper" : "a new cert"}. Waiting on a manager. ${why}.`,
  });
  if (!manager) {
    void notifyEvent({
      companyId: company.id, companyName: company.name, yardId: null,
      message: `${item.label}: ${who} uploaded ${args.evidence === "temporary" ? "retest paper" : "a new cert"} that needs your OK`,
    });
  }
  return {
    ok: true, outcome: "waiting", checks: v.checks, flags: v.flags, uploadId,
    canApprove: manager,
    message: manager
      ? `The software couldn't confirm it: ${why}. Look at it and approve it yourself if it's right.`
      : `Sent to a manager. ${item.title} stays red until they OK it. ${why}.`,
  };
}

/** Make an upload count: move the item's date (or start "cert on the way"). */
export async function applyUpload(
  admin: SupabaseClient, companyId: string, uploadId: string,
  reviewer: { userId: string; name: string | null; note?: string | null } | null,
): Promise<{ ok: boolean; message: string }> {
  const { data } = await admin.from("saas_cert_uploads")
    .select("id, item_id, status, evidence, claimed_expiration, claimed_issued, pending_until, created_at, storage_path, content_type, uploaded_by_name, verdict")
    .eq("id", uploadId).eq("company_id", companyId).maybeSingle();
  const up = data as {
    id: string; item_id: string; status: string; evidence: Evidence; claimed_expiration: string | null; claimed_issued: string | null;
    pending_until: string | null; created_at: string; storage_path: string; content_type: string | null; uploaded_by_name: string | null; verdict: string;
  } | null;
  if (!up || up.status !== "waiting") return { ok: false, message: "That upload was already handled." };
  const item = await loadItemCtx(admin, companyId, up.item_id);
  if (!item) return { ok: false, message: "That item is gone." };
  const today = localToday();

  if (up.evidence === "cert") {
    if (!up.claimed_expiration || up.claimed_expiration <= today) return { ok: false, message: "That date has already passed. Ask for the new cert." };
    const { error } = await admin.from("saas_compliance_items").update({
      expiration_date: up.claimed_expiration,
      issued_date: up.claimed_issued ?? up.created_at.slice(0, 10),
      renewed_without_proof: false,
      pending_until: null,
      last_upload_id: up.id,
      waiting_upload_id: null,
    }).eq("id", item.id).eq("company_id", companyId);
    if (error) return { ok: false, message: "Couldn't update the cert. Try again." };
    await clearAlertLog(companyId, item.id);
    // The cert it replaced becomes history.
    await admin.from("saas_cert_uploads").update({ status: "superseded" })
      .eq("company_id", companyId).eq("item_id", item.id).eq("status", "applied");
  } else {
    if (!up.pending_until || up.pending_until < today) return { ok: false, message: "The 7-day window on that paper has already run out." };
    const { error } = await admin.from("saas_compliance_items").update({
      pending_until: up.pending_until, waiting_upload_id: null,
    }).eq("id", item.id).eq("company_id", companyId);
    if (error) return { ok: false, message: "Couldn't update the cert. Try again." };
  }

  await admin.from("saas_cert_uploads").update({
    status: "applied",
    applied_at: new Date().toISOString(),
    ...(reviewer ? { reviewed_by: reviewer.userId, reviewed_by_name: reviewer.name, reviewed_at: new Date().toISOString(), review_note: reviewer.note ?? null } : {}),
  }).eq("id", up.id).eq("company_id", companyId);
  await admin.from("saas_cert_uploads").update({ status: "superseded" })
    .eq("company_id", companyId).eq("item_id", item.id).eq("status", "waiting").neq("id", up.id);

  await admin.from("saas_attachments").insert({
    company_id: companyId, entity_type: "compliance_item", entity_id: item.id,
    storage_path: up.storage_path, content_type: up.content_type, label: up.evidence === "cert" ? "proof" : "retest",
  });

  const by = up.uploaded_by_name ?? "someone";
  const how = reviewer
    ? `approved by ${reviewer.name ?? "a manager"}${up.verdict === "verified" ? "" : " after looking at the photo"}`
    : "checked against the photo";
  void logEvent({
    companyId, kind: "renewed", unitId: item.unitId, actor: reviewer?.name ?? up.uploaded_by_name,
    message: up.evidence === "cert"
      ? `${item.label} renewed: ${item.expiration_date ?? "no date"} → ${up.claimed_expiration}. Uploaded by ${by}, ${how}.`
      : `${item.label}: cert on the way through ${up.pending_until}. Retest paper from ${by}, ${how}.`,
  });
  return { ok: true, message: up.evidence === "cert" ? `${item.title} is good to ${usDate(up.claimed_expiration as string)}.` : `${item.title} shows cert on the way.` };
}

export async function rejectUpload(
  admin: SupabaseClient, companyId: string, uploadId: string,
  reviewer: { userId: string; name: string | null; note: string },
): Promise<{ ok: boolean; message: string }> {
  const { data } = await admin.from("saas_cert_uploads")
    .select("id, item_id, status, uploaded_by_name").eq("id", uploadId).eq("company_id", companyId).maybeSingle();
  const up = data as { id: string; item_id: string; status: string; uploaded_by_name: string | null } | null;
  if (!up || up.status !== "waiting") return { ok: false, message: "That upload was already handled." };
  await admin.from("saas_cert_uploads").update({
    status: "rejected", reviewed_by: reviewer.userId, reviewed_by_name: reviewer.name,
    reviewed_at: new Date().toISOString(), review_note: reviewer.note,
  }).eq("id", up.id).eq("company_id", companyId);
  await admin.from("saas_compliance_items").update({ waiting_upload_id: null })
    .eq("id", up.item_id).eq("company_id", companyId).eq("waiting_upload_id", up.id);
  const item = await loadItemCtx(admin, companyId, up.item_id);
  void logEvent({
    companyId, kind: "upload_rejected", unitId: item?.unitId ?? null, actor: reviewer.name,
    message: `${item?.label ?? "An item"}: upload from ${up.uploaded_by_name ?? "someone"} turned down by ${reviewer.name ?? "a manager"}. ${reviewer.note}`,
  });
  return { ok: true, message: "Turned down. The item stays as it was." };
}
