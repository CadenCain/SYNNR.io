"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { YARD_TZ } from "@/lib/saas/format";
import type { ScanHow } from "@/lib/saas/loadout";
import { judgeItem, isNoPaper } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";
import { expectedLines, fillLines, loadoutVerdict, untestedPieces, lineTokens, lineMatches, needsTagScan, type BadPiece } from "@/lib/saas/loadout-lines";
import { TESTED_CATEGORIES } from "@/lib/saas/taxonomy";
import { provenHow } from "@/lib/saas/scan-proof";
import { getOpenPlan } from "@/lib/saas/plans";
import { getYardRules } from "@/lib/saas/yard-rules";
import { photoPathOk } from "@/lib/saas/loadout-photo";
import { requiredChecks, missingChecks } from "@/lib/saas/roll-checks";

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
  const manager = company.role === "owner" || company.role === "admin";
  if (!manager && (await getYardRules(db, company.id)).requireTagScan) {
    return { ok: false, error: "This yard scans tags only, so a manager links new tags." };
  }
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

type Admin = NonNullable<ReturnType<typeof saasAdmin>>;

/** This hand's load-out of this truck that started at this moment, if it already saved. */
async function savedLoadout(admin: Admin, companyId: string, userId: string, unitId: string, startedIso: string) {
  const { data } = await admin.from("saas_loadout_scans").select("id, proof_token, verdict, reasons, unit_name, scanned_by, pieces, finished_at")
    .eq("company_id", companyId).eq("scanned_by_user", userId).eq("unit_id", unitId).eq("started_at", startedIso).maybeSingle();
  const r = data as { id: string; proof_token: string; verdict: "ready" | "not_ready"; reasons: string[] | null; unit_name: string; scanned_by: string; pieces: { asset_id?: string; red?: boolean }[] | null; finished_at: string } | null;
  if (!r) return null;
  const n = (r.pieces ?? []).length;
  const reasons = r.reasons ?? [];
  return {
    ok: true, id: r.id, verdict: r.verdict, reasons, proofToken: r.proof_token, finishedAt: r.finished_at,
    badIds: (r.pieces ?? []).filter((p) => p.red && p.asset_id).map((p) => p.asset_id as string),
    summary: r.verdict === "ready"
      ? `${r.unit_name} loaded out READY by ${r.scanned_by}: ${n} ${n === 1 ? "piece" : "pieces"} scanned`
      : `${r.unit_name} blocked at load-out (NOT READY) by ${r.scanned_by}: ${reasons.slice(0, 3).join("; ")}`,
  };
}

/** The photo of the loaded truck, if the phone sent one that's this load-out's and is really in storage. */
async function loadoutPhoto(admin: Admin, path: unknown, companyId: string, unitId: string, startedMs: number, nowMs: number): Promise<string | null> {
  if (!photoPathOk(path, companyId, unitId, startedMs, nowMs)) return null;
  // One photo, one load-out: a photo already on another record (someone
  // else's, or an earlier try) doesn't prove this load.
  const [{ error }, { data: used }] = await Promise.all([
    admin.storage.from("proofs").createSignedUrl(path, 60),
    admin.from("saas_loadout_scans").select("id").eq("company_id", companyId).eq("photo_path", path).limit(1),
  ]);
  return error || (used ?? []).length ? null : path;
}

/**
 * Save a load-out. The server works out READY or NOT READY from the records,
 * never from what the phone says: every line on the list (the truck's kit,
 * the packages picked, quick lines for today) has to be filled by a scanned
 * piece, and nothing scanned on can be out of test or red-tagged. Pieces
 * logged on the truck that didn't get scanned were taken off (to the yard)
 * or can't be found (missing, which blocks the truck). Writes one record
 * that nobody can edit, with who scanned each piece and when, the photo of
 * the loaded truck, and a proof link. The database logs each piece's move by
 * itself.
 */
export async function finishLoadout(input: {
  unitId: string;
  startedAt: string;
  /** After NOT READY and "Fix it and scan again": when the first try started.
   *  Pieces and checks kept from it keep their real times. */
  keptSince?: string;
  scans: { assetId: string; how: ScanHow; at?: number; proof?: string }[];
  notScanned: { assetId: string; outcome: Outcome }[];
  packageIds?: string[];
  quick?: { label: string; qty: number }[];
  /** Where the phone put the photo of the loaded truck (proofs bucket). */
  photoPath?: string;
  /** The roll checks the hand tapped, and when. */
  checks?: { label: string; at?: number }[];
  /** Which job or well (typed, or from the plan). */
  job?: string;
}): Promise<{ ok: boolean; error?: string; summary?: string; id?: string; verdict?: "ready" | "not_ready"; reasons?: string[]; proofToken?: string; backOn?: string[]; badIds?: string[]; stale?: boolean;
  left?: { id: string; name: string; serial: string | null; category: string }[]; packageIds?: string[] }> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Your scans are still on this phone." };

  const { data: unitRow } = await db.from("saas_units").select("id, name, yard_id")
    .eq("id", input.unitId).eq("company_id", company.id).maybeSingle();
  const unit = unitRow as { id: string; name: string; yard_id: string } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };

  // A resend of a load-out that already landed (signal dropped before the
  // phone heard back) gets the first record back, not a second one.
  const startedMs = Date.parse(input.startedAt) || Date.now();
  const startedIso = new Date(startedMs).toISOString();
  const already = await savedLoadout(admin, company.id, user.id, unit.id, startedIso);
  if (already) return already;
  // A load-out is one shift's work. One that says it started a day ago (or
  // tomorrow) is a phone clock gone wrong or someone borrowing an old start
  // to fit an old photo.
  if (startedMs < Date.now() - 20 * 3600e3 || startedMs > Date.now() + 10 * 60e3) {
    return { ok: false, error: "This load-out was started too long ago to save. Start it again from the truck." };
  }
  // The earliest a scan or check can be from: this load-out's start, or the
  // NOT READY try it picks up from (only if that really is this hand's, on
  // this truck, earlier the same shift).
  const keptMs = Date.parse(String(input.keptSince ?? ""));
  const firstTry = Number.isFinite(keptMs) && keptMs < startedMs && startedMs - keptMs < 12 * 3600e3
    ? await savedLoadout(admin, company.id, user.id, unit.id, new Date(keptMs).toISOString()) : null;
  const floorMs = firstTry ? keptMs : startedMs;
  // A "fix it and scan again" picked up after the truck already moved on (a
  // manager rolled the first try, it was checked in, or someone loaded it out
  // since) is stale: saving it would rewrite a truck that's already gone.
  if (firstTry?.id) {
    const [{ data: ov }, { data: back }, { data: newer }] = await Promise.all([
      admin.from("saas_loadout_overrides").select("loadout_id").eq("loadout_id", firstTry.id).maybeSingle(),
      admin.from("saas_returns").select("id").eq("company_id", company.id).eq("unit_id", unit.id).gt("finished_at", firstTry.finishedAt).limit(1).maybeSingle(),
      admin.from("saas_loadout_scans").select("id").eq("company_id", company.id).eq("unit_id", unit.id).gt("finished_at", firstTry.finishedAt).limit(1).maybeSingle(),
    ]);
    if (ov || back || newer) {
      return { ok: false, stale: true, error: `${unit.name} already ${ov ? "rolled on a manager's override" : back ? "came back and was checked in" : "has a newer load-out"}. This one can't be saved. Start a new load-out from the truck.` };
    }
  }

  // The list. Kit, packages, and the manager's plan come from the database,
  // not the phone, so a phone can only add lines (quick ones), never drop one.
  const [plan, rules] = await Promise.all([getOpenPlan(db, company.id, unit.id), getYardRules(db, company.id)]);
  const packageIds = [...new Set([...(plan?.packageIds ?? []), ...(input.packageIds ?? []).filter((x) => typeof x === "string")])].slice(0, 12);
  const [{ data: kitRow }, { data: pkgRows }] = await Promise.all([
    db.from("saas_packages").select("id, name, roll_checks").eq("company_id", company.id).eq("unit_id", unit.id).maybeSingle(),
    packageIds.length
      ? db.from("saas_packages").select("id, name, roll_checks").eq("company_id", company.id).is("unit_id", null).in("id", packageIds)
      : Promise.resolve({ data: [] }),
  ]);
  const kit = kitRow as { id: string; name: string; roll_checks: string[] | null } | null;
  const pkgs = (pkgRows ?? []) as { id: string; name: string; roll_checks: string[] | null }[];
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
    planned: plan?.lines ?? [],
    quick,
  });

  // Everything logged on the truck right now, plus whatever the phone sent.
  const [{ data: onTruckRows }, { data: lastBackRow }] = await Promise.all([
    db.from("saas_assets").select("id, out_since").eq("company_id", company.id).eq("unit_id", unit.id).neq("status", "retired"),
    db.from("saas_returns").select("finished_at").eq("company_id", company.id).eq("unit_id", unit.id).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Marked "still out" at the last check-in: still on the last job, not on
  // this truck. Left alone (its out clock keeps running) unless it's scanned.
  const lastBack = (lastBackRow as { finished_at: string } | null)?.finished_at ?? null;
  const stillOut = new Set(((onTruckRows ?? []) as { id: string; out_since: string | null }[])
    .filter((r) => r.out_since && lastBack && r.out_since < lastBack).map((r) => r.id));
  const onTruckIds = ((onTruckRows ?? []) as { id: string }[]).map((r) => r.id).filter((id) => !stillOut.has(id));
  const ids = [...new Set([...input.scans.map((s) => s.assetId), ...input.notScanned.map((n) => n.assetId), ...onTruckIds])];
  const { data: assetRows } = ids.length
    ? await db.from("saas_assets").select("id, name, identifier, unit_id, status, category, tag_token, nfc_uid, needs_redress_since, out_with_user").eq("company_id", company.id).in("id", ids)
    : { data: [] };
  type A = { id: string; name: string; identifier: string | null; unit_id: string | null; status: string; category: string; tag_token: string | null; nfc_uid: string | null; needs_redress_since: string | null; out_with_user: string | null };
  const byId = new Map(((assetRows ?? []) as A[]).map((a) => [a.id, a]));
  const label = (a: A) => `${a.name}${a.identifier ? ` ${a.identifier}` : ""}`;

  const now = new Date().toISOString();
  const nowMs = Date.parse(now);
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
    const at = typeof s.at === "number" && s.at <= nowMs + 60e3 && s.at >= floorMs - 60e3 ? new Date(Math.min(s.at, nowMs)).toISOString() : now;
    // A tag scan only counts if the code read off the tag is this piece's.
    const how = provenHow(s.how, s.proof, byId.get(s.assetId)!);
    return { assetId: s.assetId, how, at };
  });
  const scannedIds = scans.map((s) => s.assetId);
  const filled = fillLines(expected, scans.map((s) => { const a = byId.get(s.assetId)!; return { id: a.id, name: a.name, serial: a.identifier }; }));

  // What's wrong with the pieces that went on, worked out here from the records.
  const { data: itemRows } = scannedIds.length
    ? await db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until, last_upload_id")
        .eq("company_id", company.id).eq("parent_type", "asset").in("parent_id", scannedIds)
    : { data: [] };
  type Item = { id: string; title: string; parent_id: string; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; last_upload_id: string | null };
  const bad: (BadPiece & { id: string })[] = [];
  for (const id of scannedIds) {
    const a = byId.get(id)!;
    if (a.status === "out_of_service") bad.push({ id, name: a.name, serial: a.identifier, why: "red_tagged" });
    // Back from its last run and not redressed yet.
    else if (a.needs_redress_since) bad.push({ id, name: a.name, serial: a.identifier, why: "needs_redress" });
  }
  for (const it of (itemRows ?? []) as Item[]) {
    const a = byId.get(it.parent_id)!;
    if (a.status === "out_of_service" || a.needs_redress_since) continue;
    const r = judgeItem(it, today, today);
    if (r.result === "expired") bad.push({ id: a.id, name: a.name, serial: a.identifier, why: "out_of_test", detail: `${it.title} ${r.detail}` });
    else if (isNoPaper(r)) bad.push({ id: a.id, name: a.name, serial: a.identifier, why: "no_paper", detail: it.title });
    else if (r.result === "missing") bad.push({ id: a.id, name: a.name, serial: a.identifier, why: "no_test_date", detail: it.title });
  }
  // No test on file: pressure iron can't go, and neither can a piece filling
  // a line that the yard's other iron of that kind has a test for.
  const hasTest = new Set(((itemRows ?? []) as Item[]).map((it) => it.parent_id));
  const untested = scannedIds.filter((id) => !hasTest.has(id));
  const testedLabels = new Set<string>();
  if (untested.length) {
    // Every line an untested piece could fill, not just the one it landed in:
    // the answer can't depend on which piece got scanned first.
    const labels = new Set<string>();
    for (const id of untested) for (const l of filled) if (lineMatches(l.label, byId.get(id)!.name)) labels.add(l.label);
    for (const label of labels) {
      // Every plain word of the line (not a size like "2.0625in") is in the
      // name of any piece that fits it, so the database narrows by all of
      // them, and every page is read: a big yard can't hide the tested ones.
      const words = [...new Set(lineTokens(label).filter((t) => /^[a-z]+$/.test(t)))];
      if (!words.length) continue;
      const kin: string[] = [];
      // If the database can't answer, the line counts as tested: an untested
      // piece blocks rather than slipping through.
      let failed = false;
      for (let from = 0, pages = 0; pages < 40; pages++) {
        let q = db.from("saas_assets").select("id, name").eq("company_id", company.id).neq("status", "retired");
        for (const w of words) q = q.ilike("name", `%${w}%`);
        const { data: like, error } = await q.order("id").range(from, from + 999);
        if (error) { failed = true; break; }
        const rows = (like ?? []) as { id: string; name: string }[];
        if (!rows.length) break;
        kin.push(...rows.filter((p) => !untested.includes(p.id) && lineMatches(label, p.name)).map((p) => p.id));
        from += rows.length;
      }
      if (failed) { testedLabels.add(label); continue; }
      for (let i = 0; i < kin.length && !testedLabels.has(label); i += 200) {
        const { data: t, error } = await db.from("saas_compliance_items").select("id").eq("company_id", company.id)
          .eq("parent_type", "asset").in("parent_id", kin.slice(i, i + 200)).limit(1);
        if (error || (t ?? []).length) testedLabels.add(label);
      }
    }
  }
  bad.push(...untestedPieces({
    scanned: scannedIds.map((id) => { const a = byId.get(id)!; return { id, name: a.name, serial: a.identifier, category: a.category }; }),
    hasTest, filled, testedCategories: TESTED_CATEGORIES, lineIsTested: (label) => testedLabels.has(label),
  }).filter((p) => byId.get(p.id)!.status !== "out_of_service" && !byId.get(p.id)!.needs_redress_since));
  const redIds = new Set(bad.map((b) => b.id));
  // Each piece's tests as they stood when it went on, kept on the record.
  const testsOf = new Map<string, { title: string; good_until: string | null; result: string; paper: string | null }[]>();
  for (const it of (itemRows ?? []) as Item[]) {
    const list = testsOf.get(it.parent_id) ?? [];
    const j = judgeItem(it, today, today);
    list.push({ title: it.title, good_until: it.expiration_date, result: isNoPaper(j) ? "no_paper" : j.result, paper: it.last_upload_id });
    testsOf.set(it.parent_id, list);
  }

  // The truck's own paper (DOT and the like) counts too.
  const { data: paperRows } = await db.from("saas_compliance_items").select("id, title, parent_id, expiration_date, reminder_days, pending_until, last_upload_id")
    .eq("company_id", company.id).eq("parent_type", "unit").eq("parent_id", unit.id);
  const truckPaper = ((paperRows ?? []) as Item[]).map((it) => ({ it, r: judgeItem(it, today, today) }))
    .filter((x) => x.r.result === "expired" || x.r.result === "missing")
    .map((x) => ({ title: x.it.title, detail: isNoPaper(x.r) ? "has no cert attached" : x.r.detail }));

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

  const v = loadoutVerdict({
    lines: filled,
    bad,
    cantFind: cantFind.map((a) => ({ name: a.name, serial: a.identifier })),
    truckPaper,
    scanned: scans.length,
  });
  // A yard that scans tags only: pressure iron and anything on the list
  // checked by hand (or a scan whose code didn't check out) blocks the truck.
  const handChecked = rules.requireTagScan
    ? scans.filter((x) => x.how === "hand").map((x) => byId.get(x.assetId)!)
        .filter((a) => needsTagScan(a, expected.map((l) => l.label), TESTED_CATEGORIES))
    : [];
  // The photo of the loaded truck is the proof a hand looked at what went on.
  // Required in a real yard unless a manager turned it off; never in the demo.
  const photoPath = await loadoutPhoto(admin, input.photoPath, company.id, unit.id, startedMs, nowMs);
  const needPhoto = rules.requireLoadoutPhoto && !company.is_demo && !photoPath;
  // Roll checks: what the kit and the job's packages ask the hand to confirm
  // before it rolls, from the database, never from the phone.
  const asked = requiredChecks(kit?.roll_checks, ...pkgs.map((x) => x.roll_checks));
  const tapped = new Map((input.checks ?? []).filter((c) => typeof c?.label === "string")
    .map((c) => [c.label.trim().toLowerCase(), typeof c.at === "number" && c.at >= floorMs - 60e3 && c.at <= nowMs + 60e3 ? new Date(c.at).toISOString() : now]));
  const notTapped = missingChecks(asked, [...tapped.keys()]);
  const rollChecks = asked.map((label) => ({ label, ok: tapped.has(label.toLowerCase()), at: tapped.get(label.toLowerCase()) ?? null, by: tapped.has(label.toLowerCase()) ? actor : null }));
  const reasons = [...v.reasons, ...unaccounted.map((a) => `Not scanned: ${label(a)}`),
    ...handChecked.map((a) => `Checked by hand, not scanned off its tag: ${label(a)}`),
    ...notTapped.map((c) => `Not confirmed: ${c}`),
    ...(needPhoto ? ["No photo of the loaded truck"] : [])];
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
    started_at: startedIso, finished_at: now,
    expected: onList + notScanned.length, scanned: onList,
    verdict, reasons, photo_path: photoPath, roll_checks: rollChecks.length ? rollChecks : null,
    job: String(input.job ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || plan?.job || null,
    packages: pkgs.map((x) => x.name),
    plan: plan ? { id: plan.id, by: plan.by, at: plan.at, note: plan.note, packages: pkgs.filter((x) => plan.packageIds.includes(x.id)).map((x) => x.name), lines: plan.lines } : null,
    lines: filled.map((l) => ({ label: l.label, qty: l.qty, source: l.source, ...(l.package ? { package: l.package } : {}), filled: l.filled.map((f) => ({ asset_id: f.id, name: f.name, serial: f.serial })) })),
    pieces: scans.map((s) => { const a = byId.get(s.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, how: s.how, at: s.at, by: actor, added: a.unit_id !== unit.id, red: redIds.has(a.id), tests: testsOf.get(a.id) ?? [] }; }),
    not_scanned: notScanned.map((n) => { const a = byId.get(n.assetId)!; return { asset_id: a.id, name: a.name, serial: a.identifier, outcome: n.outcome }; }),
  }).select("id, proof_token").single();
  if (recErr?.code === "23505") {
    // The same load-out landed a moment ago from a resend: hand that one back.
    const first = await savedLoadout(admin, company.id, user.id, unit.id, startedIso);
    if (first) return first;
  }
  if (recErr || !rec) return { ok: false, error: `Couldn't save the load-out record: ${recErr?.message ?? "unknown"}` };
  const saved = rec as { id: string; proof_token: string };

  // Out on a job: a READY load-out puts what went on out until it's checked
  // back in. A NOT READY one didn't leave (unless a manager overrides it, which
  // starts the clock then). Anything taken off is back in the yard.
  // Pieces a NOT READY save took off the last job and back onto this truck.
  let backOn: string[] = [];
  if (scannedIds.length) {
    // NOT READY: nothing left. A tool still signed out to someone stays out
    // with them (their clock keeps running) until the truck really rolls.
    const resetIds = verdict === "ready" ? scannedIds : scannedIds.filter((id) => !byId.get(id)!.out_with_user);
    if (resetIds.length) await admin.from("saas_assets").update(verdict === "ready"
      ? { out_since: now, out_loadout_id: saved.id, out_alerted_at: null, out_with_user: null, out_with_name: null }
      : { out_since: null, out_loadout_id: null, out_alerted_at: null })
      .eq("company_id", company.id).in("id", resetIds);
    if (verdict !== "ready") backOn = resetIds.filter((id) => stillOut.has(id));
    // A tool signed out to someone that went on a truck that rolled: it's on
    // the truck now, so the sign-out closes.
    const handed = scannedIds.filter((id) => byId.get(id)!.out_with_user);
    if (verdict === "ready" && handed.length) {
      await admin.from("saas_signouts").update({ back_at: now, back_by: actor, back_note: `went out on ${unit.name}` })
        .eq("company_id", company.id).in("asset_id", handed).is("back_at", null);
    }
  }
  const offIds = notScanned.filter((n) => n.outcome === "yard").map((n) => n.assetId);
  if (offIds.length) await admin.from("saas_assets").update({ out_since: null, out_loadout_id: null, out_alerted_at: null }).eq("company_id", company.id).in("id", offIds);
  // Pieces proven scanned off their tag: the tag works.
  const tagged = scans.filter((x) => x.how !== "hand").map((x) => x.assetId);
  if (tagged.length) await admin.from("saas_assets").update({ tag_seen_at: now }).eq("company_id", company.id).in("id", tagged);
  // The truck rolled: the manager's plan for this job is used up.
  if (plan && verdict === "ready") {
    await admin.from("saas_loadout_plans").update({ used_at: now, used_loadout_id: saved.id }).eq("id", plan.id).eq("company_id", company.id).is("used_at", null);
  }

  const summary = verdict === "ready"
    ? `${unit.name} loaded out READY by ${actor}: ${scans.length} ${scans.length === 1 ? "piece" : "pieces"} scanned`
    : `${unit.name} blocked at load-out (NOT READY) by ${actor}: ${reasons.slice(0, 3).join("; ")}${reasons.length > 3 ? `; and ${reasons.length - 3} more` : ""}`;
  void logEvent({ companyId: company.id, kind: verdict === "ready" ? "loadout_ready" : "loadout_blocked", unitId: unit.id, actor, message: summary });
  if (verdict === "not_ready") void notifyEvent({ companyId: company.id, companyName: company.name, yardId: unit.yard_id, message: summary, href: `/app/loadouts/${saved.id}` });

  revalidatePath(`/app/units/${unit.id}`);
  revalidatePath("/app/map");
  revalidatePath("/app");
  // The pieces the records blocked, so "Fix it and scan again" takes them off
  // even when the phone didn't know (a look-alike with no test, say).
  // Pieces on the truck the phone didn't know about (its list was older than
  // the yard's), and the packages the plan added: so "Fix it and scan again"
  // can show them, and the hand can say where they are.
  return { ok: true, summary, id: saved.id, verdict, reasons, proofToken: saved.proof_token, backOn, badIds: [...redIds],
    left: unaccounted.map((a) => ({ id: a.id, name: a.name, serial: a.identifier, category: a.category })), packageIds };
}
