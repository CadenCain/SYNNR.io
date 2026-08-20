import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_COMPANY_NAME, DEMO_YARD_NAME, DEMO_UNITS, DEMO_CREW, DEMO_EVENTS,
  DEMO_MISSES, DEMO_CHECKS, DEMO_SNAPSHOTS, DEMO_ALERTS_SENT,
} from "./demo-data";

/**
 * Seed one private copy of the Caprock demo yard for one visitor — batched
 * (a handful of round trips, not one per row) so the "Open the demo yard"
 * click lands in a couple of seconds. Service-role writes; RLS tenancy is
 * the sandbox. The reaper (alert-watchdog cron) deletes demo companies and
 * their throwaway users after 24h.
 */

const iso = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};
const tsAgo = (daysAgo: number, hour: number, minute: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
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
      name: a.name, category: a.category, status: a.status ?? "in_service",
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

  return companyId;
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
        "saas_doc_requests", "saas_item_customers", "saas_customers", "saas_compliance_items",
        "saas_unit_crew", "saas_assets", "saas_units", "saas_yards", "saas_alert_recipients",
        "saas_notification_settings", "saas_enforcement_settings", "saas_invitations", "saas_memberships",
      ];
      for (const t of tables) await admin.from(t).delete().eq("company_id", cid);
      await admin.from("saas_companies").delete().eq("id", cid);
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
