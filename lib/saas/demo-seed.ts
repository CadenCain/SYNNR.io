import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_COMPANY_NAME, DEMO_YARD_NAME, DEMO_UNITS, DEMO_CREW, DEMO_EVENTS,
  DEMO_MISSES, DEMO_CHECKS, DEMO_SNAPSHOTS, DEMO_ALERTS_SENT, DEMO_WAITING_UPLOAD,
} from "./demo-data";
import { verifyUpload } from "./cert-verify";
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

  const { data: yard, error: yErr } = await admin.from("saas_yards")
    .insert({ company_id: companyId, name: DEMO_YARD_NAME }).select("id").single();
  if (yErr) throw new Error(`demo yard: ${yErr.message}`);
  const yardId = (yard as { id: string }).id;

  const { error: memErr } = await admin.from("saas_memberships")
    .insert({ company_id: companyId, user_id: ownerUserId, role: "owner", status: "active" });
  if (memErr) throw new Error(`demo membership: ${memErr.message}`);

  await seedDemoYard(admin, companyId, yardId);
  return companyId;
}

/** Everything inside a demo yard: crew, trucks, gear, paper, history. */
async function seedDemoYard(admin: SupabaseClient, companyId: string, yardId: string): Promise<void> {

  // Crew (one batch; names are unique in the dataset → map ids by name)
  const { data: crewRows, error: cErr } = await admin.from("saas_crew_members")
    .insert(DEMO_CREW.map((c) => ({ company_id: companyId, name: c.name, role: c.role, status: "active" })))
    .select("id, name");
  if (cErr) throw new Error(`crew: ${cErr.message}`);
  const crewIdByName = new Map(((crewRows ?? []) as { id: string; name: string }[]).map((r) => [r.name, r.id]));
  const crewId = (key: string) => crewIdByName.get(DEMO_CREW.find((c) => c.key === key)!.name)!;

  // Units (one batch; names unique)
  const { data: unitRows, error: uErr } = await admin.from("saas_units")
    .insert(DEMO_UNITS.map((u) => ({ company_id: companyId, yard_id: yardId, name: u.name, type: u.type, identifier: u.identifier ?? null })))
    .select("id, name");
  if (uErr) throw new Error(`units: ${uErr.message}`);
  const unitIdByName = new Map(((unitRows ?? []) as { id: string; name: string }[]).map((r) => [r.name, r.id]));
  const unitId = (key: string) => unitIdByName.get(DEMO_UNITS.find((u) => u.key === key)!.name)!;

  // Assets (one batch; map back by unit_id + name)
  const assetSpecs = DEMO_UNITS.flatMap((u) => (u.assets ?? []).map((a) => ({ unitKey: u.key, a })));
  const { data: assetRows, error: aErr } = await admin.from("saas_assets")
    .insert(assetSpecs.map(({ unitKey, a }) => ({
      company_id: companyId, yard_id: yardId, unit_id: unitId(unitKey),
      name: a.name, category: a.category, identifier: a.identifier ?? null, status: a.status ?? "in_service",
    })))
    .select("id, name, unit_id");
  if (aErr) throw new Error(`assets: ${aErr.message}`);
  const assetIdByKey = new Map(((assetRows ?? []) as { id: string; name: string; unit_id: string }[]).map((r) => [`${r.unit_id}|${r.name}`, r.id]));

  // Every compliance item — crew cards + unit certs + asset certs — one batch.
  const itemRows = [
    ...DEMO_CREW.flatMap((c) => c.cards.map((card) => ({
      company_id: companyId, parent_type: "crew", parent_id: crewId(c.key),
      title: card.title, kind: card.kind,
      expiration_date: card.exp === null ? null : iso(card.exp),
      issued_date: card.issued != null ? iso(card.issued) : null,
    }))),
    ...DEMO_UNITS.flatMap((u) => (u.items ?? []).map((it) => ({
      company_id: companyId, parent_type: "unit", parent_id: unitId(u.key),
      title: it.title, kind: it.kind,
      expiration_date: it.exp === null ? null : iso(it.exp),
      issued_date: it.issued != null ? iso(it.issued) : null,
    }))),
    ...DEMO_UNITS.flatMap((u) => (u.assets ?? []).flatMap((a) => (a.items ?? []).map((it) => ({
      company_id: companyId, parent_type: "asset", parent_id: assetIdByKey.get(`${unitId(u.key)}|${a.name}`)!,
      title: it.title, kind: it.kind,
      expiration_date: it.exp === null ? null : iso(it.exp),
      issued_date: it.issued != null ? iso(it.issued) : null,
    })))),
  ];
  const { data: insertedItems, error: iErr } = await admin.from("saas_compliance_items")
    .insert(itemRows).select("id, parent_type, parent_id, title");
  if (iErr) throw new Error(`items: ${iErr.message}`);
  const itemId = (parentType: string, parentId: string, title: string) =>
    ((insertedItems ?? []) as { id: string; parent_type: string; parent_id: string; title: string }[])
      .find((r) => r.parent_type === parentType && r.parent_id === parentId && r.title === title)?.id ?? null;

  // Crew assignments
  const ucRows = DEMO_UNITS.flatMap((u) => (u.crew ?? []).map((ck) => ({
    company_id: companyId, unit_id: unitId(u.key), crew_member_id: crewId(ck),
  })));
  if (ucRows.length) {
    const { error } = await admin.from("saas_unit_crew").insert(ucRows);
    if (error) throw new Error(`unit crew: ${error.message}`);
  }

  // Activity feed + the month's two caught misses (append-only, insert only)
  await admin.from("saas_events").insert([
    ...DEMO_EVENTS.map((e) => ({
      company_id: companyId, kind: e.kind, message: e.message, actor: e.actor,
      created_at: tsAgo(e.daysAgo, e.hour, e.minute),
    })),
    ...DEMO_MISSES.map((m) => ({
      company_id: companyId, kind: "miss_caught", message: m.message, actor: null,
      created_at: tsAgo(m.daysAgo, m.hour, 0),
    })),
  ]);

  // The upload waiting on the manager (see DEMO_WAITING_UPLOAD). Best effort:
  // a demo yard without it still works, it just shows one less rule.
  try {
    const w = DEMO_WAITING_UPLOAD;
    const assetId = assetIdByKey.get(`${unitId(w.unitKey)}|${w.assetName}`);
    const itemRowId = assetId ? itemId("asset", assetId, w.itemTitle) : null;
    if (assetId && itemRowId) {
      const { readFile } = await import("node:fs/promises");
      const path = await import("node:path");
      const { createHash } = await import("node:crypto");
      const bytes = await readFile(path.join(process.cwd(), w.image));
      const storagePath = `${companyId}/cert/${itemRowId}/demo-bop-cert.jpg`;
      const { error: upErr } = await admin.storage.from("proofs").upload(storagePath, bytes, { contentType: "image/jpeg", upsert: true });
      if (!upErr) {
        const bopItem = DEMO_UNITS.find((u) => u.key === w.unitKey)!.assets!.find((a) => a.name === w.assetName)!;
        const prev = iso(bopItem.items![0].exp as number);
        const typed = iso(w.typedExpirationDays);
        const v = verifyUpload({
          evidence: "cert", claimedExpiration: typed, claimedIssued: null, today: localToday(),
          readText: w.paperText, itemTitle: w.itemTitle, holderName: null, identifier: bopItem.identifier ?? null,
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
        if (up) {
          await admin.from("saas_compliance_items").update({ waiting_upload_id: (up as { id: string }).id }).eq("id", itemRowId);
          const why = v.checks.find((c) => !c.ok)?.detail.replace(/\.+$/, "") ?? "The software couldn't check it";
          await admin.from("saas_events").insert({
            company_id: companyId, kind: "upload_waiting", actor: w.by, unit_id: unitId(w.unitKey),
            message: `${w.itemTitle} (${w.assetName}): ${w.by} uploaded a new cert. Waiting on a manager. ${why}.`,
            created_at: tsAgo(0, w.hour, w.minute),
          });
        }
      }
    }
  } catch (e) {
    console.error("[demo-seed] waiting upload skipped:", e instanceof Error ? e.message : e);
  }

  // Immutable check records → dispatch history + the month tape
  await admin.from("saas_dispatch_checks").insert(DEMO_CHECKS.map((c) => ({
    company_id: companyId, unit_id: unitId(c.unitKey), type: "checkout",
    status: c.status, performed_by_name: c.by, started_at: tsAgo(c.daysAgo, c.hour, c.minute),
  })));

  // 14 days of readiness history for the trend chart
  await admin.from("saas_readiness_snapshots").insert(DEMO_SNAPSHOTS.map((s) => ({
    company_id: companyId, day: iso(-s.daysAgo), readiness: s.readiness, misses_caught: s.misses,
  })));

  // Sent-alert receipts for Compliance & Logs
  const sentRows = DEMO_ALERTS_SENT.map((a) => {
    const id = a.unitKey
      ? (itemId("unit", unitId(a.unitKey), a.itemTitle) ?? itemId("asset", assetIdByKey.get(`${unitId(a.unitKey)}|Lubricator #1`) ?? "", a.itemTitle))
      : itemId("crew", crewId(a.crewKey!), a.itemTitle);
    return id ? {
      company_id: companyId, compliance_item_id: id, channel: "email",
      recipient: "yard dispatch (demo)", sent_at: tsAgo(a.daysAgo, 6, 30),
    } : null;
  }).filter((r): r is NonNullable<typeof r> => r !== null);
  if (sentRows.length) await admin.from("saas_alerts_sent").insert(sentRows);
}

/** The proof link on /demo. Its yard is re-seeded daily so it tells the same story as a fresh demo. */
export const SHOWCASE_PROOF_TOKEN = "c7aae8c1e1a64d5eab617b46990f43932d78";

// Child tables, children first (not everything cascades). The company row,
// its members, and its proof links are kept: the reaper deletes those too,
// a refresh must not.
const YARD_TABLES = [
  "saas_alerts_sent", "saas_events", "saas_dispatch_check_items", "saas_dispatch_check_crew",
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
        "saas_alerts_sent", "saas_events", "saas_dispatch_check_items", "saas_dispatch_check_crew",
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
