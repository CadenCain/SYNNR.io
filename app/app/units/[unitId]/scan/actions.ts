"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { YARD_TZ } from "@/lib/saas/format";
import type { ScanHow } from "@/lib/saas/loadout";
import { judgeItem } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { expectedLines, fillLines, loadoutVerdict, type BadPiece } from "@/lib/saas/loadout-lines";

type Outcome = "yard" | "missing";

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
 * Save a load-out. The server works out READY or NOT READY from the records,
 * never from what the phone says: every line on the list (the truck's kit,
 * the packages picked, quick lines for today) has to be filled by a scanned
 * piece, and nothing scanned on can be out of test or red-tagged. Pieces
 * logged on the truck that didn't get scanned were taken off (to the yard)
 * or can't be found (missing, which blocks the truck). Writes one record
 * that nobody can edit, with who scanned each piece and when, and a proof
 * link. The database logs each piece's move by itself.
 */
export async function finishLoadout(input: {
  unitId: string;
  startedAt: string;
  scans: { assetId: string; how: ScanHow; at?: number }[];
  notScanned: { assetId: string; outcome: Outcome }[];
  packageIds?: string[];
  quick?: { label: string; qty: number }[];
}): Promise<{ ok: boolean; error?: string; summary?: string; id?: string; verdict?: "ready" | "not_ready"; reasons?: string[]; proofToken?: string }> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Your scans are still on this phone." };

  const { data: unitRow } = await db.from("saas_units").select("id, name, yard_id")
    .eq("id", input.unitId).eq("company_id", company.id).maybeSingle();
  const unit = unitRow as { id: string; name: string; yard_id: string } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };

  // The list. Kit and packages come from the database, not the phone, so a
  // phone can only add lines (quick ones), never drop one.
  const packageIds = [...new Set((input.packageIds ?? []).filter((x) => typeof x === "string"))].slice(0, 10);
  const [{ data: kitRow }, { data: pkgRows }] = await Promise.all([
    db.from("saas_packages").select("id, name").eq("company_id", company.id).eq("unit_id", unit.id).maybeSingle(),
    packageIds.length
      ? db.from("saas_packages").select("id, name").eq("company_id", company.id).is("unit_id", null).in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);
  const kit = kitRow as { id: string; name: string } | null;
  const pkgs = (pkgRows ?? []) as { id: string; name: string }[];
  const listIds = [...(kit ? [kit.id] : []), ...pkgs.map((x) => x.id)];
  const { data: lineRows } = listIds.length
    ? await db.from("saas_package_lines").select("package_id, label, qty, sort").in("package_id", listIds).order("sort")
    : { data: [] };
  const linesOf = (id: string) => ((lineRows ?? []) as { package_id: string; label: string; qty: number }[])
    .filter((l) => l.package_id === id).map((l) => ({ label: l.label, qty: l.qty }));
  const quick = (input.quick ?? []).slice(0, 30)
    .map((q) => ({ label: String(q.label ?? "").trim().slice(0, 80), qty: Math.min(99, Math.max(1, Math.floor(Number(q.qty)) || 1)) }))
    .filter((q) => q.label);
  const expected = expectedLines({
    kit: kit ? linesOf(kit.id) : [],
    packages: pkgs.map((x) => ({ name: x.name, lines: linesOf(x.id) })),
    quick,
  });

  // Everything logged on the truck right now, plus whatever the phone sent.
  const { data: onTruckRows } = await db.from("saas_assets").select("id").eq("company_id", company.id).eq("unit_id", unit.id).neq("status", "retired");
  const onTruckIds = ((onTruckRows ?? []) as { id: string }[]).map((r) => r.id);
  const ids = [...new Set([...input.scans.map((s) => s.assetId), ...input.notScanned.map((n) => n.assetId), ...onTruckIds])];
  const { data: assetRows } = ids.length
    ? await db.from("saas_assets").select("id, name, identifier, unit_id, status").eq("company_id", company.id).in("id", ids)
    : { data: [] };
  type A = { id: string; name: string; identifier: string | null; unit_id: string | null; status: string };
  const byId = new Map(((assetRows ?? []) as A[]).map((a) => [a.id, a]));
  const label = (a: A) => `${a.name}${a.identifier ? ` ${a.identifier}` : ""}`;

  const now = new Date().toISOString();
  const nowMs = Date.parse(now);
  const startedMs = Date.parse(input.startedAt) || nowMs;
  const day = dayLabel(now);
  const today = localToday();

  // Each scan keeps the time the phone saw it, kept honest: never in the
  // future, never from before the load-out started.
  const seen = new Set<string>();
  const scans = input.scans.filter((s) => {
    const a = byId.get(s.assetId);
    if (!a || a.status === "retired" || seen.has(s.assetId)) return false;
    seen.add(s.assetId);
    return true;
  }).map((s) => {
    const at = typeof s.at === "number" && s.at <= nowMs + 60e3 && s.at >= startedMs - 60e3 ? new Date(Math.min(s.at, nowMs)).toISOString() : now;
    return { ...s, at };
  });
  const scannedIds = scans.map((s) => s.assetId);

  // What's wrong with the pieces that went on, worked out here from the records.
  const { data: itemRows } = scannedIds.length
    ? await db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until")
        .eq("company_id", company.id).eq("parent_type", "asset").in("parent_id", scannedIds)
    : { data: [] };
  type Item = { id: string; title: string; parent_id: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null };
  const bad: (BadPiece & { id: string })[] = [];
  for (const id of scannedIds) {
    const a = byId.get(id)!;
    if (a.status === "out_of_service") bad.push({ id, name: a.name, serial: a.identifier, why: "red_tagged" });
  }
  for (const it of (itemRows ?? []) as Item[]) {
    const a = byId.get(it.parent_id)!;
    if (a.status === "out_of_service") continue;
    const r = judgeItem(it, today, today);
    if (r.result === "expired") bad.push({ id: a.id, name: a.name, serial: a.identifier, why: "out_of_test", detail: `${it.title} ${r.detail}` });
    else if (r.result === "missing") bad.push({ id: a.id, name: a.name, serial: a.identifier, why: "no_test_date", detail: it.title });
  }
  const redIds = new Set(bad.map((b) => b.id));
  // Each piece's tests as they stood when it went on, kept on the record.
  const testsOf = new Map<string, { title: string; good_until: string | null; result: string }[]>();
  for (const it of (itemRows ?? []) as Item[]) {
    const list = testsOf.get(it.parent_id) ?? [];
    list.push({ title: it.title, good_until: it.expiration_date, result: judgeItem(it, today, today).result });
    testsOf.set(it.parent_id, list);
  }

  // The truck's own paper (DOT and the like) counts too.
  const { data: paperRows } = await db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until")
    .eq("company_id", company.id).eq("parent_type", "unit").eq("parent_id", unit.id);
  const truckPaper = ((paperRows ?? []) as Item[]).map((it) => ({ it, r: judgeItem(it, today, today) }))
    .filter((x) => x.r.result === "expired" || x.r.result === "missing")
    .map((x) => ({ title: x.it.title, detail: x.r.detail }));

  // Logged on the truck but not scanned: taken off, or can't be found. One
  // the phone didn't say anything about stays where it's logged and blocks
  // the truck, because nobody proved it's there.
  const outcomeOf = new Map(input.notScanned.map((n) => [n.assetId, n.outcome]));
  const notScanned = onTruckIds.filter((id) => !seen.has(id) && byId.has(id)).map((id) => {
    const o = outcomeOf.get(id);
    return { assetId: id, outcome: (o === "yard" || o === "missing" ? o : "left") as Outcome | "left" };
  });
  const cantFind = notScanned.filter((n) => n.outcome === "missing").map((n) => byId.get(n.assetId)!);
  const unaccounted = notScanned.filter((n) => n.outcome === "left").map((n) => byId.get(n.assetId)!);

  const filled = fillLines(expected, scans.map((s) => { const a = byId.get(s.assetId)!; return { id: a.id, name: a.name, serial: a.identifier }; }));
  const v = loadoutVerdict({
    lines: filled,
    bad,
    cantFind: cantFind.map((a) => ({ name: a.name, serial: a.identifier })),
    truckPaper,
    scanned: scans.length,
  });
  const reasons = [...v.reasons, ...unaccounted.map((a) => `Not scanned: ${label(a)}`)];
  const verdict: "ready" | "not_ready" = reasons.length ? "not_ready" : "ready";

  // Move the iron. Scanned pieces are on this truck now; a piece flagged
  // missing that got scanned has been found. A red tag only comes off by a
  // manager, so red-tagged iron keeps it.
  if (scannedIds.length) {
    const { error } = await db.from("saas_assets").update({
      unit_id: unit.id, yard_id: unit.yard_id,
      scanned_at: now, scanned_by: actor, scanned_unit_id: unit.id,
      last_seen_where: `scanned at load-out ${day}`, last_seen_by: actor, last_seen_at: now,
    }).eq("company_id", company.id).in("id", scannedIds);
    if (error) return { ok: false, error: `Couldn't save the scans: ${error.message}` };
    const found = scannedIds.filter((id) => byId.get(id)!.status === "missing");
    if (found.length) await db.from("saas_assets").update({ status: "in_service" }).eq("company_id", company.id).in("id", found);
  }
  for (const n of notScanned) {
    const a = byId.get(n.assetId)!;
    if (n.outcome === "yard") {
      await db.from("saas_assets").update({
        unit_id: null, yard_id: unit.yard_id,
        last_seen_where: `taken off ${unit.name} at load-out ${day}`, last_seen_by: actor, last_seen_at: now,
      }).eq("id", a.id).eq("company_id", company.id);
    } else if (n.outcome === "missing") {
      await db.from("saas_assets").update({
        ...(a.status === "out_of_service" ? {} : { status: "missing" }),
        last_seen_where: `not found for ${unit.name} load-out ${day}`, last_seen_by: actor, last_seen_at: now,
      }).eq("id", a.id).eq("company_id", company.id);
    }
  }

  const onList = scans.filter((s) => byId.get(s.assetId)!.unit_id === unit.id).length;
  const { data: rec, error: recErr } = await admin.from("saas_loadout_scans").insert({
    company_id: company.id, unit_id: unit.id, unit_name: unit.name, yard_id: unit.yard_id,
    scanned_by: actor, scanned_by_user: user.id,
    started_at: new Date(startedMs).toISOString(), finished_at: now,
    expected: onList + notScanned.length, scanned: onList,
    verdict, reasons,
    packages: pkgs.map((x) => x.name),
    lines: filled.map((l) => ({ label: l.label, qty: l.qty, source: l.source, ...(l.package ? { package: l.package } : {}), filled: l.filled.map((f) => ({ asset_id: f.id, name: f.name, serial: f.serial })) })),
    pieces: scans.map((s) => { const a = byId.get(s.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, how: s.how, at: s.at, by: actor, added: a.unit_id !== unit.id, red: redIds.has(a.id), tests: testsOf.get(a.id) ?? [] }; }),
    not_scanned: notScanned.map((n) => { const a = byId.get(n.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, outcome: n.outcome }; }),
  }).select("id, proof_token").single();
  if (recErr || !rec) return { ok: false, error: `Couldn't save the load-out record: ${recErr?.message ?? "unknown"}` };
  const saved = rec as { id: string; proof_token: string };

  // Out on a job: a READY load-out puts what went on out until it's checked
  // back in. A NOT READY one didn't leave (unless a manager overrides it, which
  // starts the clock then). Anything taken off is back in the yard.
  if (scannedIds.length) {
    await admin.from("saas_assets").update(verdict === "ready"
      ? { out_since: now, out_loadout_id: saved.id, out_alerted_at: null }
      : { out_since: null, out_loadout_id: null, out_alerted_at: null })
      .eq("company_id", company.id).in("id", scannedIds);
  }
  const offIds = notScanned.filter((n) => n.outcome === "yard").map((n) => n.assetId);
  if (offIds.length) await admin.from("saas_assets").update({ out_since: null, out_loadout_id: null, out_alerted_at: null }).eq("company_id", company.id).in("id", offIds);

  const summary = verdict === "ready"
    ? `${unit.name} loaded out READY by ${actor}: ${scans.length} ${scans.length === 1 ? "piece" : "pieces"} scanned`
    : `${unit.name} blocked at load-out (NOT READY) by ${actor}: ${reasons.slice(0, 3).join("; ")}${reasons.length > 3 ? `; and ${reasons.length - 3} more` : ""}`;
  void logEvent({ companyId: company.id, kind: verdict === "ready" ? "loadout_ready" : "loadout_blocked", unitId: unit.id, actor, message: summary });
  if (verdict === "not_ready") void notifyEvent({ companyId: company.id, companyName: company.name, yardId: unit.yard_id, message: summary });

  revalidatePath(`/app/units/${unit.id}`);
  revalidatePath("/app/map");
  revalidatePath("/app");
  return { ok: true, summary, id: saved.id, verdict, reasons, proofToken: saved.proof_token };
}
