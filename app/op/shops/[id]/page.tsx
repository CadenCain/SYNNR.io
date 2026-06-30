import Link from "next/link";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";

export const dynamic = "force-dynamic";

export default async function ShopOverview({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id } = await params;
  const db = requireReadinessDb();

  const [assets, persons, pendingAlerts, openCheckouts] = await Promise.all([
    db.from("rd_assets").select("id", { count: "exact", head: true }).eq("shop_id", id).is("deleted_at", null),
    db.from("rd_persons").select("id", { count: "exact", head: true }).eq("shop_id", id).eq("active", true),
    db.from("rd_alerts").select("id", { count: "exact", head: true }).eq("shop_id", id).eq("status", "pending"),
    db.from("rd_checkouts").select("id", { count: "exact", head: true }).eq("shop_id", id).is("returned_at", null),
  ]);

  return (
    <div className="op-stack">
      <div className="op-card-grid">
        <Stat label="Assets tracked" value={assets.count ?? 0} />
        <Stat label="Active crew" value={persons.count ?? 0} />
        <Stat label="Pending alerts" value={pendingAlerts.count ?? 0} emphasize={(pendingAlerts.count ?? 0) > 0} />
        <Stat label="Currently out" value={openCheckouts.count ?? 0} sub="checked out" />
      </div>

      <div className="op-card">
        <div className="op-card-title">Quick actions</div>
        <div className="op-row">
          <Link className="op-btn" href={`/op/shops/${id}/assets/new`}>+ Add asset</Link>
          <Link className="op-btn" href={`/op/shops/${id}/assets`}>View assets</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, emphasize }: { label: string; value: number; sub?: string; emphasize?: boolean }) {
  return (
    <div className="op-card">
      <div className="op-card-title">{label}</div>
      <div className="op-stat" style={emphasize ? { color: "var(--op-warn)" } : undefined}>{value}</div>
      {sub ? <div className="op-stat-sub">{sub}</div> : null}
    </div>
  );
}
