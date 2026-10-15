import type { Metadata } from "next";
import { saasAdmin } from "@/lib/saas/db";
import { getLoadout } from "@/lib/saas/loadout-record";
import LoadoutRecordView from "@/app/app/_components/loadout-record-view";

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
  if (!/^[a-f0-9]{32}$/i.test(token)) return <Gone />;
  const admin = saasAdmin();
  if (!admin) return <Gone />;
  const got = await getLoadout(admin, { token: token.toLowerCase() });
  if (!got) return <Gone />;
  const { rec, override } = got;

  const ids = rec.pieces.map((p) => p.asset_id);
  const [{ data: co }, { data: yard }, { data: tags }] = await Promise.all([
    admin.from("saas_companies").select("name").eq("id", rec.company_id).maybeSingle(),
    rec.yard_id ? admin.from("saas_yards").select("name").eq("id", rec.yard_id).maybeSingle() : Promise.resolve({ data: null }),
    ids.length ? admin.from("saas_assets").select("id, tag_token").eq("company_id", rec.company_id).in("id", ids) : Promise.resolve({ data: [] }),
  ]);
  const tagOf = new Map(((tags ?? []) as { id: string; tag_token: string | null }[]).map((t) => [t.id, t.tag_token]));
  const company = (co as { name: string } | null)?.name ?? "";
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
        <LoadoutRecordView rec={rec} override={override} tagHref={(id) => (tagOf.get(id) ? `/t/${tagOf.get(id)}` : null)} />
        <p className="text-[13px] text-ink-faint">Tap a piece to see its tests and cert. Sent from RollReady by SYNNR.</p>
      </div>
    </div>
  );
}
