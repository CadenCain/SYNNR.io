import type { saasAdmin } from "@/lib/saas/db";
import { getLoadout, selectRecord, type LoadoutRecord, type LoadoutOverride } from "@/lib/saas/loadout-record";
import { SHOWCASE_PROOF_TOKEN } from "@/lib/saas/demo-seed";

type Admin = NonNullable<ReturnType<typeof saasAdmin>>;
export type PublicRecord = { rec: LoadoutRecord; override: LoadoutOverride | null };

/**
 * The record behind a /l/ link, the same way for the page and for the paper
 * and photo links on it: a bad token is nothing, and a link the shop shut off
 * is "off" (so the certs and the photo on it stop opening too).
 */
export async function loadPublicRecord(admin: Admin, token: string): Promise<PublicRecord | "off" | null> {
  const got = token === "showcase" ? await showcaseLoadout(admin)
    : /^[a-f0-9]{32}$/i.test(token) ? await getLoadout(admin, { token: token.toLowerCase() })
    : null;
  if (!got) return null;
  if (token !== "showcase") {
    const { data: off } = await admin.from("saas_loadout_link_offs").select("loadout_id").eq("loadout_id", got.rec.id).maybeSingle();
    if (off) return "off";
  }
  return got;
}

/**
 * /l/showcase: the homepage's "See a load-out". The showcase demo yard (the
 * one behind the /demo proof link, re-seeded daily) and its latest CT-03
 * load-out, the one that caught the BOP stack out of test. Made-up yard,
 * real record, same page an operator gets.
 */
async function showcaseLoadout(admin: Admin): Promise<PublicRecord | null> {
  const { data: proof } = await admin.from("saas_readiness_proofs").select("company_id").eq("token", SHOWCASE_PROOF_TOKEN).maybeSingle();
  const companyId = (proof as { company_id: string } | null)?.company_id;
  if (!companyId) return null;
  const rec: LoadoutRecord | null = await selectRecord((cols) => admin.from("saas_loadout_scans").select(cols)
    .eq("company_id", companyId).eq("unit_name", "CT-03").order("finished_at", { ascending: false }).limit(1).maybeSingle());
  if (!rec) return null;
  const { data: ov } = await admin.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at").eq("loadout_id", rec.id).maybeSingle();
  return { rec: { ...rec, reasons: rec.reasons ?? [], lines: rec.lines ?? [], packages: rec.packages ?? [] }, override: (ov as LoadoutOverride | null) ?? null };
}
