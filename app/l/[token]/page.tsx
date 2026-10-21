import type { Metadata } from "next";
import { saasAdmin } from "@/lib/saas/db";
import { getLoadout, RECORD_COLS, type LoadoutRecord, type LoadoutOverride } from "@/lib/saas/loadout-record";
import { SHOWCASE_PROOF_TOKEN } from "@/lib/saas/demo-seed";
import LoadoutRecordView from "@/app/app/_components/loadout-record-view";
import { recordPaper } from "@/lib/saas/paper";

/**
 * PUBLIC proof of one load-out: the link a shop sends the operator instead of
 * a binder. Made automatically with every load-out. Read-only, no login, and
 * nothing beyond that one record. The token is long and random.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Load-out record · RollReady",
  robots: { index: false, follow: false },
};

function Gone() {
  return (
    <div className="saas flex min-h-dvh items-center justify-center bg-coal px-4 text-ink antialiased">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">This load-out link isn&apos;t valid.</p>
        <p className="mt-1 text-sm text-ink-dim">Ask the shop to send it again.</p>
      </div>
    </div>
  );
}

export default async function PublicLoadoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = saasAdmin();
  if (!admin) return <Gone />;
  const got = token === "showcase" ? await showcaseLoadout(admin)
    : /^[a-f0-9]{32}$/i.test(token) ? await getLoadout(admin, { token: token.toLowerCase() })
    : null;
  if (!got) return <Gone />;
  const { rec, override } = got;

  const ids = rec.pieces.map((p) => p.asset_id);
  const [{ data: co }, { data: yard }, { data: tags }, { data: rule }] = await Promise.all([
    admin.from("saas_companies").select("name").eq("id", rec.company_id).maybeSingle(),
    rec.yard_id ? admin.from("saas_yards").select("name").eq("id", rec.yard_id).maybeSingle() : Promise.resolve({ data: null }),
    ids.length ? admin.from("saas_assets").select("id, tag_token").eq("company_id", rec.company_id).in("id", ids) : Promise.resolve({ data: [] }),
    admin.from("saas_enforcement_settings").select("require_tag_scan").eq("company_id", rec.company_id).maybeSingle(),
  ]);
  // A scan-only yard keeps tag links off a page that gets passed around: a
  // tag link is a tag anyone could scan off a screen.
  const scanOnly = Boolean((rule as { require_tag_scan: boolean } | null)?.require_tag_scan);
  const tagOf = new Map(scanOnly ? [] : ((tags ?? []) as { id: string; tag_token: string | null }[]).map((t) => [t.id, t.tag_token]));
  const company = (co as { name: string } | null)?.name ?? "";
  // The paper behind every piece: the operator sees the cert, not just a date.
  const paper = await recordPaper(admin, rec.company_id, rec.pieces);
  const yardName = (yard as { name: string } | null)?.name ?? "";

  return (
    <div className="saas min-h-dvh bg-coal px-4 py-8 text-ink antialiased print:bg-white print:text-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
              <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#1d4ed8" />
            </svg>
            <span className="font-semibold tracking-tight">RollReady</span>
            <span className="text-sm text-ink-faint">Load-out record</span>
          </div>
          <span className="text-sm text-ink-dim">{[company, yardName].filter(Boolean).join(" · ")}</span>
        </div>
        <LoadoutRecordView rec={rec} override={override} tagHref={(id) => (tagOf.get(id) ? `/t/${tagOf.get(id)}` : null)} paper={paper} />
        <p className="text-[13px] text-ink-faint">Tap a piece to see its tests and cert. Sent from RollReady by SYNNR.</p>
      </div>
    </div>
  );
}

/**
 * /l/showcase: the homepage's "See a load-out". The showcase demo yard (the
 * one behind the /demo proof link, re-seeded daily) and its latest CT-03
 * load-out, the one that caught the BOP stack out of test. Made-up yard,
 * real record, same page an operator gets.
 */
async function showcaseLoadout(admin: NonNullable<ReturnType<typeof saasAdmin>>): Promise<{ rec: LoadoutRecord; override: LoadoutOverride | null } | null> {
  const { data: proof } = await admin.from("saas_readiness_proofs").select("company_id").eq("token", SHOWCASE_PROOF_TOKEN).maybeSingle();
  const companyId = (proof as { company_id: string } | null)?.company_id;
  if (!companyId) return null;
  const { data } = await admin.from("saas_loadout_scans").select(RECORD_COLS)
    .eq("company_id", companyId).eq("unit_name", "CT-03").order("finished_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const rec = data as LoadoutRecord;
  const { data: ov } = await admin.from("saas_loadout_overrides").select("loadout_id, by_name, reason, created_at").eq("loadout_id", rec.id).maybeSingle();
  return { rec: { ...rec, reasons: rec.reasons ?? [], lines: rec.lines ?? [], packages: rec.packages ?? [] }, override: (ov as LoadoutOverride | null) ?? null };
}
