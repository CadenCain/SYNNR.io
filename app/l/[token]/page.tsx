import type { Metadata } from "next";
import { saasAdmin } from "@/lib/saas/db";
import { recordPhoto, laterLoadout, yardZones } from "@/lib/saas/loadout-record";
import LoadoutRecordView from "@/app/app/_components/loadout-record-view";
import { recordPaper, recordTruckPaper } from "@/lib/saas/paper";
import { loadPublicRecord } from "./load-record";

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

function Gone({ shutOff = false }: { shutOff?: boolean }) {
  return (
    <div className="saas flex min-h-dvh items-center justify-center bg-coal px-4 text-ink antialiased">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">{shutOff ? "The shop shut this link off." : "This load-out link isn\u2019t valid."}</p>
        <p className="mt-1 text-sm text-ink-dim">Ask the shop to send it again.</p>
      </div>
    </div>
  );
}

export default async function PublicLoadoutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = saasAdmin();
  if (!admin) return <Gone />;
  const got = await loadPublicRecord(admin, token);
  if (got === "off") return <Gone shutOff />;
  if (!got) return <Gone />;
  const { rec, override } = got;

  const ids = rec.pieces.map((p) => p.asset_id);
  const [{ data: co }, { data: yard }, { data: tags }, { data: rule }] = await Promise.all([
    admin.from("saas_companies").select("name, is_demo").eq("id", rec.company_id).maybeSingle(),
    rec.yard_id ? admin.from("saas_yards").select("name").eq("id", rec.yard_id).maybeSingle() : Promise.resolve({ data: null }),
    ids.length ? admin.from("saas_assets").select("id, tag_token").eq("company_id", rec.company_id).in("id", ids) : Promise.resolve({ data: [] }),
    admin.from("saas_enforcement_settings").select("require_tag_scan").eq("company_id", rec.company_id).maybeSingle(),
  ]);
  // A scan-only yard keeps tag links off a page that gets passed around: a
  // tag link is a tag anyone could scan off a screen.
  const scanOnly = Boolean((rule as { require_tag_scan: boolean } | null)?.require_tag_scan);
  const tagOf = new Map(scanOnly ? [] : ((tags ?? []) as { id: string; tag_token: string | null }[]).map((t) => [t.id, t.tag_token]));
  // A demo yard says so on everything an outsider can open: anyone can start
  // one, so its name proves nothing.
  const demo = Boolean((co as { is_demo?: boolean } | null)?.is_demo);
  const company = `${(co as { name: string } | null)?.name ?? ""}${demo ? " (demo)" : ""}`;
  // The paper behind every piece: the operator sees the cert, not just a date.
  // Each link goes through this page's token, so it opens however long the
  // tab has been open, and stops the moment the shop shuts the link off.
  const paperHref = (uploadId: string) => `/l/${token}/paper/${uploadId}`;
  const [paper, truckPaper] = await Promise.all([
    recordPaper(admin, rec.company_id, rec.pieces, paperHref),
    recordTruckPaper(admin, rec.company_id, rec.truck_paper, paperHref),
  ]);
  const photo = await recordPhoto(admin, rec, `/l/${token}/photo`);
  const yardName = (yard as { name: string } | null)?.name ?? "";
  // Blocked, then loaded out again for the same job on the same shift (fixed
  // and READY, most often): the old link says so in one line instead of
  // holding the truck. It never links to that record or shows anything off
  // it: this link shows the record it was made for.
  const later = await laterLoadout(admin, rec, override);
  // Times read in the yard's own zone, with the zone on them: the company
  // man holds them up against his gate log.
  const zones = await yardZones(admin, [rec.yard_id, later?.yard_id]);
  const tz = (rec.yard_id && zones.get(rec.yard_id)) || null;

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
        {demo ? <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">Demo yard on synnr.io. The company and its records are made up.</p> : null}
        <LoadoutRecordView rec={rec} override={override} tagHref={(id) => (tagOf.get(id) ? `/t/${tagOf.get(id)}` : null)} paper={paper} truckPaper={truckPaper} photo={photo} forOperator tz={tz}
          later={later ? { unit_name: later.unit_name, finished_at: later.finished_at, outcome: later.outcome, tz: (later.yard_id && zones.get(later.yard_id)) || tz } : null} />
        <p className="text-[13px] text-ink-faint">{rec.pieces.length ? "Tap a piece to see its tests and cert. " : ""}Sent from RollReady by SYNNR.</p>
      </div>
    </div>
  );
}
