"use server";

import { saasAdmin } from "@/lib/saas/db";
import { isWritable } from "@/lib/saas/entitlements";
import { parseDate } from "@/lib/saas/import-parse";

/**
 * PUBLIC document submission — the hand's half of the doc-request flow. No
 * session: the unguessable token IS the credential (same trust model as
 * readiness proofs), so every write here re-validates the token against the
 * service role before touching anything.
 */

const MAX_BYTES = 8 * 1024 * 1024; // phone photos run 2–5MB; 8 is headroom, not an invitation

export async function submitDocUpdate(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  const token = String(fd.get("token") ?? "");
  if (!token) return { ok: false, error: "bad link" };
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "service unavailable — try again in a minute" };

  const { data: reqData } = await admin
    .from("saas_doc_requests")
    .select("id, company_id, crew_member_id, status, expires_at")
    .eq("token", token).maybeSingle();
  const req = reqData as { id: string; company_id: string; crew_member_id: string; status: string; expires_at: string } | null;
  if (!req) return { ok: false, error: "this link isn't valid" };
  if (req.status === "done" || req.status === "revoked") return { ok: false, error: "this link has been closed — ask for a fresh one" };
  if (new Date(req.expires_at) < new Date()) return { ok: false, error: "this link expired — ask for a fresh one" };

  // Lapsed companies are read-only everywhere; a public backdoor that still
  // writes would undo the entitlement wall one photo at a time.
  const { data: co } = await admin.from("saas_companies")
    .select("name, subscription_status, comped").eq("id", req.company_id).maybeSingle();
  const company = co as { name: string; subscription_status: string; comped: boolean } | null;
  if (!company || !isWritable(company.subscription_status, company.comped)) {
    return { ok: false, error: "this account is paused — tell your manager" };
  }

  const file = fd.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "take a photo of the card first" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "photos only — take a picture of the card" };
  if (file.size > MAX_BYTES) return { ok: false, error: "photo too large — try again without zoom or from the camera app" };

  const kind = String(fd.get("kind") ?? "").trim().slice(0, 60) || "card";
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  let expiration: string | null = null;
  const rawExp = String(fd.get("expiration") ?? "").trim();
  if (rawExp) {
    try { expiration = parseDate(rawExp); }
    catch { return { ok: false, error: "that expiration date doesn't look right — use the date picker" }; }
  }

  const safe = (file.name || "card.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${req.company_id}/docreq/${req.id}/${Date.now()}-${safe}`;
  const { error: upErr } = await admin.storage.from("proofs")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (upErr) return { ok: false, error: "upload failed — check your signal and try again" };

  const { error: updErr } = await admin.from("saas_doc_requests").update({
    status: "submitted",
    submitted_at: new Date().toISOString(),
    file_path: path,
    submitted_kind: kind,
    submitted_expiration: expiration,
    submitted_note: note,
  }).eq("id", req.id);
  if (updErr) return { ok: false, error: "something broke saving it — try once more" };

  const { data: crew } = await admin.from("saas_crew_members")
    .select("name").eq("id", req.crew_member_id).maybeSingle();
  const crewName = (crew as { name: string } | null)?.name ?? "A hand";
  await admin.from("saas_events").insert({
    company_id: req.company_id,
    kind: "doc_submitted",
    message: `${crewName} sent a new ${kind} photo — review it in their crew book`,
    actor: crewName,
  });

  return { ok: true };
}
