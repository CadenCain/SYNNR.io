import { notFound } from "next/navigation";
import { Check, TriangleAlert, Camera, Lock, Truck } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

/**
 * The immutable dispatch record (spec #1d) — the artifact that proves the
 * truck rolled ready. Timestamp, checker, co-signer, every line's result with
 * photos, the verdict, any override + reason. Append-only at the database
 * level; this page is strictly read-only.
 */
const RESULT_UI: Record<string, { cls: string; label: string }> = {
  ok: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "OK" },
  missing: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Missing" },
  expired: { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Expired" },
  unconfirmed: { cls: "border-line-2 bg-elevated text-ink-faint", label: "Not checked" },
  na: { cls: "border-line-2 bg-elevated text-ink-faint", label: "N/A" },
};

export default async function DispatchRecord({ params }: { params: Promise<{ checkId: string }> }) {
  const { company } = await requireCompany();
  const { checkId } = await params;
  const db = await saasDb();

  const { data: checkData } = await db
    .from("saas_dispatch_checks")
    .select("id, unit_id, type, status, performed_by_name, cosigner_name, cosigned_at, job_ref, job_date, override_reason, started_at, completed_at, saas_units(name)")
    .eq("id", checkId).eq("company_id", company.id).maybeSingle();
  if (!checkData) notFound();
  const c = checkData as {
    id: string; unit_id: string; type: string; status: string;
    performed_by_name: string | null; cosigner_name: string | null; cosigned_at: string | null;
    job_ref: string | null; job_date: string | null; override_reason: string | null; started_at: string; completed_at: string | null;
    saas_units: { name: string } | { name: string }[] | null;
  };
  const unitName = (Array.isArray(c.saas_units) ? c.saas_units[0]?.name : c.saas_units?.name) ?? "unit";

  const { data: itemData } = await db
    .from("saas_dispatch_check_items")
    .select("id, source_type, label, result, note, photo_path")
    .eq("check_id", checkId);
  const items = (itemData ?? []) as { id: string; source_type: string; label: string; result: string; note: string | null; photo_path: string | null }[];

  // Photo thumbnails via short-lived signed URLs (private bucket).
  const admin = saasAdmin();
  const photoUrls = new Map<string, string>();
  if (admin) {
    for (const i of items) {
      if (!i.photo_path) continue;
      const { data: signed } = await admin.storage.from("proofs").createSignedUrl(i.photo_path, 3600);
      if (signed?.signedUrl) photoUrls.set(i.id, signed.signedUrl);
    }
  }

  const isOverride = c.status === "not_ready_override";
  const verdict =
    c.type === "checkin"
      ? c.status === "partial" ? { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Checked in — items not returned" }
        : { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", label: "Checked in — all accounted for" }
      : isOverride
        ? { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Rolled out NOT READY — override (historical)" }
        : c.status === "not_ready"
          ? { cls: "border-red-500/40 bg-red-500/10 text-red-400", label: "Pre-dispatch check — NOT READY" }
          : { cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400", label: "Pre-dispatch check — Ready" };

  const gearLines = items.filter((i) => i.source_type === "loadout_item" || i.source_type === "asset");
  const paperLines = items.filter((i) => i.source_type === "cert" || i.source_type === "crew_cert");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: `/app/units/${c.unit_id}`, label: unitName }}
        title={`Dispatch record — ${unitName}`}
        description={`${c.type === "checkin" ? "Check-in" : "Pre-dispatch check"} · run ${new Date(c.started_at).toLocaleString()}${c.job_date ? ` · for the job on ${c.job_date}` : ""}`}
      />

      <div className={`flex items-center gap-3 rounded-2xl border p-4 ${verdict.cls}`}>
        {verdict.cls.includes("emerald") ? <Check className="h-5 w-5 shrink-0" /> : <TriangleAlert className="h-5 w-5 shrink-0" />}
        <div className="min-w-0">
          <div className="font-semibold">{verdict.label}</div>
          {isOverride && c.override_reason ? <div className="text-sm opacity-90">Reason: &ldquo;{c.override_reason}&rdquo;</div> : null}
        </div>
      </div>

      <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
        <span><span className="text-ink-faint">Checked by</span> <span className="font-medium">{c.performed_by_name ?? "—"}</span></span>
        {c.cosigner_name ? (
          <span><span className="text-ink-faint">Co-signed by</span> <span className="font-medium">{c.cosigner_name}</span>{c.cosigned_at ? <span className="text-ink-faint"> · {new Date(c.cosigned_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : null}</span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5 text-ink-faint"><Lock className="h-3.5 w-3.5" /> Read-only record</span>
      </Card>

      {gearLines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Loadout &amp; assets</h2>
          {gearLines.map((i) => {
            const ui = RESULT_UI[i.result] ?? RESULT_UI.na;
            const url = photoUrls.get(i.id);
            return (
              <Card key={i.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.label}</div>
                  {i.note ? <div className="truncate text-sm text-ink-dim">{i.note}</div> : null}
                </div>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="shrink-0" title="Open photo proof">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo proof — ${i.label}`} className="h-12 w-12 rounded-lg border border-line-2 object-cover" />
                  </a>
                ) : i.photo_path ? (
                  <span className="flex items-center gap-1 text-xs text-ink-faint"><Camera className="h-3.5 w-3.5" /> photo</span>
                ) : null}
                <span className={`shrink-0 rounded-sm border px-2.5 py-0.5 text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
              </Card>
            );
          })}
        </section>
      )}

      {paperLines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Paper &amp; crew cards at roll-out</h2>
          {paperLines.map((i) => {
            const ui = RESULT_UI[i.result] ?? RESULT_UI.na;
            return (
              <Card key={i.id} className="flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
                <span className={`shrink-0 rounded-sm border px-2.5 py-0.5 text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
              </Card>
            );
          })}
        </section>
      )}

      <p className="flex items-center gap-2 text-xs text-ink-faint">
        <Truck className="h-3.5 w-3.5" />
        This record was written at {new Date(c.completed_at ?? c.started_at).toLocaleString()} and cannot be edited — it&apos;s the proof the truck {c.type === "checkin" ? "came back accounted for" : "rolled ready (or who decided otherwise)"}.
      </p>
    </div>
  );
}
