import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_COMPANY_NAME, DEMO_YARD_NAME, DEMO_UNITS, DEMO_YARD_IRON, DEMO_MOVES, DEMO_EVENTS,
  DEMO_MISSES, DEMO_CHECKS, DEMO_ALERTS_SENT, DEMO_WAITING_UPLOAD, DEMO_LOADOUTS, type DemoAsset,
} from "./demo-data";
import { verifyUpload } from "./cert-verify";
import { computeDispatchCheck } from "./dispatch-check";
import { localToday, addDaysIso } from "./status";

/**
 * Seed one private copy of the Caprock demo yard for one visitor — batched
 * (a handful of round trips, not one per row) so the "Open the demo yard"
 * click lands in a couple of seconds. Service-role writes; RLS tenancy is
 * the sandbox. The reaper (alert-watchdog cron) deletes demo companies and
 * their throwaway users after 24h.
 */

// Every date is counted from the yard's own calendar day (Central), the same
// day the status view and the readiness engine use. Counting from the UTC day
// shifted the whole yard by one after 7pm Central: the H2S card that "expired
// yesterday" hadn't expired yet, and the board showed 2 red trucks instead of 3.
const iso = (daysFromNow: number) => addDaysIso(localToday(), daysFromNow);

/** The UTC instant for a Central wall-clock time, n days back. */
const tsAgo = (daysAgo: number, hour: number, minute: number) => {
  const day = addDaysIso(localToday(), -daysAgo);
  const asUtc = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", timeZoneName: "shortOffset" })
    .formatToParts(asUtc).find((p) => p.type === "timeZoneName")?.value ?? "GMT-6";
  const offsetHours = Number(zone.match(/GMT([+-]\d+)/)?.[1] ?? -6);
  // A visitor at 3am shouldn't see this morning's 5am check in the future.
  return new Date(Math.min(asUtc.getTime() - offsetHours * 3600e3, Date.now() - 60e3)).toISOString();
};

export async function seedDemoCompany(admin: SupabaseClient, ownerUserId: string): Promise<string> {
  const { data: co, error: coErr } = await admin.from("saas_companies")
    .insert({ name: DEMO_COMPANY_NAME, subscription_status: "active", comped: true, is_demo: true, yard_quantity: 0 })
    .select("id").single();
  if (coErr) throw new Error(`demo company: ${coErr.message}`);
  const companyId = (co as { id: string }).id;

  const [{ data: yard, error: yErr }, { error: memErr }] = await Promise.all([
    admin.from("saas_yards").insert({ company_id: companyId, name: DEMO_YARD_NAME }).select("id").single(),
    admin.from("saas_memberships").insert({ company_id: companyId, user_id: ownerUserId, role: "owner", status: "active" }),
  ]);
  if (yErr) throw new Error(`demo yard: ${yErr.message}`);
  if (memErr) throw new Error(`demo membership: ${memErr.message}`);
  const yardId = (yard as { id: string }).id;

  await seedDemoYard(admin, companyId, yardId);
  return companyId;
}

/** Everything inside a demo yard: trucks, iron, paper, where it's been, history. */
async function seedDemoYard(admin: SupabaseClient, companyId: string, yardId: string): Promise<void> {
  // Units (one batch; names unique)
  const { data: unitRows, error: uErr } = await admin.from("saas_units")
    .insert(DEMO_UNITS.map((u) => ({ company_id: companyId, yard_id: yardId, name: u.name, type: u.type, identifier: u.identifier ?? null })))
    .select("id, name");
  if (uErr) throw new Error(`units: ${uErr.message}`);
  const unitIdByName = new Map(((unitRows ?? []) as { id: string; name: string }[]).map((r) => [r.name, r.id]));
  const unitId = (key: string) => unitIdByName.get(DEMO_UNITS.find((u) => u.key === key)!.name)!;
  const unitName = (key: string) => DEMO_UNITS.find((u) => u.key === key)!.name;

  // All the iron, on trucks and in the yard, one batch. Every piece has a
  // unique serial (or, for the untested baskets, a unique name).
  const keyOf = (a: DemoAsset) => a.identifier ?? a.name;
  const specs: { a: DemoAsset; unitKey: string | null }[] = [
    ...DEMO_UNITS.flatMap((u) => (u.assets ?? []).map((a) => ({ a, unitKey: u.key }))),
    ...DEMO_YARD_IRON.map((a) => ({ a, unitKey: null })),
  ];
  const { data: assetRows, error: aErr } = await admin.from("saas_assets")
    .insert(specs.map(({ a, unitKey }) => ({
      company_id: companyId, yard_id: yardId, unit_id: unitKey ? unitId(unitKey) : null,
      name: a.name, category: a.category, identifier: a.identifier ?? null, status: a.status ?? "in_service",
      last_seen_where: a.note ?? null,
    })))
    .select("id, name, identifier");
  if (aErr) throw new Error(`assets: ${aErr.message}`);
  const assetIdByKey = new Map(((assetRows ?? []) as { id: string; name: string; identifier: string | null }[])
    .map((r) => [r.identifier ?? r.name, r.id]));

  // Every test and cert, truck paper and iron, one batch.
  const row = (parent_type: string, parent_id: string, it: { title: string; kind: string; exp: number | null; issued?: number }) => ({
    company_id: companyId, parent_type, parent_id, title: it.title, kind: it.kind,
    expiration_date: it.exp === null ? null : iso(it.exp),
    issued_date: it.issued != null ? iso(it.issued) : null,
  });
  const itemRows = [
    ...DEMO_UNITS.flatMap((u) => (u.items ?? []).map((it) => row("unit", unitId(u.key), it))),
    ...specs.flatMap(({ a }) => (a.items ?? []).map((it) => row("asset", assetIdByKey.get(keyOf(a))!, it))),
  ];
  const { data: insertedItems, error: iErr } = await admin.from("saas_compliance_items")
    .insert(itemRows).select("id, parent_type, parent_id, title");
  if (iErr) throw new Error(`items: ${iErr.message}`);
  const itemId = (parentType: string, parentId: string, title: string) =>
    ((insertedItems ?? []) as { id: string; parent_type: string; parent_id: string; title: string }[])
      .find((r) => r.parent_type === parentType && r.parent_id === parentId && r.title === title)?.id ?? null;

  const whereLabel = (k: string) => (k === "yard" ? DEMO_YARD_NAME : `${unitName(k)} · ${DEMO_YARD_NAME}`);

  // Everything below is independent: run it side by side.
  await Promise.all([
    // Where it's been. The database logged "added" for every piece just now;
    // push those back to when the yard started, and give the pieces with a
    // story their real history.
    (async () => {
      const movedIds = [...new Set(DEMO_MOVES.map((m) => assetIdByKey.get(m.serial)).filter((x): x is string => Boolean(x)))];
      if (movedIds.length) await admin.from("saas_asset_moves").delete().eq("company_id", companyId).in("asset_id", movedIds);
      const start = tsAgo(90, 8, 0);
      const firstFrom = new Map<string, string>();
      for (const m of [...DEMO_MOVES].sort((a, b) => b.daysAgo - a.daysAgo)) if (!firstFrom.has(m.serial)) firstFrom.set(m.serial, m.from);
      await Promise.all([
        admin.from("saas_asset_moves").update({ created_at: start }).eq("company_id", companyId).is("from_where", null),
        admin.from("saas_asset_moves").insert([
          ...[...firstFrom].map(([serial, from]) => ({
            company_id: companyId, asset_id: assetIdByKey.get(serial)!, from_where: null, to_where: whereLabel(from), created_at: start,
          })),
          ...DEMO_MOVES.map((m) => ({
            company_id: companyId, asset_id: assetIdByKey.get(m.serial)!, from_where: whereLabel(m.from), to_where: whereLabel(m.to),
            note: m.note ?? null, actor: m.by, created_at: tsAgo(m.daysAgo, m.hour, 0),
          })),
        ]),
      ]);
    })(),

    // Load-outs scanned at the truck: each piece on these trucks was proven
    // on by a tag scan. Service-role writes, so the times can be in the past.
    (async () => {
      for (const lo of DEMO_LOADOUTS) {
        const unit = DEMO_UNITS.find((u) => u.key === lo.unitKey)!;
        const onTruck = (unit.assets ?? []).filter((a) => a.status !== "retired");
        const ids = onTruck.map((a) => assetIdByKey.get(keyOf(a))!).filter(Boolean);
        const at = tsAgo(lo.daysAgo, lo.hour, lo.minute);
        const day = new Date(at).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric" });
        await Promise.all([
          admin.from("saas_assets").update({ scanned_at: at, scanned_by: lo.by, scanned_unit_id: unitId(lo.unitKey) }).in("id", ids),
          admin.from("saas_loadout_scans").insert({
            company_id: companyId, unit_id: unitId(lo.unitKey), unit_name: unit.name, scanned_by: lo.by,
            started_at: at, finished_at: at, expected: onTruck.length, scanned: onTruck.length,
            pieces: onTruck.map((a) => ({ asset_id: assetIdByKey.get(keyOf(a)), name: a.name, serial: a.identifier ?? null, how: lo.how, added: false })),
            not_scanned: [],
          }),
          admin.from("saas_asset_moves").insert(ids.map((id) => ({
            company_id: companyId, asset_id: id, from_where: whereLabel(lo.unitKey), to_where: whereLabel(lo.unitKey),
            note: `scanned at load-out ${day}`, actor: lo.by, created_at: at,
          }))),
          admin.from("saas_events").insert({
            company_id: companyId, kind: "loadout_scanned", unit_id: unitId(lo.unitKey), actor: lo.by, created_at: at,
            message: `${unit.name} load-out: ${onTruck.length} scanned`,
          }),
        ]);
      }
    })(),

    // Activity feed + the month's two caught misses (append-only, insert only)
    admin.from("saas_events").insert([
      ...DEMO_EVENTS.map((e) => ({
        company_id: companyId, kind: e.kind, message: e.message, actor: e.actor,
        created_at: tsAgo(e.daysAgo, e.hour, e.minute),
      })),
      ...DEMO_MISSES.map((m) => ({
        company_id: companyId, kind: "miss_caught", message: m.message, actor: null,
        created_at: tsAgo(m.daysAgo, m.hour, 0),
      })),
    ]),

    // The upload waiting on the manager (see DEMO_WAITING_UPLOAD). Best effort:
    // a demo yard without it still works, it just shows one less rule.
    (async () => {
      try {
        const w = DEMO_WAITING_UPLOAD;
        const bopSpec = DEMO_UNITS.find((u) => u.key === w.unitKey)!.assets!.find((a) => a.name === w.assetName)!;
        const assetId = assetIdByKey.get(keyOf(bopSpec));
        const itemRowId = assetId ? itemId("asset", assetId, w.itemTitle) : null;
        if (!assetId || !itemRowId) return;
        const { readFile } = await import("node:fs/promises");
        const path = await import("node:path");
        const { createHash } = await import("node:crypto");
        const bytes = await readFile(path.join(process.cwd(), w.image));
        const storagePath = `${companyId}/cert/${itemRowId}/demo-bop-cert.jpg`;
        const { error: upErr } = await admin.storage.from("proofs").upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
        if (upErr) return;
        const prev = iso(bopSpec.items![0].exp as number);
        const typed = iso(w.typedExpirationDays);
        const v = verifyUpload({
          evidence: "cert", claimedExpiration: typed, claimedIssued: null, today: localToday(),
          readText: w.paperText, itemTitle: w.itemTitle, holderName: null, identifier: bopSpec.identifier ?? null,
          prevExpiration: prev, itemWasFailing: true, sameHashOn: [],
        });
        const { data: up } = await admin.from("saas_cert_uploads").insert({
          company_id: companyId, item_id: itemRowId, uploaded_by: null, uploaded_by_name: w.by, uploaded_by_role: "member",
          created_at: tsAgo(0, w.hour, w.minute), storage_path: storagePath, content_type: "image/jpeg",
          sha256: createHash("sha256").update(bytes).digest("hex"), evidence: "cert",
          claimed_expiration: typed, claimed_issued: v.issued, prev_expiration: prev,
          read_ok: true, read_dates: v.readDates, read_excerpt: w.paperText.replace(/\s+/g, " ").slice(0, 600),
          checks: v.checks, flags: v.flags, verdict: v.verdict, status: "waiting",
        }).select("id").single();
        if (!up) return;
        const why = v.checks.find((c) => !c.ok)?.detail.replace(/\.+$/, "") ?? "The software couldn't check it";
        await Promise.all([
          admin.from("saas_compliance_items").update({ waiting_upload_id: (up as { id: string }).id }).eq("id", itemRowId),
          admin.from("saas_events").insert({
            company_id: companyId, kind: "upload_waiting", actor: w.by, unit_id: unitId(w.unitKey),
            message: `${w.itemTitle} (${w.assetName}): ${w.by} uploaded a new cert. Waiting on a manager. ${why}.`,
            created_at: tsAgo(0, w.hour, w.minute),
          }),
        ]);
      } catch (e) {
        console.error("[demo-seed] waiting upload skipped:", e instanceof Error ? e.message : e);
      }
    })(),

    // Immutable check records for each truck's history. Each record gets its
    // lines from the same check a visitor can run, so "NOT READY" on a record
    // always says why. Only where today's answer matches what was recorded
    // (an old red record for a truck that's been fixed since keeps no lines
    // rather than showing green lines under red).
    (async () => {
      const { data: checkRows } = await admin.from("saas_dispatch_checks").insert(DEMO_CHECKS.map((c) => ({
        company_id: companyId, unit_id: unitId(c.unitKey), type: "checkout",
        status: c.status, performed_by_name: c.by, started_at: tsAgo(c.daysAgo, c.hour, c.minute),
      }))).select("id, unit_id, status");
      await Promise.all(((checkRows ?? []) as { id: string; unit_id: string; status: string }[]).map(async (r) => {
        const comp = await computeDispatchCheck(admin, companyId, r.unit_id);
        if (!comp || comp.verdict !== r.status || comp.lines.length === 0) return;
        await admin.from("saas_dispatch_check_items").insert(comp.lines.map((l) => ({
          check_id: r.id, company_id: companyId, source_type: l.source_type, source_id: l.source_id,
          label: l.label, result: l.result, note: l.detail ?? null,
        })));
      }));
    })(),

    // Sent-alert receipts for Tests due
    (async () => {
      const sentRows = DEMO_ALERTS_SENT.map((a) => {
        const id = a.serial
          ? itemId("asset", assetIdByKey.get(a.serial) ?? "", a.itemTitle)
          : itemId("unit", unitId(a.unitKey!), a.itemTitle);
        return id ? {
          company_id: companyId, compliance_item_id: id, channel: "email",
          recipient: "yard dispatch (demo)", sent_at: tsAgo(a.daysAgo, 6, 30),
        } : null;
      }).filter((r): r is NonNullable<typeof r> => r !== null);
      if (sentRows.length) await admin.from("saas_alerts_sent").insert(sentRows);
    })(),
  ]);
}

/** The proof link on /demo. Its yard is re-seeded daily so it tells the same story as a fresh demo. */
export const SHOWCASE_PROOF_TOKEN = "c7aae8c1e1a64d5eab617b46990f43932d78";

// Child tables, children first (not everything cascades). The company row,
// its members, and its proof links are kept: the reaper deletes those too,
// a refresh must not.
const YARD_TABLES = [
  "saas_alerts_sent", "saas_asset_moves", "saas_loadout_scans", "saas_events", "saas_dispatch_check_items", "saas_dispatch_check_crew",
  "saas_dispatch_checks", "saas_readiness_snapshots", "saas_attachments",
  "saas_doc_requests", "saas_item_customers", "saas_customers", "saas_cert_uploads", "saas_compliance_items",
  "saas_unit_crew", "saas_assets", "saas_units", "saas_yards",
];

/**
 * Re-seed the showcase yard in place (same company, same proof link). A
 * one-time seed ages: by late September the August seed showed ten lapsed
 * items, and the /demo page promised "CT-03's expired BOP test". Never
 * touches a company that isn't the showcase.
 */
export async function refreshShowcase(admin: SupabaseClient): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: proof } = await admin.from("saas_readiness_proofs")
      .select("company_id, scope, revoked_at").eq("token", SHOWCASE_PROOF_TOKEN).maybeSingle();
    const p = proof as { company_id: string; scope: string; revoked_at: string | null } | null;
    if (!p || p.revoked_at || p.scope !== "company") return { ok: false, error: "showcase proof link missing or revoked" };
    const { data: co } = await admin.from("saas_companies").select("id, name, subscription_status").eq("id", p.company_id).maybeSingle();
    const c = co as { id: string; name: string; subscription_status: string } | null;
    // A paying customer's company must never be wiped by this, whatever the token says.
    if (!c || c.name !== DEMO_COMPANY_NAME || c.subscription_status === "active") return { ok: false, error: "showcase company doesn't look like the showcase" };
    for (const t of YARD_TABLES) await admin.from(t).delete().eq("company_id", c.id);
    await removeStorageFolder(admin, c.id);
    const { data: yard, error: yErr } = await admin.from("saas_yards")
      .insert({ company_id: c.id, name: DEMO_YARD_NAME }).select("id").single();
    if (yErr || !yard) return { ok: false, error: `showcase yard: ${yErr?.message}` };
    await seedDemoYard(admin, c.id, (yard as { id: string }).id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Delete everything a company has in the proofs bucket (folders nest a few deep). */
async function removeStorageFolder(admin: SupabaseClient, prefix: string, depth = 0): Promise<void> {
  if (depth > 4) return;
  const bucket = admin.storage.from("proofs");
  const { data } = await bucket.list(prefix, { limit: 1000 });
  const entries = (data ?? []) as { name: string; id: string | null }[];
  const files = entries.filter((e) => e.id).map((e) => `${prefix}/${e.name}`);
  if (files.length) await bucket.remove(files);
  for (const dir of entries.filter((e) => !e.id)) await removeStorageFolder(admin, `${prefix}/${dir.name}`, depth + 1);
}

/** Reap demo companies (and their throwaway users) older than maxAgeHours. */
export async function cleanupDemoCompanies(admin: SupabaseClient, maxAgeHours = 24): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  const cutoff = new Date(Date.now() - maxAgeHours * 3600e3).toISOString();
  const { data: stale, error } = await admin.from("saas_companies")
    .select("id").eq("is_demo", true).lt("created_at", cutoff);
  if (error) return { deleted: 0, errors: [`demo cleanup query: ${error.message}`] };
  let deleted = 0;
  for (const row of (stale ?? []) as { id: string }[]) {
    const cid = row.id;
    try {
      const { data: members } = await admin.from("saas_memberships").select("user_id").eq("company_id", cid);
      // Child tables first (not everything cascades), company last, users after.
      const tables = [
        "saas_alerts_sent", "saas_loadout_scans", "saas_events", "saas_dispatch_check_items", "saas_dispatch_check_crew",
        "saas_dispatch_checks", "saas_readiness_snapshots", "saas_readiness_proofs", "saas_attachments",
        "saas_doc_requests", "saas_item_customers", "saas_customers", "saas_cert_uploads", "saas_compliance_items",
        "saas_unit_crew", "saas_assets", "saas_units", "saas_yards", "saas_alert_recipients",
        "saas_notification_settings", "saas_enforcement_settings", "saas_invitations", "saas_memberships",
      ];
      for (const t of tables) await admin.from(t).delete().eq("company_id", cid);
      await admin.from("saas_companies").delete().eq("id", cid);
      await removeStorageFolder(admin, cid); // visitors' uploaded photos
      for (const m of (members ?? []) as { user_id: string }[]) {
        await admin.auth.admin.deleteUser(m.user_id).catch(() => {});
      }
      deleted++;
    } catch (e) {
      errors.push(`demo cleanup ${cid}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { deleted, errors };
}
