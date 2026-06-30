import Link from "next/link";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";
import { certHealthBadge } from "@/lib/readiness/cert-health";

export const dynamic = "force-dynamic";

export default async function AssetsList({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id: shopId } = await params;
  const db = requireReadinessDb();

  // Pull assets with their certs in one round-trip via Supabase's join syntax.
  const { data, error } = await db
    .from("rd_assets")
    .select("id, asset_code, asset_type, description, status, last_reconciled_at, rd_asset_certs(id, cert_type, expires_at, deleted_at)")
    .eq("shop_id", shopId)
    .is("deleted_at", null)
    .order("asset_code");

  type Row = {
    id: string; asset_code: string; asset_type: string; description: string | null;
    status: string; last_reconciled_at: string | null;
    rd_asset_certs: { id: string; cert_type: string; expires_at: string | null; deleted_at: string | null }[];
  };
  const assets = (data ?? []) as Row[];

  return (
    <div className="op-stack">
      <div className="op-row">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Assets ({assets.length})</h2>
        <div className="op-spacer" />
        <Link className="op-btn op-btn-primary" href={`/op/shops/${shopId}/assets/new`}>+ Add asset</Link>
      </div>

      {error ? <p className="op-form-err">{error.message}</p> : null}

      <div className="op-card" style={{ padding: 0 }}>
        <table className="op-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Description</th>
              <th>Status</th>
              <th>Certs</th>
              <th>Soonest expiry</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 ? (
              <tr><td className="op-table-empty" colSpan={6}>No assets yet. <Link href={`/op/shops/${shopId}/assets/new`}>Add the first one</Link>.</td></tr>
            ) : (
              assets.map((a) => {
                const liveCerts = (a.rd_asset_certs ?? []).filter((c) => !c.deleted_at);
                const soonest = liveCerts
                  .filter((c) => c.expires_at)
                  .map((c) => c.expires_at as string)
                  .sort()[0];
                const badge = soonest ? certHealthBadge(soonest) : { className: "op-badge", label: "no expiry" };
                return (
                  <tr key={a.id}>
                    <td><Link href={`/op/shops/${shopId}/assets/${a.id}`}><span className="mono">{a.asset_code}</span></Link></td>
                    <td>{a.asset_type}</td>
                    <td className="op-muted">{a.description ?? "—"}</td>
                    <td><StatusBadge s={a.status} /></td>
                    <td>{liveCerts.length}</td>
                    <td>
                      {soonest ? (
                        <span className={badge.className}>{badge.label} · <span className="mono">{soonest}</span></span>
                      ) : <span className="op-faint">—</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    in_yard: "op-badge op-badge-good",
    checked_out: "op-badge op-badge-warn",
    in_repair: "op-badge op-badge-warn",
    retired: "op-badge",
  };
  return <span className={map[s] ?? "op-badge"}>{s.replace("_", " ")}</span>;
}
