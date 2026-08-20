"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireWritableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/**
 * Crew document requests — the manager side. The hand's side (the public
 * upload page) lives in app/u/[token] and runs on the service role; nothing
 * here is reachable without a session in the company.
 */

export async function createDocRequest(args: { crewMemberId: string; kindHint?: string }): Promise<{ ok: boolean; url?: string; error?: string }> {
  const gate = await requireWritableCompany();
  if (!gate.ok) return { ok: false, error: gate.error };
  const { company, user } = gate;
  const db = await saasDb();

  // The token page later resolves this row with the SERVICE ROLE, so the crew
  // member must be proven ours before a link exists at all (same reasoning as
  // readiness proofs: a forged id here would leak through the public page).
  const { data: crew } = await db.from("saas_crew_members")
    .select("id, name").eq("id", args.crewMemberId).eq("company_id", company.id).maybeSingle();
  if (!crew) return { ok: false, error: "crew member not found" };

  const { data, error } = await db.from("saas_doc_requests")
    .insert({
      company_id: company.id,
      crew_member_id: args.crewMemberId,
      kind_hint: args.kindHint?.trim() || null,
      created_by: user.id,
    })
    .select("token")
    .single();
  if (error) return { ok: false, error: error.message };

  const actor = (user.user_metadata?.full_name as string | undefined) || user.email || null;
  await db.from("saas_events").insert({
    company_id: company.id,
    kind: "doc_request_sent",
    message: `Update link sent to ${(crew as { name: string }).name} — new card photo requested`,
    actor,
  });

  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://synnr.io";
  revalidatePath(`/app/crew/${args.crewMemberId}`);
  return { ok: true, url: `${origin}/u/${(data as { token: string }).token}` };
}

/** Close a request off the review queue — after the card's been renewed from
 *  the photo, or when the request is dead. Keeps the row (audit), flips status. */
export async function closeDocRequest(fd: FormData) {
  const { company, user } = await requireCompany();
  const id = String(fd.get("id") ?? "");
  const crewId = String(fd.get("crew_id") ?? "");
  const outcome = String(fd.get("outcome") ?? "done"); // done | revoked
  if (!id) return;
  const db = await saasDb();
  const { data: reqRow } = await db.from("saas_doc_requests")
    .select("id, status").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!reqRow) return;
  await db.from("saas_doc_requests")
    .update({ status: outcome === "revoked" ? "revoked" : "done" })
    .eq("id", id).eq("company_id", company.id);
  const actor = (user.user_metadata?.full_name as string | undefined) || user.email || null;
  await db.from("saas_events").insert({
    company_id: company.id,
    kind: "doc_request_closed",
    message: outcome === "revoked" ? "Document update link revoked" : "Document update reviewed and closed",
    actor,
  });
  if (crewId) revalidatePath(`/app/crew/${crewId}`);
  revalidatePath("/app/crew");
}
