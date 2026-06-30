import Link from "next/link";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";

export const dynamic = "force-dynamic";

export default async function OpDashboard() {
  await requireOperator();
  const db = requireReadinessDb();

  const [shops, pending, expiringSoon] = await Promise.all([
    db.from("rd_shops").select("id", { count: "exact", head: true }).is("deleted_at", null),
    db.from("rd_alerts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    // Asset certs that expire in the next 14 days and aren't yet alerted-as-sent.
    db
      .from("rd_asset_certs")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("expires_at", "is", null)
      .lte("expires_at", new Date(Date.now() + 14 * 86400e3).toISOString().slice(0, 10))
      .gte("expires_at", new Date(Date.now() - 1 * 86400e3).toISOString().slice(0, 10)),
  ]);

  return (
    <>
      <div className="op-page-h">
        <div>
          <h1>Dashboard</h1>
          <div className="op-page-sub">A 30-second read on every shop you run.</div>
        </div>
        <Link className="op-btn op-btn-primary" href="/op/outbound">Today&apos;s outbound →</Link>
      </div>

      <div className="op-card-grid" style={{ marginBottom: 28 }}>
        <Stat label="Active shops" value={shops.count ?? 0} href="/op/shops" />
        <Stat label="Pending alerts" value={pending.count ?? 0} href="/op/outbound" emphasize={(pending.count ?? 0) > 0} />
        <Stat label="Certs expiring (14d)" value={expiringSoon.count ?? 0} sub="across all shops" />
      </div>

      <div className="op-card">
        <div className="op-card-title">How to work this</div>
        <ol style={{ paddingLeft: 18, lineHeight: 1.7, color: "var(--op-fg-dim)" }}>
          <li><Link href="/op/shops/new">Onboard a shop</Link> after the readiness audit — add yards, crew, assets, and certs you logged.</li>
          <li>The daily cron sweeps for expirations; pending alerts show up in <Link href="/op/outbound">Today&apos;s outbound</Link>.</li>
          <li>Send the texts (copy from outbound), then click <b>Mark sent</b>. The audit log records who/when.</li>
        </ol>
      </div>
    </>
  );
}

function Stat({ label, value, sub, href, emphasize }: { label: string; value: number; sub?: string; href?: string; emphasize?: boolean }) {
  const inner = (
    <div className="op-card">
      <div className="op-card-title">{label}</div>
      <div className="op-stat" style={emphasize ? { color: "var(--op-warn)" } : undefined}>{value}</div>
      {sub ? <div className="op-stat-sub">{sub}</div> : null}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{inner}</Link> : inner;
}
