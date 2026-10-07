"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { logEvent } from "@/lib/saas/notify";
import { YARD_TZ } from "@/lib/saas/format";
import type { ScanHow } from "@/lib/saas/loadout";

type Outcome = "left" | "yard" | "missing";

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "short", day: "numeric" });

/**
 * Link an outside tag (a testing company's NFC chip, or a QR code that isn't
 * RollReady's) to a piece, so the next scan of it finds the piece.
 */
export async function linkTag(input: { assetId: string; extTag: string }): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireBillableCompany();
  const extTag = input.extTag.trim().slice(0, 310);
  if (!input.assetId || !extTag) return { ok: false, error: "Pick the piece this tag is on." };
  const db = await saasDb();
  const { data: taken } = await db.from("saas_assets").select("id, name, identifier")
    .eq("company_id", company.id).eq("nfc_uid", extTag).maybeSingle();
  const t = taken as { id: string; name: string; identifier: string | null } | null;
  if (t && t.id !== input.assetId) {
    return { ok: false, error: `That tag is already linked to ${t.name}${t.identifier ? ` ${t.identifier}` : ""}.` };
  }
  const { data, error } = await db.from("saas_assets").update({ nfc_uid: extTag })
    .eq("id", input.assetId).eq("company_id", company.id).select("name, identifier, unit_id").maybeSingle();
  if (error || !data) return { ok: false, error: "Couldn't link that tag. Try again." };
  const a = data as { name: string; identifier: string | null; unit_id: string | null };
  void logEvent({ companyId: company.id, kind: "tag_linked", unitId: a.unit_id, actor: actorOf(user),
    message: `A tag was linked to ${a.name}${a.identifier ? ` ${a.identifier}` : ""}` });
  return { ok: true };
}

/**
 * Save a load-out: every scanned piece is now on this truck, proven by the
 * scan; pieces on the truck's list that didn't get scanned are left on it,
 * moved to the yard, or flagged missing, as the hand chose. Writes one
 * record that can't be edited. The database logs each move by itself.
 */
export async function finishLoadout(input: {
  unitId: string;
  startedAt: string;
  scans: { assetId: string; how: ScanHow }[];
  notScanned: { assetId: string; outcome: Outcome }[];
}): Promise<{ ok: boolean; error?: string; summary?: string }> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();

  const { data: unitRow } = await db.from("saas_units").select("id, name, yard_id")
    .eq("id", input.unitId).eq("company_id", company.id).maybeSingle();
  const unit = unitRow as { id: string; name: string; yard_id: string } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };

  const ids = [...new Set([...input.scans.map((s) => s.assetId), ...input.notScanned.map((n) => n.assetId)])];
  const { data: assetRows } = ids.length
    ? await db.from("saas_assets").select("id, name, identifier, unit_id, status").eq("company_id", company.id).in("id", ids)
    : { data: [] };
  type A = { id: string; name: string; identifier: string | null; unit_id: string | null; status: string };
  const byId = new Map(((assetRows ?? []) as A[]).map((a) => [a.id, a]));
  const label = (a: A) => `${a.name}${a.identifier ? ` ${a.identifier}` : ""}`;

  const now = new Date().toISOString();
  const day = dayLabel(now);
  const scans = input.scans.filter((s) => byId.has(s.assetId) && byId.get(s.assetId)!.status !== "retired");
  const scannedIds = [...new Set(scans.map((s) => s.assetId))];

  if (scannedIds.length) {
    const { error } = await db.from("saas_assets").update({
      unit_id: unit.id, yard_id: unit.yard_id,
      scanned_at: now, scanned_by: actor, scanned_unit_id: unit.id,
      last_seen_where: `scanned at load-out ${day}`, last_seen_by: actor, last_seen_at: now,
    }).eq("company_id", company.id).in("id", scannedIds);
    if (error) return { ok: false, error: `Couldn't save the scans: ${error.message}` };
  }

  const notScanned = input.notScanned.filter((n) => byId.has(n.assetId) && !scannedIds.includes(n.assetId));
  for (const n of notScanned) {
    const a = byId.get(n.assetId)!;
    if (n.outcome === "yard") {
      await db.from("saas_assets").update({
        unit_id: null, yard_id: unit.yard_id,
        last_seen_where: `taken off ${unit.name} at load-out ${day}`, last_seen_by: actor, last_seen_at: now,
      }).eq("id", a.id).eq("company_id", company.id);
    } else if (n.outcome === "missing") {
      // A red tag only comes off by a manager, so red-tagged iron keeps its
      // tag; the note still says it wasn't found.
      await db.from("saas_assets").update({
        ...(a.status === "out_of_service" ? {} : { status: "missing" }),
        last_seen_where: `not found for ${unit.name} load-out ${day}`, last_seen_by: actor, last_seen_at: now,
      }).eq("id", a.id).eq("company_id", company.id);
    }
  }

  const expectedCount = scans.filter((s) => byId.get(s.assetId)!.unit_id === unit.id).length + notScanned.length;
  const added = scans.filter((s) => byId.get(s.assetId)!.unit_id !== unit.id).map((s) => byId.get(s.assetId)!);
  const missing = notScanned.filter((n) => n.outcome === "missing").map((n) => byId.get(n.assetId)!);
  const toYard = notScanned.filter((n) => n.outcome === "yard").map((n) => byId.get(n.assetId)!);

  await db.from("saas_loadout_scans").insert({
    company_id: company.id, unit_id: unit.id, unit_name: unit.name, scanned_by: actor,
    started_at: input.startedAt || null, finished_at: now,
    // "scanned" counts the truck's own list, so 4 of 5 means one wasn't scanned;
    // pieces brought over from elsewhere are listed as added.
    expected: expectedCount, scanned: scans.filter((s) => byId.get(s.assetId)!.unit_id === unit.id).length,
    pieces: scans.map((s) => { const a = byId.get(s.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, how: s.how, added: a.unit_id !== unit.id }; }),
    not_scanned: notScanned.map((n) => { const a = byId.get(n.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, outcome: n.outcome }; }),
  });

  const onListScanned = scans.filter((s) => byId.get(s.assetId)!.unit_id === unit.id).length;
  const parts = [`${onListScanned} of ${expectedCount} on the list scanned`];
  if (added.length) parts.push(`added ${added.map(label).join(", ")}`);
  if (toYard.length) parts.push(`to the yard: ${toYard.map(label).join(", ")}`);
  if (missing.length) parts.push(`missing: ${missing.map(label).join(", ")}`);
  const leftCount = notScanned.filter((n) => n.outcome === "left").length;
  if (leftCount) parts.push(`${leftCount} not scanned, left on the truck`);
  const summary = `${unit.name} load-out: ${parts.join("; ")}`;
  void logEvent({ companyId: company.id, kind: "loadout_scanned", unitId: unit.id, actor, message: summary });

  revalidatePath(`/app/units/${unit.id}`);
  revalidatePath("/app/map");
  revalidatePath("/app");
  return { ok: true, summary };
}
