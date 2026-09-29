import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, TriangleAlert, PencilRuler } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { plainDate } from "@/lib/saas/judge";
import { computeDispatchCheck } from "@/lib/saas/dispatch-check";
import { localToday } from "@/lib/saas/status";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { recordDispatchCheck } from "./actions";
import JobDatePicker from "./job-date-picker";
import RecordButton from "./record-button";

export const dynamic = "force-dynamic";

/**
 * Readiness check — a computed record-currency check, not a possession
 * checklist. The verdict comes straight from the live records (cert/DOT
 * currency on the truck and its iron, flagged iron); the gear list only warns.
 * Nobody taps lines, nothing can be overridden. One button records the
 * result as an immutable check with every line and reason.
 */
const RESULT_UI: Record<string, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  missing: "border-red-500/40 bg-red-500/10 text-red-400",
  expired: "border-red-500/40 bg-red-500/10 text-red-400",
};
const RESULT_LABEL: Record<string, string> = { ok: "OK", warn: "Heads-up", missing: "Missing", expired: "Expired" };
const SECTION = "text-sm font-semibold text-ink-dim";

export default async function DispatchPage({ params, searchParams }: { params: Promise<{ unitId: string }>; searchParams: Promise<{ job?: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const { job } = await searchParams;
  const db = await saasDb();
  const today = localToday();

  const comp = await computeDispatchCheck(db, company.id, unitId, job);
  if (!comp) notFound();

  const gear = comp.lines.filter((l) => l.source_type === "loadout_item" || l.source_type === "asset");
  const paper = comp.lines.filter((l) => l.source_type === "cert");

  // Verdict banner groups failures by kind — eight identical red bullets read
  // as noise; three labeled clusters read as a fix-list.
  const failing = (rows: typeof comp.lines) => rows.filter((l) => l.result !== "ok" && l.result !== "warn");
  const failureGroups = [
    { label: "Iron", rows: failing(gear) },
    { label: "Paper", rows: failing(paper) },
  ].filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: `/app/units/${unitId}`, label: comp.unitName }}
        title={`Readiness check: ${comp.unitName}`}
        description="Checks this truck's own paper and every piece of iron on it against the job date. There's no override."
      />

      <Card className="p-4">
        <JobDatePicker jobDate={comp.jobDate} today={today} />
      </Card>

      {/* Verdict */}
      {comp.verdict === "not_setup" ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <TriangleAlert className="h-7 w-7 text-ink-faint" />
          <p className="font-semibold">Nothing set up to check.</p>
          <p className="mx-auto max-w-md text-sm text-ink-dim">
            This truck has no gear list, no iron, and no certs. A check with nothing
            to verify can&apos;t pass. Set it up first.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/app/units/${unitId}/loadout`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-bone px-4 text-sm font-semibold text-coal"><PencilRuler className="h-4 w-4" /> Edit gear list</Link>
            <Link href={`/app/units/${unitId}`} className="inline-flex h-10 items-center rounded-lg border border-line-2 px-4 text-sm text-ink">Add certs &amp; assets</Link>
          </div>
        </Card>
      ) : (
        <div className={`rounded-2xl border p-4 ${comp.verdict === "ready" ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
          <div className={`flex items-center gap-2 text-lg font-semibold ${comp.verdict === "ready" ? "text-emerald-400" : "text-red-400"}`}>
            {comp.verdict === "ready" ? <Check className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
            {comp.verdict === "ready"
              ? comp.isFutureJob ? `Ready for the ${plainDate(comp.jobDate)} job. Everything is current through then.` : "Ready. Everything on record is current."
              : comp.isFutureJob ? `NOT READY for the ${plainDate(comp.jobDate)} job` : "NOT READY"}
          </div>
          {failureGroups.length > 0 && (
            <div className="mt-3 flex flex-col gap-3">
              {failureGroups.map((g) => (
                <div key={g.label}>
                  <div className="text-sm font-semibold text-red-400/80">
                    {g.label} · {g.rows.length}
                  </div>
                  <ul className="mt-1 flex flex-col gap-1 text-sm text-red-300">
                    {g.rows.map((l, i) => (
                      <li key={`${l.source_id ?? i}`}>• {l.label}{l.detail ? <span className="text-red-300/70">: {l.detail}</span> : null}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {/* The verdict names the failures — these take you straight to
                  where each kind gets fixed, instead of leaving you to hunt. */}
              <div className="flex flex-wrap gap-2 border-t border-red-500/20 pt-3">
                <Link href={`/app/units/${unitId}`} className="inline-flex h-10 items-center rounded-lg bg-bone px-4 text-sm font-semibold text-white">Fix the iron &amp; renew paper</Link>
              </div>
            </div>
          )}
          {comp.warnings.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 border-t border-red-500/20 pt-3 text-sm text-amber-400">
              {comp.warnings.map((w) => <li key={w}>• {w}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Lines */}
      {[{ title: "Iron on the truck", rows: gear },
        { title: "Tests, certs, inspections, and DOT", rows: paper }].map(({ title, rows }) =>
        rows.length === 0 ? null : (
          <section key={title} className="flex flex-col gap-2">
            <h2 className={SECTION}>{title}</h2>
            {rows.map((l, i) => (
              <Card key={`${l.source_type}-${l.source_id ?? i}`} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="break-words font-medium">{l.label}</div>
                  {l.detail ? <div className="break-words text-sm text-ink-dim">{l.detail}</div> : null}
                </div>
                <span className={`shrink-0 rounded-sm border px-2.5 py-0.5 text-xs font-semibold ${RESULT_UI[l.result]}`}>{RESULT_LABEL[l.result]}</span>
              </Card>
            ))}
          </section>
        ),
      )}

      {comp.verdict !== "not_setup" && (
        <form action={recordDispatchCheck} className="flex flex-col gap-2">
          <input type="hidden" name="unit_id" value={unitId} />
          <input type="hidden" name="job_date" value={comp.jobDate} />
          <RecordButton label={`Record this check${comp.isFutureJob ? ` for ${plainDate(comp.jobDate)}` : ""}`} />
          <p className="text-center text-xs text-ink-faint">
            Saves the result and every line with your name and the time. It can&apos;t be edited afterward.
            {comp.verdict === "not_ready" ? " A NOT READY result is saved as NOT READY. There is no override. Fix the items and run it again." : ""}
          </p>
        </form>
      )}
    </div>
  );
}
