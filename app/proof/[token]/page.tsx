import type { Metadata } from "next";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { saasAdmin } from "@/lib/saas/db";
import type { ComplianceStatus } from "@/lib/saas/db";

/**
 * PUBLIC readiness proof — the link a shop hands the company man instead of
 * assembling a binder every quarter. Read-only snapshot, no auth, no internal
 * nav, nothing outside the chosen scope. Token is unguessable + revocable.
 * Renders server-side via the service-role client AFTER validating the token.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Readiness proof · SYNNR",
  robots: { index: false, follow: false },
};

const CHIP: Record<ComplianceStatus, string> = {
  valid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  expiring: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  expired: "border-red-500/30 bg-red-500/10 text-red-400",
  none: "border-line-2 bg-elevated text-ink-dim",
};
const LABEL: Record<ComplianceStatus, string> = { valid: "Valid", expiring: "Due soon", expired: "Expired", none: "Missing" };

function Invalid({ reason }: { reason: string }) {
  return (
    <div className="saas flex min-h-dvh items-center justify-center bg-coal px-4 text-ink antialiased">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold">This proof link is {reason}.</p>
        <p className="mt-1 text-sm text-ink-dim">Ask the shop for a fresh one.</p>
      </div>
    </div>
  );
}

export default async function ProofPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = saasAdmin();
  if (!admin) return <Invalid reason="unavailable" />;

  const { data: proofData } = await admin
    .from("saas_readiness_proofs")
    .select("id, company_id, yard_id, unit_id, scope, expires_at, revoked_at, created_at")
    .eq("token", token).maybeSingle();
  if (!proofData) return <Invalid reason="not valid" />;
  const proof = proofData as { id: string; company_id: string; yard_id: string | null; unit_id: string | null; scope: string; expires_at: string | null; revoked_at: string | null; created_at: string };
  if (proof.revoked_at) return <Invalid reason="revoked" />;
  if (proof.expires_at && new Date(proof.expires_at) < new Date()) return <Invalid reason="expired" />;

  // ── Assemble the scoped snapshot ──
  const { data: companyData } = await admin.from("saas_companies").select("name").eq("id", proof.company_id).maybeSingle();
  const companyName = (companyData as { name: string } | null)?.name ?? "";

  // Units in scope
  let unitFilter: string[] | null = null; // null = all company units
  let scopeName = companyName;
  if (proof.scope === "unit" && proof.unit_id) {
    unitFilter = [proof.unit_id];
    const { data: u } = await admin.from("saas_units").select("name").eq("id", proof.unit_id).maybeSingle();
    scopeName = `${companyName} — ${(u as { name: string } | null)?.name ?? "unit"}`;
  } else if (proof.scope === "yard" && proof.yard_id) {
    const { data: us } = await admin.from("saas_units").select("id").eq("yard_id", proof.yard_id);
    unitFilter = ((us ?? []) as { id: string }[]).map((x) => x.id);
    const { data: y } = await admin.from("saas_yards").select("name").eq("id", proof.yard_id).maybeSingle();
    scopeName = `${companyName} — ${(y as { name: string } | null)?.name ?? "yard"}`;
  }

  // Assets in scope
  let assetQ = admin.from("saas_assets").select("id, name, category, status").eq("company_id", proof.company_id);
  if (proof.scope === "yard" && proof.yard_id) assetQ = assetQ.eq("yard_id", proof.yard_id);
  if (proof.scope === "unit" && proof.unit_id) assetQ = assetQ.eq("unit_id", proof.unit_id);
  const { data: assetData } = await assetQ.order("name");
  const assets = (assetData ?? []) as { id: string; name: string; category: string; status: string }[];
  const assetIds = new Set(assets.map((a) => a.id));

  // Compliance items in scope (company scope includes crew certs)
  const { data: itemData } = await admin
    .from("saas_compliance_items_with_status")
    .select("id, title, kind, expiration_date, status, parent_type, parent_id")
    .eq("company_id", proof.company_id);
  type Item = { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string };
  let items = (itemData ?? []) as Item[];
  if (unitFilter) {
    const uf = new Set(unitFilter);
    items = items.filter((i) =>
      (i.parent_type === "unit" && uf.has(i.parent_id)) ||
      (i.parent_type === "asset" && assetIds.has(i.parent_id)),
    );
  }
  const rank: Record<ComplianceStatus, number> = { expired: 0, expiring: 1, valid: 2, none: 3 };
  items.sort((a, b) => rank[a.status] - rank[b.status] || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""));

  // Names for context columns
  const { data: unitNamesData } = await admin.from("saas_units").select("id, name").eq("company_id", proof.company_id);
  const unitNames = new Map(((unitNamesData ?? []) as { id: string; name: string }[]).map((u) => [u.id, u.name]));
  const assetNames = new Map(assets.map((a) => [a.id, a.name]));
  const { data: crewNamesData } = await admin.from("saas_crew_members").select("id, name").eq("company_id", proof.company_id);
  const crewNames = new Map(((crewNamesData ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const onLabel = (i: Item) =>
    i.parent_type === "unit" ? unitNames.get(i.parent_id) ?? "unit"
    : i.parent_type === "crew" ? `${crewNames.get(i.parent_id) ?? "crew"} (crew)`
    : assetNames.get(i.parent_id) ?? "asset";

  const missingAssets = assets.filter((a) => a.status === "missing");
  const failingCount = items.filter((i) => i.status === "expired" || i.status === "none").length;
  const ready = failingCount === 0 && missingAssets.length === 0;
  const generatedAt = new Date().toLocaleString();

  // Unit scope: include the latest immutable dispatch record (spec #1d) —
  // who checked it, the verdict, and photo proof.
  let record: {
    type: string; status: string; performed_by_name: string | null; cosigner_name: string | null;
    started_at: string; override_reason: string | null;
    lines: { label: string; result: string; photoUrl: string | null }[];
  } | null = null;
  if (proof.scope === "unit" && proof.unit_id) {
    const { data: chk } = await admin
      .from("saas_dispatch_checks")
      .select("id, type, status, performed_by_name, cosigner_name, started_at, override_reason")
      .eq("unit_id", proof.unit_id).eq("type", "checkout")
      .order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (chk) {
      const c = chk as { id: string; type: string; status: string; performed_by_name: string | null; cosigner_name: string | null; started_at: string; override_reason: string | null };
      const { data: lineData } = await admin
        .from("saas_dispatch_check_items")
        .select("label, result, photo_path")
        .eq("check_id", c.id)
        .in("source_type", ["loadout_item", "asset"]);
      const lines: { label: string; result: string; photoUrl: string | null }[] = [];
      for (const l of (lineData ?? []) as { label: string; result: string; photo_path: string | null }[]) {
        let photoUrl: string | null = null;
        if (l.photo_path) {
          const { data: signed } = await admin.storage.from("proofs").createSignedUrl(l.photo_path, 3600);
          photoUrl = signed?.signedUrl ?? null;
        }
        lines.push({ label: l.label, result: l.result, photoUrl });
      }
      record = { ...c, lines };
    }
  }

  return (
    <div className="saas min-h-dvh bg-coal px-4 py-10 text-ink antialiased print:bg-white print:text-black">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden className="h-6 w-6">
              <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#e7ddc7" />
            </svg>
            <span className="font-semibold tracking-tight">SYNNR</span>
            <span className="text-sm text-ink-faint">Readiness proof</span>
          </div>
          <span className="text-xs text-ink-faint">Generated {generatedAt}</span>
        </div>

        {/* Verdict */}
        <div className={`rounded-2xl border p-6 ${ready ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
          <div className={`flex items-center gap-3 text-2xl font-semibold ${ready ? "text-emerald-400" : "text-red-400"}`}>
            {ready ? <ShieldCheck className="h-7 w-7" /> : <TriangleAlert className="h-7 w-7" />}
            {ready ? "Ready" : "Not ready"}
          </div>
          <p className="mt-1 text-sm text-ink-dim">{scopeName}</p>
          {!ready ? (
            <p className="mt-2 text-sm text-red-300">
              {failingCount > 0 ? `${failingCount} item${failingCount === 1 ? "" : "s"} expired or missing a date` : ""}
              {failingCount > 0 && missingAssets.length > 0 ? " · " : ""}
              {missingAssets.length > 0 ? `${missingAssets.length} asset${missingAssets.length === 1 ? "" : "s"} unaccounted for` : ""}
            </p>
          ) : null}
        </div>

        {/* Latest dispatch record — the enforcement artifact */}
        {record ? (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">Last pre-dispatch check</h2>
              <span className="text-xs text-ink-faint">{new Date(record.started_at).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm">
              <span className={record.status === "not_ready_override" ? "font-semibold text-red-400" : "font-semibold text-emerald-400"}>
                {record.status === "not_ready_override" ? "Rolled out NOT ready — override" : "Rolled out Ready"}
              </span>
              <span className="text-ink-dim"> · checked by {record.performed_by_name ?? "—"}{record.cosigner_name ? ` · co-signed by ${record.cosigner_name}` : ""}</span>
              {record.override_reason ? <span className="text-ink-dim"> · reason: &ldquo;{record.override_reason}&rdquo;</span> : null}
            </p>
            {record.lines.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {record.lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${l.result === "ok" ? CHIP.valid : l.result === "missing" ? CHIP.expired : CHIP.none}`}>
                      {l.result === "ok" ? "OK" : l.result === "missing" ? "Missing" : "Not checked"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    {l.photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <a href={l.photoUrl} target="_blank" rel="noreferrer"><img src={l.photoUrl} alt={`Photo — ${l.label}`} className="h-9 w-9 rounded-md border border-line-2 object-cover" /></a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* Items table */}
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Item", "On", "Kind", "Expires", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="last:[&>td]:border-0">
                    <td className="border-b border-line/60 px-4 py-3 font-medium">{i.title}</td>
                    <td className="border-b border-line/60 px-4 py-3 text-ink-dim">{onLabel(i)}</td>
                    <td className="border-b border-line/60 px-4 py-3 capitalize text-ink-dim">{i.kind.replace(/_/g, " ")}</td>
                    <td className="border-b border-line/60 px-4 py-3 tabular-nums text-ink-dim">{i.expiration_date ?? "—"}</td>
                    <td className="border-b border-line/60 px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${CHIP[i.status]}`}>{LABEL[i.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Assets */}
        {assets.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Asset", "Category", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap border-b border-line px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="last:[&>td]:border-0">
                    <td className="border-b border-line/60 px-4 py-3 font-medium">{a.name}</td>
                    <td className="border-b border-line/60 px-4 py-3 capitalize text-ink-dim">{a.category.replace(/_/g, " ")}</td>
                    <td className="border-b border-line/60 px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${a.status === "in_service" ? CHIP.valid : a.status === "missing" ? CHIP.expired : CHIP.expiring}`}>
                        {a.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-xs text-ink-faint">
          Live snapshot from SYNNR — equipment &amp; cert readiness for oilfield service shops · synnr.io
        </p>
      </div>
    </div>
  );
}
