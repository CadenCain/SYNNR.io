"use server";

import { revalidatePath } from "next/cache";
import { requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { logEvent, notifyEvent } from "@/lib/saas/notify";
import { fmtWhen } from "@/lib/saas/format";
import { getOpenPlan, markPlansUsed } from "@/lib/saas/plans";
import { getYardRules } from "@/lib/saas/yard-rules";
import { photoPathOk } from "@/lib/saas/loadout-photo";
import { requiredChecks, missingChecks } from "@/lib/saas/roll-checks";
import { quickLines, quickKey, quickVerdict } from "@/lib/saas/quick-check";

/**
 * The quick check: the hand taps "On truck" on the truck's short list (its
 * kit, plus the job's list if one was picked or planned), taps the checks
 * like "BOP rams closed for travel", takes one photo, and taps Ready. The
 * list comes from the database, never the phone: the phone only says which
 * lines are on. The record locks with who said so, and when.
 */

const actorOf = (user: { user_metadata?: { full_name?: string }; email?: string | null }) =>
  user.user_metadata?.full_name?.trim() || user.email?.split("@")[0] || "someone";

export type QuickResult = { ok: boolean; error?: string; stale?: boolean; id?: string; verdict?: "ready" | "not_ready"; reasons?: string[]; proofToken?: string; summary?: string };

export async function finishQuickCheck(input: {
  unitId: string;
  startedAt: string;
  /** Job lists the hand picked (the plan's are added by the server). */
  packageIds?: string[];
  /** Lines the hand said are on the truck, by quickKey, and how many. */
  confirmed: Record<string, number>;
  /** The checks the hand tapped. */
  checks?: string[];
  photoPath?: string;
  job?: string;
  /** When the hand tapped Ready on the phone (ms). */
  savedAt?: number;
}): Promise<QuickResult> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Your taps are still on this phone." };

  const { data: unitRow } = await db.from("saas_units").select("id, name, yard_id").eq("id", String(input.unitId ?? "")).eq("company_id", company.id).maybeSingle();
  const unit = unitRow as { id: string; name: string; yard_id: string | null } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };

  const startedMs = Date.parse(String(input.startedAt ?? ""));
  if (!Number.isFinite(startedMs)) return { ok: false, error: "Start the check again from the truck." };
  const startedIso = new Date(startedMs).toISOString();
  // A resend after a dropped signal gets the first record back, not a second one.
  const { data: firstRow } = await admin.from("saas_loadout_scans").select("id, proof_token, verdict, reasons")
    .eq("company_id", company.id).eq("scanned_by_user", user.id).eq("unit_id", unit.id).eq("started_at", startedIso).maybeSingle();
  const first = firstRow as { id: string; proof_token: string; verdict: "ready" | "not_ready"; reasons: string[] | null } | null;
  if (first) return { ok: true, id: first.id, verdict: first.verdict, reasons: first.reasons ?? [], proofToken: first.proof_token };
  if (startedMs < Date.now() - 20 * 3600e3 || startedMs > Date.now() + 10 * 60e3) {
    return { ok: false, stale: true, error: "This check was started too long ago to save. Start it again from the truck." };
  }
  // Someone else checked this truck after this phone started (or it rolled
  // READY since): this one would rewrite a truck that's already gone.
  const { data: newerRow } = await admin.from("saas_loadout_scans").select("scanned_by, scanned_by_user, finished_at, verdict")
    .eq("company_id", company.id).eq("unit_id", unit.id).gt("finished_at", startedIso).order("finished_at", { ascending: false }).limit(20);
  const newer = ((newerRow ?? []) as { scanned_by: string | null; scanned_by_user: string | null; finished_at: string; verdict: string | null }[])
    .find((r) => r.verdict === "ready" || r.scanned_by_user !== user.id);
  if (newer) {
    const who = newer.scanned_by_user === user.id ? "You" : newer.scanned_by || "Someone";
    return { ok: false, stale: true, error: `${who} already checked ${unit.name} ${fmtWhen(newer.finished_at)} (${newer.verdict === "ready" ? "READY" : "NOT READY"}). Start a new check from the truck.` };
  }

  // The list, from the database: the truck's kit, the job lists picked or
  // planned, and the plan's extra lines.
  const [plan, rules] = await Promise.all([getOpenPlan(db, company.id, unit.id), getYardRules(db, company.id)]);
  const asked = [...new Set([...(input.packageIds ?? []).filter((x) => typeof x === "string").slice(0, 10), ...(plan?.packageIds ?? [])])];
  const [{ data: kitRow }, { data: pkgRows }] = await Promise.all([
    db.from("saas_packages").select("id, name, roll_checks, saas_package_lines(label, qty, sort)").eq("company_id", company.id).eq("unit_id", unit.id).maybeSingle(),
    asked.length
      ? db.from("saas_packages").select("id, name, roll_checks, saas_package_lines(label, qty, sort)").eq("company_id", company.id).is("unit_id", null).in("id", asked)
      : Promise.resolve({ data: [] }),
  ]);
  type Pkg = { id: string; name: string; roll_checks: string[] | null; saas_package_lines: { label: string; qty: number; sort: number }[] | null };
  const linesOf = (p: Pkg | null) => [...(p?.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => ({ label: l.label, qty: l.qty }));
  const kit = kitRow as Pkg | null;
  const pkgs = (pkgRows ?? []) as Pkg[];
  const lines = quickLines({ kit: linesOf(kit), packages: pkgs.map((p) => ({ name: p.name, lines: linesOf(p) })), planned: plan?.lines ?? [] });

  const now = new Date().toISOString();
  const nowMs = Date.parse(now);
  const confirmed = input.confirmed && typeof input.confirmed === "object" ? input.confirmed : {};
  // When the hand tapped Ready, kept honest: never before the check started, never in the future.
  const savedMs = typeof input.savedAt === "number" && input.savedAt >= startedMs - 60e3 && input.savedAt <= nowMs + 60e3 ? Math.min(input.savedAt, nowMs) : nowMs;
  const tappedAt = new Date(savedMs).toISOString();
  const asks = requiredChecks(kit?.roll_checks, ...pkgs.map((p) => p.roll_checks));
  const tapped = (input.checks ?? []).filter((c) => typeof c === "string").map((c) => c.trim().toLowerCase());
  const notTapped = missingChecks(asks, tapped);

  // The photo of the loaded truck: this check's, really in storage, and on no other record.
  let photoPath: string | null = null;
  if (photoPathOk(input.photoPath, company.id, unit.id, startedMs, nowMs)) {
    const [{ error }, { data: used }] = await Promise.all([
      admin.storage.from("proofs").createSignedUrl(input.photoPath, 60),
      admin.from("saas_loadout_scans").select("id").eq("company_id", company.id).eq("photo_path", input.photoPath).limit(1),
    ]);
    if (!error && !(used ?? []).length) photoPath = input.photoPath;
  }
  const needPhoto = rules.requireLoadoutPhoto && !company.is_demo && !photoPath;

  const recLines = lines.map((l) => {
    const n = Math.max(0, Math.min(l.qty, Math.floor(Number(confirmed[quickKey(l)]) || 0)));
    return { label: l.label, qty: l.qty, source: l.source, ...(l.package ? { package: l.package } : {}), filled: [], confirmed: { n, by: n ? actor : null, at: n ? tappedAt : null } };
  });
  const { verdict, reasons } = quickVerdict({
    lines: recLines.map((l) => ({ label: l.label, qty: l.qty, n: l.confirmed.n })),
    notTapped, needPhoto, empty: lines.length === 0,
  });

  const { data: rec, error: recErr } = await admin.from("saas_loadout_scans").insert({
    company_id: company.id, unit_id: unit.id, unit_name: unit.name, yard_id: unit.yard_id,
    scanned_by: actor, scanned_by_user: user.id, started_at: startedIso, finished_at: now,
    expected: recLines.reduce((n, l) => n + l.qty, 0), scanned: recLines.reduce((n, l) => n + l.confirmed.n, 0),
    verdict, reasons, photo_path: photoPath, check_mode: "quick", phone_saved_at: tappedAt,
    roll_checks: asks.length ? asks.map((label) => { const ok = tapped.includes(label.toLowerCase()); return { label, ok, at: ok ? tappedAt : null, by: ok ? actor : null }; }) : null,
    job: String(input.job ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || plan?.job || null,
    packages: pkgs.map((p) => p.name),
    plan: plan ? { id: plan.id, by: plan.by, at: plan.at, note: plan.note, packages: pkgs.filter((p) => plan.packageIds.includes(p.id)).map((p) => p.name), lines: plan.lines } : null,
    lines: recLines, pieces: [], not_scanned: [],
  }).select("id, proof_token").single();
  if (recErr?.code === "23505") {
    const { data: again } = await admin.from("saas_loadout_scans").select("id, proof_token, verdict, reasons")
      .eq("company_id", company.id).eq("scanned_by_user", user.id).eq("unit_id", unit.id).eq("started_at", startedIso).maybeSingle();
    const a = again as { id: string; proof_token: string; verdict: "ready" | "not_ready"; reasons: string[] | null } | null;
    if (a) return { ok: true, id: a.id, verdict: a.verdict, reasons: a.reasons ?? [], proofToken: a.proof_token };
  }
  if (recErr || !rec) return { ok: false, error: `Couldn't save the check: ${recErr?.message ?? "unknown"}` };
  const saved = rec as { id: string; proof_token: string };

  // It rolled: the plan for this job is used up, and an old one nobody cleared too.
  if (verdict === "ready") await markPlansUsed(admin, company.id, unit.id, saved.id, [plan?.id], now);

  const on = recLines.reduce((n, l) => n + l.confirmed.n, 0);
  const summary = verdict === "ready"
    ? `${unit.name} checked READY by ${actor}: ${on} ${on === 1 ? "thing" : "things"} on the truck`
    : `${unit.name} NOT READY at its check by ${actor}: ${reasons.slice(0, 3).join("; ")}${reasons.length > 3 ? `; and ${reasons.length - 3} more` : ""}`;
  void logEvent({ companyId: company.id, kind: verdict === "ready" ? "loadout_ready" : "loadout_blocked", unitId: unit.id, actor, message: summary });
  if (verdict === "not_ready") void notifyEvent({ companyId: company.id, companyName: company.name, yardId: unit.yard_id ?? undefined, message: summary, href: `/app/loadouts/${saved.id}` });
  revalidatePath(`/app/units/${unit.id}`);
  revalidatePath("/app");
  return { ok: true, id: saved.id, verdict, reasons, proofToken: saved.proof_token, summary };
}

/**
 * The truck is back in the yard. In the quick check there's no iron to check
 * in one piece at a time: one tap ends the trip, with a name and a time.
 */
export async function truckBack(input: { unitId: string; key: string }): Promise<{ ok: boolean; error?: string }> {
  const { company, user } = await requireBillableCompany();
  const actor = actorOf(user);
  const db = await saasDb();
  const admin = saasAdmin();
  if (!admin) return { ok: false, error: "Saving is down right now. Try again in a minute." };
  const { data: unitRow } = await db.from("saas_units").select("id, name, yard_id").eq("id", String(input.unitId ?? "")).eq("company_id", company.id).maybeSingle();
  const unit = unitRow as { id: string; name: string; yard_id: string | null } | null;
  if (!unit) return { ok: false, error: "That truck isn't in your account." };
  // The key is the time the screen showed the button: a second tap or a resend is the same check-in.
  const startedMs = Date.parse(String(input.key ?? ""));
  const startedIso = new Date(Number.isFinite(startedMs) && Math.abs(Date.now() - startedMs) < 20 * 3600e3 ? startedMs : Date.now()).toISOString();
  const { error } = await admin.from("saas_returns").insert({
    company_id: company.id, yard_id: unit.yard_id, unit_id: unit.id, unit_name: unit.name,
    returned_by: actor, returned_by_user: user.id, started_at: startedIso, finished_at: new Date().toISOString(), pieces: [], not_returned: [],
  });
  if (error && error.code !== "23505") return { ok: false, error: `Couldn't save that: ${error.message}` };
  if (!error) void logEvent({ companyId: company.id, kind: "returned", unitId: unit.id, actor, message: `${unit.name} is back in the yard (${actor})` });
  revalidatePath("/app");
  revalidatePath(`/app/units/${unit.id}`);
  return { ok: true };
}
