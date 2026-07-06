import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, TriangleAlert, ClipboardCheck, PencilRuler } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { computeDispatchCheck } from "@/lib/saas/dispatch-check";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { recordDispatchCheck } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Pre-dispatch check — a computed record-currency check, not a possession
 * checklist. The verdict comes straight from the live data (template vs
 * asset list, cert/DOT currency, assigned crew cards); nobody taps lines,
 * nothing can be overridden. One button records the result as an immutable
 * check with every line and reason.
 */
const RESULT_UI: Record<string, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  missing: "border-red-500/40 bg-red-500/10 text-red-400",
  expired: "border-red-500/40 bg-red-500/10 text-red-400",
};
const RESULT_LABEL: Record<string, string> = { ok: "OK", missing: "Missing", expired: "Expired" };
const SECTION = "text-xs font-semibold uppercase tracking-wider text-ink-faint";

export default async function DispatchPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();

  const comp = await computeDispatchCheck(db, company.id, unitId);
  if (!comp) notFound();

  const gear = comp.lines.filter((l) => l.source_type === "loadout_item" || l.source_type === "asset");
  const paper = comp.lines.filter((l) => l.source_type === "cert");
  const crew = comp.lines.filter((l) => l.source_type === "crew_cert");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: `/app/units/${unitId}`, label: comp.unitName }}
        title={`Pre-dispatch check — ${comp.unitName}`}
        description="Computed live from the records: required gear on the asset list, paper current, crew cards current. Nothing to tap, nothing to override."
      />

      {/* Verdict */}
      {comp.verdict === "not_setup" ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <TriangleAlert className="h-7 w-7 text-ink-faint" />
          <p className="font-semibold">Nothing set up to check.</p>
          <p className="mx-auto max-w-md text-sm text-ink-dim">
            This unit has no loadout template, no assets, no certs, and no assigned crew — a check with nothing
            to verify can&apos;t pass. Set it up first.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/app/units/${unitId}/loadout`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-bone px-4 text-sm font-semibold text-coal"><PencilRuler className="h-4 w-4" /> Edit loadout</Link>
            <Link href={`/app/units/${unitId}`} className="inline-flex h-10 items-center rounded-lg border border-line-2 px-4 text-sm text-ink">Add certs &amp; assets</Link>
          </div>
        </Card>
      ) : (
        <div className={`rounded-2xl border p-4 ${comp.verdict === "ready" ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
          <div className={`flex items-center gap-2 text-lg font-semibold ${comp.verdict === "ready" ? "text-emerald-400" : "text-red-400"}`}>
            {comp.verdict === "ready" ? <Check className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
            {comp.verdict === "ready" ? "Ready — everything on record is current" : "NOT READY"}
          </div>
          {comp.failures.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-red-300">
              {comp.failures.map((f) => <li key={f}>• {f}</li>)}
            </ul>
          )}
          {comp.warnings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-400">
              {comp.warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Lines */}
      {[{ title: "Loadout & gear — on the asset list?", rows: gear },
        { title: "Paper — certs, inspections & DOT", rows: paper },
        { title: "Assigned crew cards", rows: crew }].map(({ title, rows }) =>
        rows.length === 0 ? null : (
          <section key={title} className="flex flex-col gap-2">
            <h2 className={SECTION}>{title}</h2>
            {rows.map((l, i) => (
              <Card key={`${l.source_type}-${l.source_id ?? i}`} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{l.label}</div>
                  {l.detail ? <div className="truncate text-sm text-ink-dim">{l.detail}</div> : null}
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${RESULT_UI[l.result]}`}>{RESULT_LABEL[l.result]}</span>
              </Card>
            ))}
          </section>
        ),
      )}

      {comp.verdict !== "not_setup" && (
        <form action={recordDispatchCheck} className="flex flex-col gap-2">
          <input type="hidden" name="unit_id" value={unitId} />
          <Button type="submit" size="lg" className="w-full">
            <ClipboardCheck className="h-5 w-5" /> Record this check
          </Button>
          <p className="text-center text-xs text-ink-faint">
            Records the verdict and every line, with your name and the time. Read-only after — the record is the proof.
            {comp.verdict === "not_ready" ? " A NOT-ready result records as NOT ready. There is no override — fix the items and re-run." : ""}
          </p>
        </form>
      )}
    </div>
  );
}
